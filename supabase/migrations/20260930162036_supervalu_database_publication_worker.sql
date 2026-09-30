-- Publish outside the short PostgREST request budget, one transaction at a
-- time, without weakening category, pagination or consensus validation.
create or replace function public.refresh_supervalu_national_scope()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_batch uuid:=gen_random_uuid(); v_products integer; v_offers integer; v_observed_at timestamptz;
  v_completed_sources integer; v_previous_current_offers integer;
begin
  -- Serialize snapshot publication; failed transactions leave the prior snapshot intact.
  perform pg_advisory_xact_lock(hashtext('supervalu-national-publication'));
  with presence as (
    select product_id,count(distinct source_store_id) n from public.retail_store_products
    where is_listed and source_price_source='supervalu_public_storefront' and last_seen_at>now()-interval '14 days' group by product_id
  ), prices as (
    select product_id,regular_price_eur,count(distinct source_store_id) n from public.retail_store_products
    where is_listed and source_price_source='supervalu_public_storefront' and last_seen_at>now()-interval '14 days'
      and regular_price_eur is not null group by product_id,regular_price_eur
  ), ranked as (select *,row_number() over(partition by product_id order by n desc,regular_price_eur) rn from prices)
  update public.retail_catalog_products p set is_national=coalesce(pr.n,0)>=3,national_store_count=coalesce(pr.n,0),
    national_regular_price_eur=case when rp.n>=3 then rp.regular_price_eur end,
    national_regular_price_store_count=coalesce(rp.n,0),updated_at=now()
  from public.retail_catalog_products base left join presence pr on pr.product_id=base.id
    left join ranked rp on rp.product_id=base.id and rp.rn=1
  where p.id=base.id and p.retail_banner='supervalu';

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

  update public.retail_promotions rp set scope='store',national_store_count=1
    from public.retail_store_products sp join public.retail_catalog_products p on p.id=sp.product_id
    where rp.store_product_id=sp.id and p.retail_banner='supervalu' and rp.scope='national';
  update public.retail_promotions rp set scope='national',national_store_count=c.stores
    from public.retail_store_products sp join public.retail_catalog_sync_runs r
      on r.sync_batch_id=sp.sync_batch_id and r.source_store_id=sp.source_store_id
      and r.retail_banner='supervalu' and r.status='completed',supervalu_current_consensus c
    where rp.store_product_id=sp.id and sp.product_id=c.product_id and sp.is_listed
      and sp.source_price_source='supervalu_public_storefront' and sp.last_seen_at>now()-interval '14 days'
      and rp.synced_at>=now()-interval '48 hours' and rp.synced_at<=now() and rp.promotion_type=c.promotion_type
      and rp.loyalty_required=c.loyalty_required and coalesce(rp.loyalty_program,'')=c.loyalty_program
      and coalesce(rp.label,'')=c.label and coalesce(rp.description,'')=c.description
      and (case when rp.promotion_type='multibuy' then null else rp.offer_price_eur end) is not distinct from c.offer_price_eur
      and rp.valid_from=c.valid_from and rp.valid_to=c.valid_to;

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
  left join public.current_retail_campaign_consensus('supervalu') cc on cc.sku=p.sku
  where c.offer_price_eur is not null or c.promotion_type='multibuy';
  get diagnostics v_offers=row_count;
  update public.organizations set offers_sync_source='supervalu_consensus_national',offers_synced_at=v_observed_at,updated_at=now()
    where niche='retail' and retail_banner='supervalu';
  return jsonb_build_object('published',true,'national_products',v_products,'national_offers',v_offers,'sync_batch_id',v_batch);
end $$;
revoke all on function public.refresh_supervalu_national_scope() from public,anon,authenticated;
grant execute on function public.refresh_supervalu_national_scope() to service_role;


create or replace function public.publish_ready_supervalu_catalog_run()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_batch uuid; v_result jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('supervalu-national-publication')) then
    return jsonb_build_object('ok',true,'deferred',true);
  end if;
  select r.sync_batch_id into v_batch from public.retail_catalog_sync_runs r
    where r.retail_banner='supervalu' and r.status='running'
      and exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id)
      and not exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id and q.status in ('pending','running'))
    order by r.started_at limit 1 for update skip locked;
  if not found then return jsonb_build_object('ok',true,'ready_runs',0); end if;
  select public.finalize_supervalu_catalog_run(v_batch) into v_result;
  return jsonb_build_object('batch_id',v_batch,'result',v_result);
end $$;
revoke all on function public.publish_ready_supervalu_catalog_run() from public,anon,authenticated;
grant execute on function public.publish_ready_supervalu_catalog_run() to service_role;
select cron.schedule('supervalu-national-catalog-publish','* * * * *',
  'set statement_timeout = ''90s''; select public.publish_ready_supervalu_catalog_run();');
