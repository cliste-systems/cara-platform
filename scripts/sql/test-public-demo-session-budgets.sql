-- Synthetic fixtures and time-travel assertions; run with the migration inside a rollback transaction.
do $$ declare v_org uuid:=gen_random_uuid(); begin
  insert into public.organizations(id,name,slug,tier,is_active)
    values(v_org,'[smoke test] Anti-extraction budget','rt-test-demo-budget-'||v_org::text,'native',false);
  perform set_config('cara.demo_test_org',v_org::text,true);
end $$;
set local role service_role;
do $$
declare
  org uuid:=current_setting('cara.demo_test_org')::uuid;
  k text;
  r jsonb;
  before_seconds integer;
  after_seconds integer;
  day_key date:=(clock_timestamp() at time zone 'UTC')::date;
  i integer;
begin
  for i in 1..3 loop
    k:=md5('call-'||i)||md5('salt-'||i);
    r:=public.reserve_public_demo_session(org,k);
    if (r->>'allowed')::boolean is not true then raise exception 'Valid demo % refused',i;end if;
  end loop;
  r:=public.reserve_public_demo_session(org,md5('call-1')||md5('salt-1'));
  if (r->>'allowed')::boolean is not true then raise exception 'Retry lost existing lease';end if;
  if (select starts from private.public_demo_daily_budgets where organization_id=org and budget_day=day_key)<>3 then
    raise exception 'Duplicate reservation spent a second start';end if;
  r:=public.reserve_public_demo_session(org,md5('call-4')||md5('salt-4'));
  if r->>'reason'<>'busy' then raise exception 'Concurrency cap failed';end if;
  perform public.release_public_demo_session(org,md5('call-1')||md5('salt-1'));
  select reserved_seconds into before_seconds from private.public_demo_daily_budgets where organization_id=org and budget_day=day_key;
  perform public.release_public_demo_session(org,md5('call-1')||md5('salt-1'));
  select reserved_seconds into after_seconds from private.public_demo_daily_budgets where organization_id=org and budget_day=day_key;
  if before_seconds<>after_seconds or before_seconds>962 then raise exception 'Release refund/idempotency failed';end if;
  r:=public.reserve_public_demo_session(org,md5('call-4')||md5('salt-4'));
  if (r->>'allowed')::boolean is not true then raise exception 'Freed slot was not reusable';end if;
  update private.public_demo_sessions set expires_at=clock_timestamp()-interval '1 second'
    where organization_id=org and session_key=md5('call-2')||md5('salt-2');
  r:=public.reserve_public_demo_session(org,md5('call-5')||md5('salt-5'));
  if (r->>'allowed')::boolean is not true then raise exception 'Expired slot did not recover';end if;
  for i in 3..5 loop perform public.release_public_demo_session(org,md5('call-'||i)||md5('salt-'||i));end loop;
  r:=public.reserve_public_demo_session(org,md5('call-2')||md5('salt-2'));
  if r->>'reason'<>'ended' then raise exception 'Expired room was resurrected';end if;
  update private.public_demo_daily_budgets set starts=60,reserved_seconds=0 where organization_id=org and budget_day=day_key;
  r:=public.reserve_public_demo_session(org,md5('call-6')||md5('salt-6'));
  if r->>'reason'<>'daily_limit' then raise exception 'Daily-start cap failed';end if;
  update private.public_demo_daily_budgets set starts=0,reserved_seconds=6721 where organization_id=org and budget_day=day_key;
  r:=public.reserve_public_demo_session(org,md5('call-6')||md5('salt-6'));
  if r->>'reason'<>'daily_limit' then raise exception 'Daily-seconds cap failed';end if;
  update private.public_demo_daily_budgets set reserved_seconds=6720 where organization_id=org and budget_day=day_key;
  r:=public.reserve_public_demo_session(org,md5('call-6')||md5('salt-6'));
  if (r->>'allowed')::boolean is not true then raise exception 'Exact budget boundary failed';end if;
  -- A release after midnight refunds the acquisition day, never today's unrelated allowance.
  insert into private.public_demo_daily_budgets values(org,day_key-1,1,480);
  update private.public_demo_sessions set budget_day=day_key-1,started_at=clock_timestamp()-interval '60 seconds'
    where organization_id=org and session_key=md5('call-6')||md5('salt-6');
  perform public.release_public_demo_session(org,md5('call-6')||md5('salt-6'));
  if (select reserved_seconds from private.public_demo_daily_budgets where organization_id=org and budget_day=day_key)<>7200 then
    raise exception 'Cross-day release changed the wrong budget';end if;
  if (select reserved_seconds from private.public_demo_daily_budgets where organization_id=org and budget_day=day_key-1)>62 then
    raise exception 'Cross-day refund failed';end if;
  if has_function_privilege('authenticated','public.reserve_public_demo_session(uuid,text)','execute')
    or has_function_privilege('anon','public.release_public_demo_session(uuid,text)','execute')
    or has_table_privilege('authenticated','private.public_demo_sessions','select') then
    raise exception 'Demo control is exposed to customers';end if;
end $$;
reset role;
