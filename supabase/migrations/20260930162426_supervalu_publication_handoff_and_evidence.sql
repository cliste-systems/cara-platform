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
  return jsonb_build_object('dispatched',v_dispatched,'checked_at',now());
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
      and not exists(select 1 from public.retail_catalog_category_queue q where q.sync_batch_id=r.sync_batch_id and q.status in ('pending','running'))
    order by (r.metadata->>'refresh_kind'='offers') desc,r.started_at limit 1 for update skip locked;
  if not found then return jsonb_build_object('ok',true,'ready_runs',0); end if;
  select public.finalize_supervalu_catalog_run(v_batch) into v_result;
  update public.retail_catalog_sync_runs set metadata=metadata||jsonb_build_object('publication_result',v_result,'publication_checked_at',now()) where sync_batch_id=v_batch;
  return jsonb_build_object('batch_id',v_batch,'result',v_result);
end $$;
revoke all on function public.publish_ready_supervalu_catalog_run() from public,anon,authenticated;
grant execute on function public.publish_ready_supervalu_catalog_run() to service_role;
