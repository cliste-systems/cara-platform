-- Run with the recovery migration inside BEGIN / ROLLBACK. No fixtures persist.
-- Acquire the publication and scheduler transaction locks first so live cron
-- contention does not masquerade as a retry failure in these isolated tests.
create temporary table recovery_dispatches(store_id text, mode text, kind text);
create or replace function public.dispatch_supervalu_catalog_request(p_store text,p_mode text,p_kind text,p_batch uuid default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
begin insert into recovery_dispatches values(p_store,p_mode,p_kind); return gen_random_uuid(); end $$;

do $$
declare b uuid:=gen_random_uuid(); result jsonb;
begin
  insert into public.retail_catalog_sync_runs(retail_banner,source_store_id,sync_batch_id,status,metadata)
    values('supervalu','RECOVERY-TEST',b,'running','{"category_count":1,"refresh_kind":"full"}');
  insert into public.retail_catalog_category_queue(source_store_id,sync_batch_id,category_id,category_name,category_href,status,retry_count,last_error,updated_at)
    values('RECOVERY-TEST',b,'TEST','[smoke test] recovery','/test','failed',1,'Incomplete storefront page',now()-interval '10 minutes');
  result:=public.finalize_supervalu_catalog_run(b);
  if result->>'deferred'<>'true' or (select status from public.retail_catalog_sync_runs where sync_batch_id=b)<>'running' then
    raise exception 'Retryable category was finalized prematurely'; end if;
  update public.retail_catalog_refresh_config set enabled=true,source_store_ids=array['RECOVERY-TEST'] where retail_banner='supervalu';
  perform public.run_supervalu_catalog_scheduler();
  if not exists(select 1 from recovery_dispatches where mode='work') or not exists(select 1 from public.retail_catalog_category_queue where sync_batch_id=b and status='pending' and retry_count=2) then
    raise exception 'Transient failure not retried'; end if;
  truncate recovery_dispatches;
  update public.retail_catalog_category_queue set status='failed',retry_count=3 where sync_batch_id=b;
  perform public.run_supervalu_catalog_scheduler();
  if (select status from public.retail_catalog_sync_runs where sync_batch_id=b)<>'failed' then raise exception 'Exhausted queue still blocking store'; end if;
  if not exists(select 1 from public.retail_catalog_sync_runs where sync_batch_id=b and metadata->'failure_details'->0->>'error'='Incomplete storefront page') then raise exception 'Failure evidence not preserved'; end if;
  if not exists(select 1 from recovery_dispatches where mode='discover' and kind='offers') then raise exception 'Exhausted full import prevented fresh offers discovery'; end if;
  truncate recovery_dispatches;
  update public.retail_catalog_category_queue set status='failed',retry_count=0,updated_at=now()-interval '10 minutes' where sync_batch_id=b;
  perform public.run_supervalu_catalog_scheduler();
  if exists(select 1 from recovery_dispatches where mode='work') then raise exception 'Inactive batch revived by scheduler'; end if;
  if has_function_privilege('anon','public.run_supervalu_catalog_scheduler()','execute') or has_function_privilege('authenticated','public.finalize_supervalu_catalog_run(uuid)','execute') then raise exception 'Internal functions publicly executable'; end if;
  -- Exhausted failure is explicit and never published, even when called directly.
  update public.retail_catalog_category_queue set retry_count=3 where sync_batch_id=b;
  result:=public.finalize_supervalu_catalog_run(b);
  if result->>'published'<>'false' or result->>'ok'<>'false' then raise exception 'Incomplete import accepted'; end if;
end $$;
select 'PASS: transient retry, terminal release, evidence retention, offers recovery, inactive batch isolation, access restrictions, incomplete publication refusal' result;

-- Stub only within the rollback transaction to test selection without rebuilding
-- the national catalogue or publishing synthetic products.
create or replace function public.finalize_supervalu_catalog_run(p_sync_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
begin return jsonb_build_object('selected_batch',p_sync_batch_id); end $$;
do $$
declare full_batch uuid:=gen_random_uuid(); offers_batch uuid:=gen_random_uuid(); retry_batch uuid:=gen_random_uuid(); result jsonb;
begin
  insert into public.retail_catalog_sync_runs(retail_banner,source_store_id,sync_batch_id,status,started_at,metadata) values
    ('supervalu','FAIRNESS-TEST-FULL',full_batch,'running','1970-01-01','{"category_count":1,"refresh_kind":"full"}'),
    ('supervalu','FAIRNESS-TEST-OFFERS',offers_batch,'running','1970-01-02','{"category_count":1,"refresh_kind":"offers"}'),
    ('supervalu','FAIRNESS-TEST-RETRY',retry_batch,'running','1960-01-01','{"category_count":1,"refresh_kind":"offers"}');
  insert into public.retail_catalog_category_queue(source_store_id,sync_batch_id,category_id,category_name,category_href,status,retry_count) values
    ('FAIRNESS-TEST-FULL',full_batch,'TEST','[smoke test] fairness','/test','completed',0),
    ('FAIRNESS-TEST-OFFERS',offers_batch,'TEST','[smoke test] fairness','/test','completed',0),
    ('FAIRNESS-TEST-RETRY',retry_batch,'TEST','[smoke test] fairness','/test','failed',1);
  result:=public.publish_ready_supervalu_catalog_run();
  if result->>'batch_id'<>full_batch::text then raise exception 'Old full import starved or retryable failure selected: %',result; end if;
end $$;
select 'PASS: aged full publication cannot starve; retryable failure never selected' result;
