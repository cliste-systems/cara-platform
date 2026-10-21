begin;
do $$
declare
  org uuid; fixture_call_id uuid := gen_random_uuid(); demo_id uuid := gen_random_uuid();
  room text := 'RT-TEST-admin-overview-'||gen_random_uuid()::text;
  signature_before text; signature_after text; snapshot jsonb; baseline jsonb;
  old_ticket uuid := gen_random_uuid(); today_ticket uuid := gen_random_uuid(); future_ticket uuid := gen_random_uuid();
  day_start timestamptz := date_trunc('day',now() at time zone 'Europe/Dublin') at time zone 'Europe/Dublin';
begin
  select id into org from organizations order by created_at limit 1;
  insert into call_logs(id,organization_id,caller_number,caller_name,created_at,duration_seconds,outcome,engineer_test_call,post_call_status,room_name)
    values(fixture_call_id,org,'+1-555-SMOKE-TEST','[smoke test] admin overview',day_start-interval '1 hour',60,'other',true,'failed',room);
  select signature into signature_before from admin_overview_call_health() h where h.call_id=fixture_call_id;
  if signature_before is null then raise exception 'Older failed call missing from retained health'; end if;
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,3,0,50);
  if exists(select 1 from jsonb_array_elements(snapshot->'issues') item where item->>'callId'=fixture_call_id::text)
    then raise exception 'Yesterday failure appeared in today queue'; end if;
  update call_logs set created_at=day_start where id=fixture_call_id;
  select signature into signature_before from admin_overview_call_health() h where h.call_id=fixture_call_id;
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,50,0,50);
  if not exists(select 1 from jsonb_array_elements(snapshot->'issues') item where item->>'callId'=fixture_call_id::text)
    then raise exception 'Midnight failure missing from today queue'; end if;
  if admin_review_overview_issue(fixture_call_id,repeat('0',32),null) then raise exception 'Stale signature accepted'; end if;
  if not admin_review_overview_issue(fixture_call_id,signature_before,null) then raise exception 'Valid review rejected'; end if;
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,3,0,50);
  if exists(select 1 from jsonb_array_elements(snapshot->'issues') item where item->>'callId'=fixture_call_id::text)
    then raise exception 'Reviewed issue still in queue'; end if;
  update call_logs set post_call_status='partial' where id=fixture_call_id;
  select signature into signature_after from admin_overview_call_health() h where h.call_id=fixture_call_id;
  if signature_after=signature_before then raise exception 'Changed failure did not change signature'; end if;
  if admin_review_overview_issue(fixture_call_id,signature_before,null) then raise exception 'Outdated review accepted after change'; end if;
  insert into call_transcript_captures(id,organization_id,call_log_id,room_name,started_at,status,expected_events,persisted_events)
    values(gen_random_uuid(),org,fixture_call_id,room,day_start,'partial',10,5);
  if not exists(select 1 from admin_overview_call_health() h where h.call_id=fixture_call_id and capture_issue)
    then raise exception 'Incomplete transcript not surfaced'; end if;
  update call_logs set caller_data_erased_at=now() where id=fixture_call_id;
  if exists(select 1 from admin_overview_call_health() h where h.call_id=fixture_call_id)
    then raise exception 'Erased call appeared in overview'; end if;
  insert into admin_live_call_sessions(room_name,organization_id,caller_number,started_at,last_seen_at,active)
    values('admin-demo-'||demo_id::text,org,'+353870000001',day_start-interval '1 minute',now(),true);
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,50,0,3);
  if exists(select 1 from jsonb_array_elements(snapshot->'calls') item where item->>'room_name'='admin-demo-'||demo_id::text)
    then raise exception 'Yesterday live demo appeared in today activity'; end if;
  update admin_live_call_sessions set started_at=day_start where room_name='admin-demo-'||demo_id::text;
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,50,0,50);
  if not exists(select 1 from jsonb_array_elements(snapshot->'calls') item where item->>'room_name'='admin-demo-'||demo_id::text and (item->>'active')::boolean)
    then raise exception 'Today live demo missing'; end if;
  update admin_live_call_sessions set last_seen_at=now()-interval '91 seconds' where room_name='admin-demo-'||demo_id::text;
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,50,0,3);
  if exists(select 1 from jsonb_array_elements(snapshot->'calls') item where item->>'room_name'='admin-demo-'||demo_id::text)
    then raise exception 'Expired demo presence counted as live'; end if;
  baseline := admin_operations_overview(day_start,day_start+interval '1 day',0,50,0,50);
  insert into support_tickets(id,organization_id,subject,body,status,created_at) values
    (old_ticket,org,'[smoke test] yesterday','fixture','open',day_start-interval '1 second'),
    (today_ticket,org,'[smoke test] today','fixture','open',day_start),
    (future_ticket,org,'[smoke test] tomorrow','fixture','open',day_start+interval '1 day');
  snapshot := admin_operations_overview(day_start,day_start+interval '1 day',0,50,0,50);
  if (snapshot#>>'{stats,support}')::int<>(baseline#>>'{stats,support}')::int+1 then raise exception 'Support total is not today-only'; end if;
  if (snapshot->>'issueTotal')::int<>(baseline->>'issueTotal')::int+1 then raise exception 'Queue total includes other days'; end if;
  if not exists(select 1 from jsonb_array_elements(snapshot->'issues') item where item->>'id'='support-'||today_ticket::text)
    or exists(select 1 from jsonb_array_elements(snapshot->'issues') item where item->>'id' in ('support-'||old_ticket::text,'support-'||future_ticket::text)) then
    raise exception 'Support queue boundaries incorrect';
  end if;
  update call_logs set caller_data_erased_at=null,created_at=day_start-interval '1 second' where id=fixture_call_id;
  insert into call_analysis(call_log_id,organization_id,call_created_at,status,verdict,model,checklist_version,input_fingerprint,result)
    values(fixture_call_id,org,day_start-interval '1 second','completed','fail','fixture','today-scope-test','fixture','{}'::jsonb);
  snapshot := admin_operations_overview_for_version(day_start,day_start+interval '1 day','today-scope-test',0,50,0,50);
  if (snapshot#>>'{stats,failedReviews}')::int<>0 then raise exception 'Yesterday failed review counted today'; end if;
  update call_logs set created_at=day_start where id=fixture_call_id;
  -- Engineer fixture trigger removes analysis on updates, so insert it again.
  insert into call_analysis(call_log_id,organization_id,call_created_at,status,verdict,model,checklist_version,input_fingerprint,result)
    values(fixture_call_id,org,day_start,'completed','fail','fixture','today-scope-test','fixture','{}'::jsonb)
    on conflict(call_log_id) do update set status='completed',verdict='fail',checklist_version='today-scope-test';
  snapshot := admin_operations_overview_for_version(day_start,day_start+interval '1 day','today-scope-test',0,50,0,50);
  if (snapshot#>>'{stats,failedReviews}')::int<>1 then raise exception 'Today failed review not counted'; end if;

end;
$$;
rollback;
select 'PASS: today-only queue/totals, support midnight boundaries, today-only reviews, stale review protection, incomplete capture, erasure and live heartbeat expiry; all fixtures rolled back' result;
