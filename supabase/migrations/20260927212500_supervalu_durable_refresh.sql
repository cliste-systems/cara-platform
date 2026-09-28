-- Durable, capability-authenticated national crawling; independent of app deploys.
create extension if not exists pg_cron;
create extension if not exists pg_net;
alter table public.retail_catalog_bootstrap_requests
  add column if not exists refresh_kind text not null default 'full'
  check (refresh_kind in ('full','offers'));
alter table public.retail_catalog_category_queue
  add column if not exists retry_count integer not null default 0;
-- A bundle can have an authoritative quantity/total without an agreed unit price.
alter table public.retail_weekly_offers alter column current_price_eur drop not null;
alter table public.retail_weekly_offers
  add column if not exists campaign_names text[] not null default '{}'::text[];

-- Public campaign listings prove membership only. Their regular-price cards do
-- not create promotions and are never used to overwrite storefront offer prices.
-- Retain each batch until its whole source run passes finalization.
create table if not exists public.retail_campaign_memberships (
  retail_banner text not null,
  source_store_id text not null,
  sku text not null check (btrim(sku)<>''),
  campaign_key text not null check (btrim(campaign_key)<>''),
  campaign_name text not null check (btrim(campaign_name)<>''),
  source_url text not null check (source_url ~ '^https://shop[.]supervalu[.]ie/'),
  listing_reference text not null,
  source_listing_id text not null,
  sync_batch_id uuid not null references public.retail_catalog_sync_runs(sync_batch_id) on delete cascade,
  observed_at timestamptz not null,
  source_metadata jsonb not null default '{}'::jsonb,
  primary key(retail_banner,source_store_id,campaign_key,sku,sync_batch_id)
);
create index if not exists retail_campaign_memberships_observed_idx
  on public.retail_campaign_memberships(retail_banner,observed_at,sku);
create index if not exists retail_campaign_memberships_batch_idx
  on public.retail_campaign_memberships(sync_batch_id);
alter table public.retail_campaign_memberships enable row level security;
revoke all on public.retail_campaign_memberships from public,anon,authenticated;
create policy retail_campaign_memberships_service_role on public.retail_campaign_memberships
  for all to service_role using (true) with check (true);
grant select,insert,update,delete on public.retail_campaign_memberships to service_role;

create or replace function public.current_retail_campaign_consensus(p_retail_banner text)
returns table(sku text,campaign_names text[],campaigns jsonb,source_observed_at timestamptz)
language sql stable security invoker set search_path=public,pg_temp as $$
  with verified as (
    select cm.sku,cm.campaign_key,cm.campaign_name,min(cm.source_url) source_url,
      count(distinct cm.source_store_id)::integer source_store_count,min(cm.observed_at) observed_at
    from public.retail_campaign_memberships cm
    join public.retail_catalog_sync_runs r on r.sync_batch_id=cm.sync_batch_id
      and r.source_store_id=cm.source_store_id and r.retail_banner=cm.retail_banner
      and r.status='completed' and r.completed_at<=now()
    where cm.retail_banner=p_retail_banner
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

create or replace function public.claim_retail_catalog_categories(
  p_source_store_id text, p_sync_batch_id uuid, p_limit integer default 3
) returns setof public.retail_catalog_category_queue
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  return query
  with claimed as (
    select q.id from public.retail_catalog_category_queue q
    where q.source_store_id=p_source_store_id and q.sync_batch_id=p_sync_batch_id and q.status='pending'
    order by (q.category_id='PROMOTIONS') desc,(q.category_id like 'CAMPAIGN:%') desc,q.category_id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,3),10))
  )
  update public.retail_catalog_category_queue q
    set status='running',started_at=coalesce(q.started_at,now()),updated_at=now(),last_error=null
    from claimed where q.id=claimed.id returning q.*;
end $$;
revoke all on function public.claim_retail_catalog_categories(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_retail_catalog_categories(text,uuid,integer) to service_role;

create table if not exists public.retail_catalog_refresh_config (
  retail_banner text primary key,
  enabled boolean not null default false,
  function_url text not null check (function_url like 'https://%/functions/v1/supervalu-catalog-bootstrap'),
  source_store_ids text[] not null,
  updated_at timestamptz not null default now()
);
alter table public.retail_catalog_refresh_config enable row level security;
create policy retail_catalog_refresh_config_service_role on public.retail_catalog_refresh_config
  for all to service_role using (true) with check (true);
grant select,insert,update,delete on public.retail_catalog_refresh_config to service_role;

create or replace function public.dispatch_supervalu_catalog_request(
  p_store text, p_mode text, p_kind text, p_batch uuid default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id uuid; v_http bigint; v_url text;
begin
  select function_url into strict v_url from public.retail_catalog_refresh_config where retail_banner='supervalu';
  insert into public.retail_catalog_bootstrap_requests(mode,source_store_id,sync_batch_id,work_limit,refresh_kind)
  values(p_mode,p_store,p_batch,10,p_kind) returning id into v_id;
  select net.http_post(url:=v_url, headers:='{"Content-Type":"application/json"}'::jsonb,
    body:=jsonb_build_object('request_id',v_id), timeout_milliseconds:=120000) into v_http;
  update public.retail_catalog_bootstrap_requests set http_request_id=v_http where id=v_id;
  return v_id;
end $$;
revoke all on function public.dispatch_supervalu_catalog_request(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.dispatch_supervalu_catalog_request(text,text,text,uuid) to service_role;

create or replace function public.request_supervalu_catalog_refresh(
  p_kind text default 'offers', p_store_ids text[] default null
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_store text; v_stores text[]; v_dispatched integer:=0;
begin
  if p_kind not in ('full','offers') then raise exception 'Invalid refresh kind'; end if;
  if not pg_try_advisory_xact_lock(hashtext('supervalu-catalog-scheduler')) then
    return jsonb_build_object('dispatched',0,'reason','scheduler-busy');
  end if;
  select coalesce(p_store_ids,source_store_ids) into strict v_stores
    from public.retail_catalog_refresh_config where retail_banner='supervalu';
  foreach v_store in array v_stores loop
    if not exists(select 1 from public.retail_catalog_category_queue where source_store_id=v_store and (status in ('pending','running') or (status='failed' and retry_count<3)))
      and not exists(select 1 from public.retail_catalog_sync_runs where source_store_id=v_store and status='running')
      and not exists(select 1 from public.retail_catalog_bootstrap_requests where source_store_id=v_store
        and mode='discover' and created_at>now()-interval '5 minutes' and result_status is null) then
      perform public.dispatch_supervalu_catalog_request(v_store,'discover',p_kind);
      v_dispatched:=v_dispatched+1;
    end if;
  end loop;
  return jsonb_build_object('dispatched',v_dispatched,'refresh_kind',p_kind);
end $$;
revoke all on function public.request_supervalu_catalog_refresh(text,text[]) from public,anon,authenticated;
grant execute on function public.request_supervalu_catalog_refresh(text,text[]) to service_role;

create or replace function public.run_supervalu_catalog_scheduler()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_config public.retail_catalog_refresh_config%rowtype;
  v_store text; v_batch uuid; v_kind text; v_dispatched integer:=0;
  v_local timestamp:=now() at time zone 'Europe/Dublin';
  v_full_due timestamptz; v_last_full timestamptz; v_last_offer timestamptz;
  v_last_full_attempt timestamptz; v_last_offer_attempt timestamptz;
  v_offer_interval interval;
begin
  if not pg_try_advisory_xact_lock(hashtext('supervalu-catalog-scheduler')) then
    return jsonb_build_object('dispatched',0,'reason','scheduler-busy');
  end if;
  select * into v_config from public.retail_catalog_refresh_config where retail_banner='supervalu';
  if not found or not v_config.enabled then return jsonb_build_object('dispatched',0,'reason','disabled'); end if;
  -- Start the exhaustive crawl at 20:00 Dublin, before the next midnight changeover.
  v_full_due := ((v_local::date + time '20:00') - case when v_local::time<time '20:00' then interval '1 day' else interval '0' end) at time zone 'Europe/Dublin';
  v_offer_interval:=case when extract(isodow from v_local)=4 then interval '15 minutes' else interval '1 hour' end;
  -- Recover crashed workers and retry transient source failures, with a finite cap.
  update public.retail_catalog_category_queue set status='pending',retry_count=retry_count+1,updated_at=now()
    where source_store_id=any(v_config.source_store_ids) and retry_count<3
      and ((status='running' and updated_at<now()-interval '5 minutes')
        or (status='failed' and updated_at<now()-interval '2 minutes'));
  update public.retail_catalog_category_queue set status='failed',last_error='Worker lease expired after three retries',updated_at=now()
    where source_store_id=any(v_config.source_store_ids) and retry_count>=3 and status='running' and updated_at<now()-interval '5 minutes';
  foreach v_store in array v_config.source_store_ids loop
    -- At most one outstanding invocation per store; jobs inside it are bounded.
    if exists(select 1 from public.retail_catalog_bootstrap_requests where source_store_id=v_store
      and created_at>now()-interval '3 minutes' and result_status is null) then continue; end if;
    select q.sync_batch_id,coalesce(r.metadata->>'refresh_kind','full') into v_batch,v_kind
      from public.retail_catalog_category_queue q join public.retail_catalog_sync_runs r on r.sync_batch_id=q.sync_batch_id
      where q.source_store_id=v_store and q.status='pending' order by r.started_at desc,(q.category_id='PROMOTIONS') desc,q.category_id limit 1;
    if found then
      update public.retail_catalog_sync_runs set status='running',completed_at=null where sync_batch_id=v_batch and status='failed';
      perform public.dispatch_supervalu_catalog_request(v_store,'work',v_kind,v_batch);
      v_dispatched:=v_dispatched+1; continue;
    end if;
    if exists(select 1 from public.retail_catalog_category_queue where source_store_id=v_store and (status='running' or (status='failed' and retry_count<3))) then continue; end if;
    -- A completed queue can still need its atomic publication after a transient RPC failure.
    select r.sync_batch_id,coalesce(r.metadata->>'refresh_kind','full') into v_batch,v_kind
      from public.retail_catalog_sync_runs r where r.source_store_id=v_store and r.status='running'
        and exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id)
      order by r.started_at desc limit 1;
    if found then
      perform public.dispatch_supervalu_catalog_request(v_store,'work',v_kind,v_batch);
      v_dispatched:=v_dispatched+1; continue;
    end if;
    -- Discovery can fail between creating its run and inserting the queue.
    update public.retail_catalog_sync_runs r set status='failed',completed_at=now(),error_message='Discovery produced no category queue'
      where r.source_store_id=v_store and r.status='running'
        and not exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id);
    select max(completed_at) filter(where status='completed' and coalesce(metadata->>'refresh_kind','full')='full'),
      max(completed_at) filter(where status='completed'),
      max(started_at) filter(where coalesce(metadata->>'refresh_kind','full')='full'),
      max(started_at) filter(where coalesce(metadata->>'refresh_kind','full')='offers')
      into v_last_full,v_last_offer,v_last_full_attempt,v_last_offer_attempt
      from public.retail_catalog_sync_runs where source_store_id=v_store and retail_banner='supervalu';
    -- Due dates reflect successful completion. Failed attempts only impose a bounded cooldown.
    -- Refresh current offers first: a repeatedly failing full category must
    -- not starve the smaller promotion-only pass on Thursday or any other day.
    if coalesce(v_last_offer,'epoch'::timestamptz)<now()-v_offer_interval
      and coalesce(v_last_offer_attempt,'epoch'::timestamptz)<now()-v_offer_interval then v_kind:='offers';
    elsif coalesce(v_last_full,'epoch'::timestamptz)<v_full_due
      and coalesce(v_last_full_attempt,'epoch'::timestamptz)<now()-interval '1 hour' then v_kind:='full';
    else continue; end if;
    perform public.dispatch_supervalu_catalog_request(v_store,'discover',v_kind);
    v_dispatched:=v_dispatched+1;
  end loop;
  delete from public.retail_catalog_bootstrap_requests where created_at<now()-interval '14 days';
  return jsonb_build_object('dispatched',v_dispatched,'checked_at',now());
end $$;
revoke all on function public.run_supervalu_catalog_scheduler() from public,anon,authenticated;
grant execute on function public.run_supervalu_catalog_scheduler() to service_role;

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

-- Retire missing listings and publish only after a complete, credible source crawl.
create or replace function public.finalize_supervalu_catalog_run(p_sync_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_run public.retail_catalog_sync_runs%rowtype;
  v_kind text; v_queue integer; v_done integer; v_expected integer;
  v_products integer; v_promotions integer; v_previous_full integer; v_reason text;
  v_publication jsonb;
begin
  select * into strict v_run from public.retail_catalog_sync_runs where sync_batch_id=p_sync_batch_id for update;
  if v_run.retail_banner<>'supervalu' then raise exception 'Not a SuperValu run'; end if;
  perform pg_advisory_xact_lock(hashtext('supervalu-finalize-'||v_run.source_store_id));
  if v_run.status='completed' then
    return jsonb_build_object('ok',true,'already_completed',true,'product_count',v_run.product_count,'promotion_count',v_run.promotion_count);
  end if;
  v_kind:=coalesce(v_run.metadata->>'refresh_kind','full');
  select count(*),count(*) filter(where status='completed') into v_queue,v_done
    from public.retail_catalog_category_queue where sync_batch_id=p_sync_batch_id and source_store_id=v_run.source_store_id;
  v_expected:=case when coalesce(v_run.metadata->>'category_count','') ~ '^[0-9]+$' then (v_run.metadata->>'category_count')::integer else v_queue end;
  select count(*) into v_products from public.retail_store_products
    where source_store_id=v_run.source_store_id and is_listed and last_seen_at>=v_run.started_at
      and source_price_source='supervalu_public_storefront';
  -- Product cards alone do not prove the promotions payload was parsed correctly.
  -- Inspect this run's observed, date-current offers before any destructive cleanup.
  select count(*) into v_promotions from public.retail_promotions rp join public.retail_store_products sp on sp.id=rp.store_product_id
    where sp.source_store_id=v_run.source_store_id and sp.is_listed
      and sp.source_price_source='supervalu_public_storefront' and sp.last_seen_at>=v_run.started_at
      and rp.synced_at>=v_run.started_at
      and rp.valid_from<=(now() at time zone 'Europe/Dublin')::date and rp.valid_to>=(now() at time zone 'Europe/Dublin')::date;
  select product_count into v_previous_full from public.retail_catalog_sync_runs
    where retail_banner='supervalu' and source_store_id=v_run.source_store_id and status='completed'
      and coalesce(metadata->>'refresh_kind','full')='full' and sync_batch_id<>p_sync_batch_id
    order by completed_at desc limit 1;
  if v_queue=0 or v_queue<>v_expected or v_done<>v_queue then
    v_reason:=format('Incomplete category queue: %s completed of %s present, %s expected',v_done,v_queue,v_expected);
  elsif v_products < (case when v_kind='full' then 1000 else 100 end) then
    v_reason:=format('Source coverage too small for %s refresh: %s products',v_kind,v_products);
  elsif v_promotions<100 then
    v_reason:=format('Current promotion coverage too small for %s refresh: %s promotions',v_kind,v_promotions);
  elsif v_kind='full' and coalesce(v_previous_full,0)>0 and v_products<v_previous_full*0.7 then
    v_reason:=format('Full source coverage fell below 70 percent of prior complete full run: %s of %s',v_products,v_previous_full);
  end if;
  if v_reason is not null then
    update public.retail_catalog_sync_runs set status='failed',completed_at=now(),error_message=v_reason where sync_batch_id=p_sync_batch_id;
    return jsonb_build_object('ok',false,'published',false,'error',v_reason,'product_count',v_products,'promotion_count',v_promotions);
  end if;
  -- Take the global publication lock before changing rows publication also updates.
  -- Otherwise concurrent store finalizations can deadlock while waiting to publish.
  perform pg_advisory_xact_lock(hashtext('supervalu-national-publication'));
  if v_kind='full' then
    update public.retail_store_products set is_listed=false,updated_at=now()
      where source_store_id=v_run.source_store_id and source_price_source='supervalu_public_storefront'
        and is_listed and last_seen_at<v_run.started_at;
  end if;
  delete from public.retail_promotions rp using public.retail_store_products sp
    where rp.store_product_id=sp.id and sp.source_store_id=v_run.source_store_id
      and sp.source_price_source='supervalu_public_storefront' and rp.synced_at<v_run.started_at;
  -- A zero-item campaign is authoritative only after its fully paginated queue job
  -- succeeds. Missing/failed discovery must not erase prior campaign evidence.
  delete from public.retail_campaign_memberships cm
    where cm.retail_banner=v_run.retail_banner and cm.source_store_id=v_run.source_store_id
      and cm.sync_batch_id<>p_sync_batch_id and cm.observed_at<v_run.started_at
      and exists(select 1 from public.retail_catalog_category_queue q
        where q.sync_batch_id=p_sync_batch_id and q.source_store_id=v_run.source_store_id
          and q.retail_banner=v_run.retail_banner and q.status='completed'
          and q.category_id='CAMPAIGN:'||cm.campaign_key);
  update public.retail_catalog_sync_runs set status='completed',completed_at=now(),error_message=null,
    product_count=v_products,promotion_count=v_promotions where sync_batch_id=p_sync_batch_id;
  -- An exception here rolls back retirement, cleanup, and run completion together.
  select public.refresh_supervalu_national_scope() into v_publication;
  return jsonb_build_object('ok',true,'product_count',v_products,'promotion_count',v_promotions,'national_refresh',v_publication);
end $$;
revoke all on function public.finalize_supervalu_catalog_run(uuid) from public,anon,authenticated;
grant execute on function public.finalize_supervalu_catalog_run(uuid) to service_role;

-- Read-only operational evidence. Full-range coverage comes from completed full runs,
-- never from raw product counts or a completed offers-only pass.
create or replace function public.supervalu_catalog_health()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with config as (
  select enabled,source_store_ids from public.retail_catalog_refresh_config where retail_banner='supervalu'
), configured_stores as (
  select distinct unnest(source_store_ids) source_store_id from config
), current_offers as (
  select * from public.retail_weekly_offers where retail_banner='supervalu' and organization_id is null and is_national
    and offer_week_start<=(now() at time zone 'Europe/Dublin')::date
    and offer_week_end>=(now() at time zone 'Europe/Dublin')::date
), departments as (
  select coalesce(nullif(department,''),'Unclassified') department,service_area,fulfilment,
    count(*) offer_count,count(distinct sku) product_count,min(synced_at) oldest_observed_at,max(synced_at) newest_observed_at
  from current_offers group by coalesce(nullif(department,''),'Unclassified'),service_area,fulfilment
), source_runs as (
  select s.source_store_id,
    count(r.id) filter(where r.status='running') running_runs,
    count(r.id) filter(where r.status='failed' and r.started_at>now()-interval '24 hours') failed_runs_24h,
    count(r.id) filter(where r.status='completed' and r.completed_at>now()-interval '24 hours') completed_runs_24h,
    max(r.started_at) latest_attempt_at,
    coalesce((array_agg(r.metadata->'coverage_report' order by r.started_at desc) filter(where r.id is not null))[1],'{}'::jsonb) latest_coverage_report,
    coalesce((array_agg(r.metadata->'campaign_discovery' order by r.started_at desc) filter(where r.id is not null))[1],'{}'::jsonb) latest_campaign_discovery,
    max(r.completed_at) filter(where r.status='completed' and coalesce(r.metadata->>'refresh_kind','full')='full') last_full_completed_at,
    max(r.completed_at) filter(where r.status='completed' and r.metadata->>'refresh_kind'='offers') last_offers_completed_at
  from configured_stores s left join public.retail_catalog_sync_runs r on r.source_store_id=s.source_store_id and r.retail_banner='supervalu'
  group by s.source_store_id
), source_queue as (
  select s.source_store_id,count(q.id) filter(where q.status='pending') pending_jobs,
    count(q.id) filter(where q.status='running') running_jobs,
    count(q.id) filter(where q.status='failed') failed_jobs,
    count(q.id) filter(where q.status='failed' and q.retry_count>=3) exhausted_jobs
  from configured_stores s left join public.retail_catalog_category_queue q on q.source_store_id=s.source_store_id and q.retail_banner='supervalu'
  group by s.source_store_id
)
select jsonb_build_object(
  'checked_at',now(),'today_dublin',(now() at time zone 'Europe/Dublin')::date,
  'scheduler_enabled',coalesce((select enabled from config),false),
  'configured_source_count',(select count(*) from configured_stores),
  'national_range',jsonb_build_object(
    'product_count',(select count(*) from public.retail_catalog_products where retail_banner='supervalu' and is_national),
    'all_sources_have_completed_full_run',coalesce((select count(*)>0 and bool_and(last_full_completed_at is not null) from source_runs),false),
    'all_sources_have_recent_full_run',coalesce((select count(*)>0 and bool_and(coalesce(last_full_completed_at>=now()-interval '48 hours',false)) from source_runs),false)
  ),
  'current_national_offers',(select jsonb_build_object(
    'offer_count',count(*),'product_count',count(distinct sku),
    'oldest_observed_at',min(synced_at),'newest_observed_at',max(synced_at),
    'earliest_valid_from',min(offer_week_start),'latest_valid_to',max(offer_week_end),
    'missing_single_item_price_count',count(*) filter(where current_price_eur is null)
  ) from current_offers),
  'departments',coalesce((select jsonb_agg(to_jsonb(d) order by department,service_area,fulfilment) from departments d),'[]'::jsonb),
  -- Preserve page/request-level warnings: an otherwise successful run does not
  -- prove coverage of coupons, points, basket offers, or unresolved leaflet links.
  'recent_source_reports',coalesce((select jsonb_agg(to_jsonb(report) order by created_at desc) from (
    select b.source_store_id,b.mode,b.refresh_kind,b.created_at,b.result_status,
      b.result_summary->'coverage_report' coverage_report,
      b.result_summary->'campaign_discovery' campaign_discovery
    from public.retail_catalog_bootstrap_requests b
    where b.source_store_id in (select source_store_id from configured_stores)
      and b.created_at>=now()-interval '24 hours'
      and (b.result_summary ? 'coverage_report' or b.result_summary ? 'campaign_discovery')
    order by b.created_at desc limit 100
  ) report),'[]'::jsonb),
  'runs',jsonb_build_object(
    'running',(select count(*) from public.retail_catalog_sync_runs where retail_banner='supervalu' and status='running'),
    'failed_24h',(select count(*) from public.retail_catalog_sync_runs where retail_banner='supervalu' and status='failed' and started_at>now()-interval '24 hours'),
    'completed_24h',(select count(*) from public.retail_catalog_sync_runs where retail_banner='supervalu' and status='completed' and completed_at>now()-interval '24 hours')
  ),
  'sources',coalesce((select jsonb_agg(to_jsonb(r)||to_jsonb(q) order by r.source_store_id) from source_runs r join source_queue q using(source_store_id)),'[]'::jsonb)
);
$$;
revoke all on function public.supervalu_catalog_health() from public,anon,authenticated;
grant execute on function public.supervalu_catalog_health() to service_role;

-- Preserve the RPC signature while returning the oldest actual observation
-- contributing to each consensus offer; callers can enforce per-offer freshness.
create or replace function public.search_retail_promotions_consensus(
  p_retail_banner text,
  p_mechanic text,
  p_loyalty_required boolean default false,
  p_quantity numeric default null,
  p_total_eur numeric default null,
  p_percent numeric default null,
  p_amount_eur numeric default null,
  p_named_phrase text default null,
  p_service_area text default null,
  p_fulfilment text default null,
  p_subject_tokens text[] default '{}'::text[],
  p_reference_date date default current_date,
  p_limit integer default 16
)
returns table (
  product_id uuid,
  product_name text,
  department text,
  sku text,
  service_area text,
  fulfilment text,
  is_alcohol boolean,
  promotion_type text,
  loyalty_required boolean,
  loyalty_program text,
  label text,
  description text,
  offer_price_eur numeric,
  regular_price_eur numeric,
  display_price_eur numeric,
  price_per_unit text,
  source_store_count integer,
  valid_from date,
  valid_to date,
  source_metadata jsonb
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
with campaign_evidence as materialized (
  select * from public.current_retail_campaign_consensus(p_retail_banner)
), candidates as (
  select
    p.id as product_id,
    p.product_name,
    p.department,
    p.sku,
    p.service_area,
    p.fulfilment,
    p.is_alcohol,
    p.search_text,
    sp.source_store_id,
    sp.display_price_eur,
    sp.price_per_unit,
    case
      when rp.promotion_type='multibuy' then null
      else coalesce(sp.regular_price_eur, rp.regular_price_eur)
    end as regular_price_eur,
    rp.promotion_type,
    rp.loyalty_required,
    rp.loyalty_program,
    rp.label,
    rp.description,
    rp.offer_price_eur,
    rp.valid_from,
    rp.valid_to,
    coalesce(rp.source_metadata,'{}'::jsonb)
      || jsonb_build_object('campaigns',coalesce(cc.campaigns,'[]'::jsonb)) as source_metadata,
    cc.campaign_names,
    least(rp.synced_at,cc.source_observed_at) as source_observed_at,
    case
      when rp.promotion_type='multibuy'
        or coalesce(rp.label,'') ~* '^\s*[0-9]+\s+for\s+'
      then null
      else coalesce(rp.offer_price_eur, sp.display_price_eur)
    end as effective_offer_price_eur,
    coalesce(
      nullif(rp.source_metadata->>'multibuy_quantity','')::numeric,
      ((regexp_match(coalesce(rp.label,''), '(?i)([0-9]+)\s+for\s+(?:€\s*)?([0-9]+(?:[.,][0-9]{1,2})?)'))[1])::numeric
    ) as multibuy_quantity,
    coalesce(
      nullif(rp.source_metadata->>'multibuy_total_eur','')::numeric,
      replace(((regexp_match(coalesce(rp.label,''), '(?i)([0-9]+)\s+for\s+(?:€\s*)?([0-9]+(?:[.,][0-9]{1,2})?)'))[2]), ',', '.')::numeric
    ) as multibuy_total_eur,
    coalesce(
      nullif(rp.source_metadata->>'save_percent','')::numeric,
      replace(((regexp_match(coalesce(rp.label,''), '(?i)save\s+([0-9]+(?:[.,][0-9]+)?)\s*%'))[1]), ',', '.')::numeric
    ) as save_percent,
    coalesce(
      nullif(rp.source_metadata->>'save_amount_eur','')::numeric,
      replace(((regexp_match(coalesce(rp.label,''), '(?i)save\s+€\s*([0-9]+(?:[.,][0-9]{1,2})?)'))[1]), ',', '.')::numeric,
      (((regexp_match(coalesce(rp.label,''), '(?i)save\s+([0-9]{1,2})\s*c'))[1])::numeric / 100)
    ) as save_amount_eur
  from public.retail_promotions rp
  join public.retail_store_products sp on sp.id=rp.store_product_id
  join public.retail_catalog_sync_runs r on r.sync_batch_id=sp.sync_batch_id and r.source_store_id=sp.source_store_id
    and r.retail_banner=p_retail_banner and r.status='completed'
  join public.retail_catalog_products p on p.id=sp.product_id
  left join campaign_evidence cc on cc.sku=p.sku
  where p.retail_banner=p_retail_banner
    and p.is_national=true
    and sp.is_listed=true
    and sp.source_price_source='supervalu_public_storefront'
    and sp.last_seen_at>=now()-interval '14 days'
    and rp.synced_at>=now()-interval '48 hours' and rp.synced_at<=now()
    and rp.valid_from<=(now() at time zone 'Europe/Dublin')::date
    and rp.valid_to>=(now() at time zone 'Europe/Dublin')::date
    and rp.valid_from <= p_reference_date
    and rp.valid_to >= p_reference_date
    and (p_service_area is null or p.service_area=p_service_area)
    and (p_fulfilment is null or p.fulfilment=p_fulfilment)
    and (
      coalesce(cardinality(p_subject_tokens),0)=0
      or not exists (
        select 1
        from unnest(p_subject_tokens) token
        where p.search_text not ilike '%' || token || '%'
      )
    )
),
filtered as (
  select *
  from candidates c
  where
    (not p_loyalty_required or c.loyalty_required=true)
    and (
      p_mechanic is null
      or p_mechanic='unstructured'
      or (
        p_mechanic='multibuy'
        and (
          c.promotion_type='multibuy'
          or coalesce(c.label,'') ~* '^\s*[0-9]+\s+for\s+'
        )
        and (p_quantity is null or c.multibuy_quantity=p_quantity)
        and (
          p_total_eur is null
          or abs(c.multibuy_total_eur-p_total_eur) <= 0.02
        )
      )
      or (
        p_mechanic='loyalty'
        and c.loyalty_required=true
        and (
          p_amount_eur is null
          or abs(coalesce(c.offer_price_eur,c.display_price_eur)-p_amount_eur) <= 0.02
        )
      )
      or (
        p_mechanic='half_price'
        and (
          coalesce(c.label,'') ~* 'half\s+price'
          or c.save_percent=50
          or coalesce(c.label,'') ~* '50\s*%\s*off'
        )
      )
      or (
        p_mechanic='save_percent'
        and c.save_percent is not null
        and (p_percent is null or abs(c.save_percent-p_percent) <= 0.01)
      )
      or (
        p_mechanic='save_amount'
        and c.save_amount_eur is not null
        and (p_amount_eur is null or abs(c.save_amount_eur-p_amount_eur) <= 0.01)
      )
      or (
        p_mechanic='fixed_price'
        and coalesce(c.label,'') ~* '(^\s*only(?:\s|$)|rewards?\s+price\s+only(?:\s|$))'
        and (
          p_amount_eur is null
          or abs(coalesce(c.offer_price_eur,c.display_price_eur)-p_amount_eur) <= 0.02
        )
      )
      or (
        p_mechanic='named'
        and p_named_phrase is not null
        and regexp_replace(lower(concat_ws(' ',c.label,c.description,array_to_string(c.campaign_names,' '))),'[[:space:]]+',' ','g')
          like '%' || lower(p_named_phrase) || '%'
      )
    )
),
consensus as (
  select
    f.product_id,
    f.product_name,
    f.department,
    f.sku,
    f.service_area,
    f.fulfilment,
    f.is_alcohol,
    f.promotion_type,
    f.loyalty_required,
    f.loyalty_program,
    f.label,
    f.description,
    case
      when max(f.effective_offer_price_eur) is null then null
      when max(f.effective_offer_price_eur) - min(f.effective_offer_price_eur) <= 0.02
        then round(avg(f.effective_offer_price_eur), 2)
      else null
    end as effective_offer_price_eur,
    case
      when max(f.regular_price_eur) is null then null
      when max(f.regular_price_eur) - min(f.regular_price_eur) <= 0.02
        then round(avg(f.regular_price_eur), 2)
      else null
    end as regular_price_eur,
    f.valid_from,
    f.valid_to,
    count(distinct f.source_store_id)::integer as source_store_count,
    case
      when max(f.display_price_eur) is null then null
      when max(f.display_price_eur) - min(f.display_price_eur) <= 0.02
        then round(avg(f.display_price_eur), 2)
      else null
    end as display_price_eur,
    case
      when count(distinct f.price_per_unit) filter (where f.price_per_unit is not null) <= 1
        then max(f.price_per_unit)
      else null
    end as price_per_unit,
    coalesce((array_agg(f.source_metadata order by f.source_store_id))[1],'{}'::jsonb)
      || jsonb_build_object('source_observed_at',min(f.source_observed_at)) as source_metadata
  from filtered f
  group by
    f.product_id,
    f.product_name,
    f.department,
    f.sku,
    f.service_area,
    f.fulfilment,
    f.is_alcohol,
    f.promotion_type,
    f.loyalty_required,
    f.loyalty_program,
    f.label,
    f.description,
    f.valid_from,
    f.valid_to
  having count(distinct f.source_store_id) >= 3
)
select
  c.product_id,
  c.product_name,
  c.department,
  c.sku,
  c.service_area,
  c.fulfilment,
  c.is_alcohol,
  c.promotion_type,
  c.loyalty_required,
  c.loyalty_program,
  c.label,
  c.description,
  c.effective_offer_price_eur as offer_price_eur,
  c.regular_price_eur,
  c.display_price_eur,
  c.price_per_unit,
  c.source_store_count,
  c.valid_from,
  c.valid_to,
  c.source_metadata
from consensus c
order by c.source_store_count desc, c.department, c.product_name
limit greatest(1,least(coalesce(p_limit,16),50));
$$;

revoke all on function public.search_retail_promotions_consensus(
  text,text,boolean,numeric,numeric,numeric,numeric,text,text,text,text[],date,integer
) from public,anon,authenticated;

grant execute on function public.search_retail_promotions_consensus(
  text,text,boolean,numeric,numeric,numeric,numeric,text,text,text,text[],date,integer
) to service_role;

comment on function public.search_retail_promotions_consensus(
  text,text,boolean,numeric,numeric,numeric,numeric,text,text,text,text[],date,integer
) is
  'Consensus-backed generic retail promotion search. Supports multibuy, loyalty, half-price, percentage, money-off, fixed-price and named promotion mechanics without flattening bundle offers into per-item prices.';

-- Config is enabled only after the matching Edge Function has been deployed.
select cron.schedule('supervalu-national-catalog-refresh','* * * * *','select public.run_supervalu_catalog_scheduler();');
