-- Prevent repeated random heap reads and underestimated nested-loop scans.
-- The input predicates, source identities and consensus thresholds are unchanged.
create or replace function public.current_retail_campaign_consensus(p_retail_banner text)
returns table(sku text,campaign_names text[],campaigns jsonb,source_observed_at timestamptz)
language sql stable parallel safe security invoker as $$
  with membership_source as materialized (
    select sku,campaign_key,campaign_name,source_url,source_store_id,sync_batch_id,retail_banner,observed_at
    from public.retail_campaign_memberships
    where retail_banner=p_retail_banner and observed_at>=now()-interval '48 hours' and observed_at<=now()
  ), verified as (
    select cm.sku,cm.campaign_key,cm.campaign_name,min(cm.source_url) source_url,
      count(distinct cm.source_store_id)::integer source_store_count,min(cm.observed_at) observed_at
    from membership_source cm
    join public.retail_catalog_sync_runs r on r.sync_batch_id=cm.sync_batch_id
      and r.source_store_id=cm.source_store_id and r.retail_banner=cm.retail_banner
      and r.status='completed' and r.completed_at<=now()
    where cm.retail_banner=p_retail_banner
      -- Public CMS can switch to next Thursday's WK listings before prices do.
      -- Apply the retailer's Thursday week, not the Monday ISO changeover.
      and (cm.campaign_name !~* '\mwk\s*[0-9]{1,2}\M'
        or substring(cm.campaign_name from '(?i)\mwk\s*([0-9]{1,2})\M')::integer
          = extract(week from ((now() at time zone 'Europe/Dublin')::date
            - ((extract(isodow from now() at time zone 'Europe/Dublin')::integer+3)%7)))::integer)
      and cm.observed_at>=now()-interval '48 hours' and cm.observed_at<=now()
      and cm.observed_at>=r.started_at and cm.observed_at<=r.completed_at
      -- Completed sync runs are the durable proof that every queue job succeeded.
      -- Queue rows are reused by new runs, so joining them would prematurely hide
      -- the previous completed membership while the next batch is still building.
    group by cm.sku,cm.campaign_key,cm.campaign_name
    having count(distinct cm.source_store_id)>=3
  )
  select v.sku,array_agg(distinct v.campaign_name order by v.campaign_name),
    jsonb_agg(jsonb_build_object('key',v.campaign_key,'name',v.campaign_name,'source_url',v.source_url,
      'source_store_count',v.source_store_count,'source_observed_at',v.observed_at) order by v.campaign_key,v.campaign_name,v.source_url),
    min(v.observed_at)
  from verified v group by v.sku;
$$;
revoke all on function public.current_retail_campaign_consensus(text) from public,anon,authenticated;
grant execute on function public.current_retail_campaign_consensus(text) to service_role;


notify pgrst, 'reload schema';
create or replace function public.refresh_supervalu_national_scope()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_batch uuid:=gen_random_uuid(); v_products integer; v_offers integer; v_observed_at timestamptz;
  v_completed_sources integer; v_previous_current_offers integer;
begin
  -- Serialize snapshot publication; failed transactions leave the prior snapshot intact.
  perform pg_advisory_xact_lock(hashtext('supervalu-national-publication'));
  drop table if exists pg_temp.supervalu_range_observations;
  create temporary table supervalu_range_observations on commit drop as
    select product_id,source_store_id,regular_price_eur from public.retail_store_products
    where is_listed and source_price_source='supervalu_public_storefront' and last_seen_at>now()-interval '14 days';
  analyze supervalu_range_observations;
  with presence as (
    select product_id,count(distinct source_store_id) n from supervalu_range_observations group by product_id
  ), prices as (
    select product_id,regular_price_eur,count(distinct source_store_id) n from supervalu_range_observations where regular_price_eur is not null group by product_id,regular_price_eur
  ), ranked as (select *,row_number() over(partition by product_id order by n desc,regular_price_eur) rn from prices)
  update public.retail_catalog_products p set is_national=coalesce(pr.n,0)>=3,national_store_count=coalesce(pr.n,0),
    national_regular_price_eur=case when rp.n>=3 then rp.regular_price_eur end,
    national_regular_price_store_count=coalesce(rp.n,0),updated_at=now()
  from public.retail_catalog_products base left join presence pr on pr.product_id=base.id
    left join ranked rp on rp.product_id=base.id and rp.rn=1
  where p.id=base.id and p.retail_banner='supervalu'
    and (p.is_national,p.national_store_count,p.national_regular_price_eur,p.national_regular_price_store_count)
      is distinct from (coalesce(pr.n,0)>=3,coalesce(pr.n,0),case when rp.n>=3 then rp.regular_price_eur end,coalesce(rp.n,0));

  select count(distinct sp.source_store_id) into v_completed_sources
    from public.retail_store_products sp join public.retail_catalog_sync_runs r
      on r.sync_batch_id=sp.sync_batch_id and r.source_store_id=sp.source_store_id
      and r.retail_banner='supervalu' and r.status='completed'
    join public.retail_promotions rp on rp.store_product_id=sp.id
    where sp.is_listed and sp.source_price_source='supervalu_public_storefront'
      and sp.last_seen_at>now()-interval '14 days' and rp.synced_at>=now()-interval '48 hours' and rp.synced_at<=now()
      and rp.valid_from<=(now() at time zone 'Europe/Dublin')::date
      and rp.valid_to>=(now() at time zone 'Europe/Dublin')::date;
  select count(*) into v_products from public.retail_catalog_products where retail_banner='supervalu' and is_national;
  if v_completed_sources<3 then
    return jsonb_build_object('published',false,'national_products',v_products,'completed_sources',v_completed_sources,
      'reason','Fewer than three completed sources; previous snapshot preserved');
  end if;
  drop table if exists pg_temp.supervalu_current_consensus;
  create temporary table supervalu_current_consensus on commit drop as
  select sp.product_id,rp.promotion_type,rp.loyalty_required,coalesce(rp.loyalty_program,'') loyalty_program,
    coalesce(rp.label,'') label,coalesce(rp.description,'') description,
    case when rp.promotion_type='multibuy' then null else rp.offer_price_eur end offer_price_eur,
    case when count(distinct sp.source_store_id) filter(where coalesce(rp.regular_price_eur,sp.regular_price_eur) is not null)>=3
      and min(coalesce(rp.regular_price_eur,sp.regular_price_eur))=max(coalesce(rp.regular_price_eur,sp.regular_price_eur))
      then max(coalesce(rp.regular_price_eur,sp.regular_price_eur)) end regular_price_eur,
    rp.valid_from,rp.valid_to,count(distinct sp.source_store_id)::integer stores,
    min(rp.synced_at) observed_at,case when min(sp.price_per_unit)=max(sp.price_per_unit) then max(sp.price_per_unit) end price_per_unit
  from public.retail_promotions rp join public.retail_store_products sp on sp.id=rp.store_product_id
  join public.retail_catalog_sync_runs r on r.sync_batch_id=sp.sync_batch_id and r.source_store_id=sp.source_store_id
    and r.retail_banner='supervalu' and r.status='completed'
  join public.retail_catalog_products p on p.id=sp.product_id
  where p.retail_banner='supervalu' and sp.is_listed and sp.source_price_source='supervalu_public_storefront'
    and sp.last_seen_at>now()-interval '14 days' and rp.synced_at>=now()-interval '48 hours' and rp.synced_at<=now()
    and rp.valid_from<=(now() at time zone 'Europe/Dublin')::date
    and rp.valid_to>=(now() at time zone 'Europe/Dublin')::date
  group by sp.product_id,rp.promotion_type,rp.loyalty_required,coalesce(rp.loyalty_program,''),coalesce(rp.label,''),
    coalesce(rp.description,''),case when rp.promotion_type='multibuy' then null else rp.offer_price_eur end,rp.valid_from,rp.valid_to
  having count(distinct sp.source_store_id)>=3;
  create index on supervalu_current_consensus(product_id);
  analyze supervalu_current_consensus;
  select count(*),max(observed_at) into v_offers,v_observed_at from supervalu_current_consensus
    where offer_price_eur is not null or promotion_type='multibuy';
  if v_offers=0 then return jsonb_build_object('published',false,'national_products',v_products,'national_offers',0,'reason','No current cross-store consensus; previous snapshot preserved'); end if;
  -- Only date-current, cross-store national rows form the regression baseline.
  -- Expired rows and older unverified/single-store imports must not block a new week.
  select count(*) into v_previous_current_offers from public.retail_weekly_offers
    where retail_banner='supervalu' and organization_id is null and is_national and national_store_count>=3
      and offer_week_start<=(now() at time zone 'Europe/Dublin')::date
      and offer_week_end>=(now() at time zone 'Europe/Dublin')::date;
  if v_previous_current_offers>0 and v_offers<v_previous_current_offers*0.7 then
    return jsonb_build_object('published',false,'national_products',v_products,'national_offers',v_offers,
      'previous_current_offers',v_previous_current_offers,'completed_sources',v_completed_sources,
      'reason','Current national projection fell below 70 percent of the verified current snapshot; previous snapshot preserved');
  end if;

  drop table if exists pg_temp.supervalu_eligible_promotions;
  create temporary table supervalu_eligible_promotions on commit drop as
  select rp.id,c.stores
  from public.retail_promotions rp, public.retail_store_products sp join public.retail_catalog_sync_runs r
      on r.sync_batch_id=sp.sync_batch_id and r.source_store_id=sp.source_store_id
      and r.retail_banner='supervalu' and r.status='completed',supervalu_current_consensus c
    where rp.store_product_id=sp.id and sp.product_id=c.product_id and sp.is_listed
      and sp.source_price_source='supervalu_public_storefront' and sp.last_seen_at>now()-interval '14 days'
      and rp.synced_at>=now()-interval '48 hours' and rp.synced_at<=now() and rp.promotion_type=c.promotion_type
      and rp.loyalty_required=c.loyalty_required and coalesce(rp.loyalty_program,'')=c.loyalty_program
      and coalesce(rp.label,'')=c.label and coalesce(rp.description,'')=c.description
      and (case when rp.promotion_type='multibuy' then null else rp.offer_price_eur end) is not distinct from c.offer_price_eur
      and rp.valid_from=c.valid_from and rp.valid_to=c.valid_to;

  create unique index on supervalu_eligible_promotions(id);
  analyze supervalu_eligible_promotions;
  -- Preserve unchanged national rows instead of rewriting every offer twice.
  update public.retail_promotions rp set scope='store',national_store_count=1
    from public.retail_store_products sp join public.retail_catalog_products p on p.id=sp.product_id
    where rp.store_product_id=sp.id and p.retail_banner='supervalu' and rp.scope='national'
      and not exists(select 1 from supervalu_eligible_promotions e where e.id=rp.id);
  update public.retail_promotions rp set scope='national',national_store_count=e.stores
    from supervalu_eligible_promotions e where rp.id=e.id
      and (rp.scope<>'national' or rp.national_store_count is distinct from e.stores);

  drop table if exists pg_temp.supervalu_campaign_consensus;
  create temporary table supervalu_campaign_consensus on commit drop as
    select * from public.current_retail_campaign_consensus('supervalu');
  create unique index on supervalu_campaign_consensus(sku);
  analyze supervalu_campaign_consensus;
  delete from public.retail_weekly_offers where retail_banner='supervalu' and organization_id is null;
  insert into public.retail_weekly_offers(organization_id,retail_banner,sync_batch_id,product_name,department,
    current_price_eur,was_price_eur,discount_label,price_per_unit,sku,offer_week_start,offer_week_end,source_url,search_text,
    synced_at,offer_channel,service_area,fulfilment,category_breadcrumb,sell_by,price_unit_type,is_alcohol,brand,is_national,national_store_count,campaign_names)
  select null,'supervalu',v_batch,p.product_name,p.department,
    case when c.promotion_type='multibuy' then c.regular_price_eur else c.offer_price_eur end,
    case when c.regular_price_eur>c.offer_price_eur then c.regular_price_eur end,
    nullif(concat_ws(' ',nullif(c.label,''),case when lower(btrim(c.description))<>lower(btrim(c.label)) then nullif(c.description,'') end),''),c.price_per_unit,p.sku,c.valid_from,c.valid_to,p.source_url,
    lower(concat_ws(' ',p.search_text,c.label,c.description,array_to_string(cc.campaign_names,' '))),least(c.observed_at,cc.source_observed_at),
    case when p.service_area='butcher' and p.fulfilment='counter' then 'butcher_counter' when p.service_area='grocery' then 'grocery' else 'prepack' end,
    p.service_area,p.fulfilment,p.category_breadcrumb,p.sell_by,p.price_unit_type,p.is_alcohol,p.brand,true,c.stores,
    coalesce(cc.campaign_names,'{}'::text[])
  from supervalu_current_consensus c join public.retail_catalog_products p on p.id=c.product_id
  left join supervalu_campaign_consensus cc on cc.sku=p.sku
  where c.offer_price_eur is not null or c.promotion_type='multibuy';
  get diagnostics v_offers=row_count;
  update public.organizations set offers_sync_source='supervalu_consensus_national',offers_synced_at=v_observed_at,updated_at=now()
    where niche='retail' and retail_banner='supervalu';
  return jsonb_build_object('published',true,'national_products',v_products,'national_offers',v_offers,'sync_batch_id',v_batch);
end $$;
revoke all on function public.refresh_supervalu_national_scope() from public,anon,authenticated;
grant execute on function public.refresh_supervalu_national_scope() to service_role;



notify pgrst, 'reload schema';
