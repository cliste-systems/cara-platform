-- Preserve failed source evidence and prevent terminal queues starving future refreshes.
-- Avoid a queue of 27 publishers exhausting the API statement timeout.
create or replace function public.finalize_supervalu_catalog_run(p_sync_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_run public.retail_catalog_sync_runs%rowtype;
  v_kind text; v_queue integer; v_done integer; v_expected integer;
  v_products integer; v_promotions integer; v_previous_full integer; v_reason text;
  v_publication jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('supervalu-national-publication')) then
    return jsonb_build_object('ok',true,'published',false,'deferred',true,'reason','Another source is publishing; the minute scheduler will retry');
  end if;
  select * into strict v_run from public.retail_catalog_sync_runs where sync_batch_id=p_sync_batch_id for update;
  if v_run.retail_banner<>'supervalu' then raise exception 'Not a SuperValu run'; end if;
  perform pg_advisory_xact_lock(hashtext('supervalu-finalize-'||v_run.source_store_id));
  if v_run.status='completed' then
    return jsonb_build_object('ok',true,'already_completed',true,'product_count',v_run.product_count,'promotion_count',v_run.promotion_count);
  end if;
  v_kind:=coalesce(v_run.metadata->>'refresh_kind','full');
  select count(*),count(*) filter(where status='completed') into v_queue,v_done
    from public.retail_catalog_category_queue where sync_batch_id=p_sync_batch_id and source_store_id=v_run.source_store_id;
  -- A transient failed job still has scheduled retries. Never close its run
  -- early or mistake a worker's partial queue for ready-to-publish data.
  if exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=p_sync_batch_id
    and (q.status in ('pending','running') or (q.status='failed' and q.retry_count<3))) then
    return jsonb_build_object('ok',true,'published',false,'deferred',true,'reason','Category work or retries pending');
  end if;
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
    update public.retail_catalog_sync_runs set status='failed',completed_at=now(),error_message=v_reason,
      metadata=metadata||jsonb_build_object('failure_details',(select jsonb_agg(jsonb_build_object('category_id',q.category_id,'category_href',q.category_href,'retry_count',q.retry_count,'error',q.last_error)) from public.retail_catalog_category_queue q where q.sync_batch_id=p_sync_batch_id and q.status<>'completed')) where sync_batch_id=p_sync_batch_id;
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


create or replace function public.run_supervalu_catalog_scheduler()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_config public.retail_catalog_refresh_config%rowtype;
  v_store text; v_batch uuid; v_kind text; v_dispatched integer:=0;
  v_outstanding integer:=0;
  v_failed_batch uuid;
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
      and exists(select 1 from public.retail_catalog_sync_runs r where r.sync_batch_id=retail_catalog_category_queue.sync_batch_id and r.status='running')
      and ((status='running' and updated_at<now()-interval '5 minutes')
        or (status='failed' and updated_at<now()-interval '2 minutes'));
  update public.retail_catalog_category_queue set status='failed',last_error='Worker lease expired after three retries',updated_at=now()
    where source_store_id=any(v_config.source_store_ids) and retry_count>=3 and status='running' and updated_at<now()-interval '5 minutes';
  -- Resolve exhausted runs before dispatching new work. A busy publisher must
  -- not leave a terminal full crawl blocking this store's next offers pass.
  for v_failed_batch in
    select r.sync_batch_id from public.retail_catalog_sync_runs r
    where r.retail_banner='supervalu' and r.status='running'
      and r.source_store_id=any(v_config.source_store_ids)
      and exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id and q.status='failed' and q.retry_count>=3)
      and not exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id and (q.status in ('pending','running') or (q.status='failed' and q.retry_count<3)))
  loop
    update public.retail_catalog_sync_runs r set status='failed',completed_at=now(),
      error_message='Category retries exhausted; incomplete source withheld from publication',
      metadata=r.metadata||jsonb_build_object('failure_details',(
        select jsonb_agg(jsonb_build_object('category_id',q.category_id,'category_href',q.category_href,'retry_count',q.retry_count,'error',q.last_error,'next_page',q.next_page,'next_skip',q.next_skip))
        from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id and q.status<>'completed'
      ),'recovery','Next due offers/full discovery is retried automatically; previous verified snapshot retained')
    where r.sync_batch_id=v_failed_batch;
  end loop;
  select count(*) into v_outstanding from public.retail_catalog_bootstrap_requests
    where source_store_id=any(v_config.source_store_ids)
      and created_at>now()-interval '3 minutes' and result_status is null;
  -- Bound shared ingestion pressure so calls retain database capacity. Oldest
  -- dispatched stores go first; fixed array order must not starve later stores.
  for v_store in
    select s.store_id from unnest(v_config.source_store_ids) s(store_id)
    left join lateral (
      select max(created_at) last_dispatched from public.retail_catalog_bootstrap_requests
      where source_store_id=s.store_id
    ) latest on true
    order by latest.last_dispatched asc nulls first,s.store_id
  loop
    exit when v_dispatched>=greatest(0,v_config.max_concurrent_requests-v_outstanding);
    -- At most one outstanding invocation per store; jobs inside it are bounded.
    if exists(select 1 from public.retail_catalog_bootstrap_requests where source_store_id=v_store
      and created_at>now()-interval '3 minutes' and result_status is null) then continue; end if;
    select q.sync_batch_id,coalesce(r.metadata->>'refresh_kind','full') into v_batch,v_kind
      from public.retail_catalog_category_queue q join public.retail_catalog_sync_runs r on r.sync_batch_id=q.sync_batch_id
      where q.source_store_id=v_store and r.status='running' and q.status='pending' order by r.started_at desc,(q.category_id='PROMOTIONS') desc,q.category_id limit 1;
    if found then
      perform public.dispatch_supervalu_catalog_request(v_store,'work',v_kind,v_batch);
      v_dispatched:=v_dispatched+1; continue;
    end if;
    if exists(select 1 from public.retail_catalog_category_queue where source_store_id=v_store and (status='running' or (status='failed' and retry_count<3))
      and exists(select 1 from public.retail_catalog_sync_runs r where r.sync_batch_id=retail_catalog_category_queue.sync_batch_id and r.status='running')) then continue; end if;
    -- A completed queue can still need its atomic publication after a transient RPC failure.
    select r.sync_batch_id,coalesce(r.metadata->>'refresh_kind','full') into v_batch,v_kind
      from public.retail_catalog_sync_runs r where r.source_store_id=v_store and r.status='running'
        and exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id)
      order by r.started_at desc limit 1;
    if found then
      -- Publication is handled by the database job, without another HTTP call.
      continue;
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
  return jsonb_build_object('dispatched',v_dispatched,'outstanding',v_outstanding,'max_concurrent_requests',v_config.max_concurrent_requests,'checked_at',now());
end $$;
revoke all on function public.run_supervalu_catalog_scheduler() from public,anon,authenticated;
grant execute on function public.run_supervalu_catalog_scheduler() to service_role;


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
      and not exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id and (q.status in ('pending','running') or (q.status='failed' and q.retry_count<3)))
    order by (r.started_at<now()-interval '2 hours') desc,
      case when r.started_at<now()-interval '2 hours' then r.started_at end asc,
      (r.metadata->>'refresh_kind'='offers') desc,r.started_at limit 1 for update skip locked;
  if not found then return jsonb_build_object('ok',true,'ready_runs',0); end if;
  select public.finalize_supervalu_catalog_run(v_batch) into v_result;
  update public.retail_catalog_sync_runs set metadata=metadata||jsonb_build_object('publication_result',v_result,'publication_checked_at',now()) where sync_batch_id=v_batch;
  return jsonb_build_object('batch_id',v_batch,'result',v_result);
end $$;
revoke all on function public.publish_ready_supervalu_catalog_run() from public,anon,authenticated;
grant execute on function public.publish_ready_supervalu_catalog_run() to service_role;
