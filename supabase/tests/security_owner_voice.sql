-- Run as a database administrator after 20260928202503. No network calls or
-- real account data: every row is synthetic and the entire fixture rolls back.
begin;
set local statement_timeout = '45s';
-- Storage API normally sets this transaction flag. Only synthetic object metadata
-- is exercised here; no stored blobs exist and every change rolls back.
set local storage.allow_delete_query = 'true';

create temporary table security_owner_voice_fixture on commit drop as
select gen_random_uuid() owner_id, gen_random_uuid() member_id,
       gen_random_uuid() foreign_owner_id, gen_random_uuid() account_id,
       gen_random_uuid() foreign_account_id, gen_random_uuid() org_id,
       gen_random_uuid() foreign_org_id, gen_random_uuid() usage_org_id,
       gen_random_uuid() hourly_org_id, gen_random_uuid() daily_org_id,
       gen_random_uuid() client_id, gen_random_uuid() foreign_client_id,
       'RT-TEST-SECURITY-' || gen_random_uuid()::text prefix;
grant select on security_owner_voice_fixture to authenticated, service_role;

insert into public.accounts(id,name,slug)
select account_id, '[security regression] account', lower(prefix)||'-account' from security_owner_voice_fixture
union all
select foreign_account_id, '[security regression] foreign account', lower(prefix)||'-foreign-account' from security_owner_voice_fixture;

insert into public.organizations(id,account_id,name,slug,tier)
select org_id,account_id,'[security regression] organization',lower(prefix)||'-org','native' from security_owner_voice_fixture
union all select foreign_org_id,foreign_account_id,'[security regression] foreign organization',lower(prefix)||'-foreign-org','native' from security_owner_voice_fixture
union all select usage_org_id,account_id,'[security regression] usage',lower(prefix)||'-usage','native' from security_owner_voice_fixture
union all select hourly_org_id,account_id,'[security regression] hourly',lower(prefix)||'-hourly','native' from security_owner_voice_fixture
union all select daily_org_id,account_id,'[security regression] daily',lower(prefix)||'-daily','native' from security_owner_voice_fixture;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'authenticated','authenticated',lower(prefix)||'-owner@example.invalid','{"security_fixture":true}'::jsonb,'{}'::jsonb,now(),now() from security_owner_voice_fixture
union all select member_id,'authenticated','authenticated',lower(prefix)||'-member@example.invalid','{"security_fixture":true}'::jsonb,'{}'::jsonb,now(),now() from security_owner_voice_fixture
union all select foreign_owner_id,'authenticated','authenticated',lower(prefix)||'-foreign@example.invalid','{"security_fixture":true}'::jsonb,'{}'::jsonb,now(),now() from security_owner_voice_fixture;

insert into public.profiles(id,organization_id,active_organization_id,account_id,role,name)
select owner_id,org_id,org_id,account_id,'admin','[security regression] owner' from security_owner_voice_fixture
union all select member_id,org_id,org_id,account_id,'member','[security regression] member' from security_owner_voice_fixture
union all select foreign_owner_id,foreign_org_id,foreign_org_id,foreign_account_id,'admin','[security regression] foreign owner' from security_owner_voice_fixture;
insert into public.account_memberships(user_id,account_id,role)
select owner_id,account_id,'admin' from security_owner_voice_fixture
union all select member_id,account_id,'member' from security_owner_voice_fixture
union all select foreign_owner_id,foreign_account_id,'admin' from security_owner_voice_fixture;

insert into public.clients(id,organization_id,name,phone_e164)
select client_id,org_id,'[security regression] existing customer','+15555550101' from security_owner_voice_fixture
union all select foreign_client_id,foreign_org_id,'[security regression] foreign customer','+15555550102' from security_owner_voice_fixture;
insert into storage.objects(bucket_id,name)
select 'business-files',org_id::text||'/'||prefix||'.txt' from security_owner_voice_fixture
union all select 'business-files',foreign_org_id::text||'/'||prefix||'.txt' from security_owner_voice_fixture
union all select 'call-recordings',org_id::text||'/'||prefix||'.mp3' from security_owner_voice_fixture
union all select 'call-recordings',foreign_org_id::text||'/'||prefix||'.mp3' from security_owner_voice_fixture;

-- A member can read their existing customer data but cannot mutate it or files.
set local role authenticated;
select set_config('request.jwt.claim.sub',member_id::text,true),
       set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true)
from security_owner_voice_fixture;
do $$
declare f record; affected integer;
begin
  select * into f from security_owner_voice_fixture;
  if private.current_user_is_account_owner() then raise exception 'Member classified as owner'; end if;
  if (select count(*) from public.clients where id=f.client_id)<>1 then raise exception 'Member lost customer read access'; end if;
  update public.clients set name='[security regression] unauthorized update' where id=f.client_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Member changed customer'; end if;
  delete from public.clients where id=f.client_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Member deleted customer'; end if;
  begin
    insert into public.clients(organization_id,name,phone_e164) values(f.org_id,'[security regression] unauthorized insert','+15555550103');
    raise exception 'Member inserted customer';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('business-files',f.org_id::text||'/'||f.prefix||'-member.txt');
    raise exception 'Member inserted business file';
  exception when insufficient_privilege then null; end;
  delete from storage.objects where name in (f.org_id::text||'/'||f.prefix||'.txt',f.org_id::text||'/'||f.prefix||'.mp3');
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Member deleted business file or recording'; end if;
  update storage.objects set name=f.org_id::text||'/'||f.prefix||'-renamed.txt'
    where bucket_id='business-files' and name=f.org_id::text||'/'||f.prefix||'.txt';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Member updated storage metadata'; end if;
  if has_function_privilege(current_user,'public.voice_usage_minutes_for_period(uuid,date)','execute')
    or has_function_privilege(current_user,'public.claim_voice_email_delivery(uuid,text,text,text)','execute') then
    raise exception 'Authenticated users can execute worker-only billing/email RPCs';
  end if;
  -- A profile role alone must not confer ownership; membership stays authoritative.
  begin update public.profiles set role='admin' where id=f.member_id;
  exception when insufficient_privilege then null; end;
  if private.current_user_is_account_owner() then raise exception 'Profile-only role escalation granted ownership'; end if;
end $$;
reset role;

-- Ownership allows only operations already permitted by tenant isolation.
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true),
       set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true)
from security_owner_voice_fixture;
do $$
declare f record; affected integer; added uuid;
begin
  select * into f from security_owner_voice_fixture;
  if not private.current_user_is_account_owner() then raise exception 'Owner denied ownership'; end if;
  update public.clients set name='[security regression] authorized owner update' where id=f.client_id;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Owner could not update own customer'; end if;
  insert into public.clients(organization_id,name,phone_e164)
    values(f.org_id,'[security regression] owner insert','+15555550104') returning id into added;
  delete from public.clients where id=added;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Owner could not delete own customer'; end if;
  if exists(select 1 from public.clients where id=f.foreign_client_id) then raise exception 'Owner read foreign customer'; end if;
  update public.clients set name='[security regression] unauthorized cross-org update' where id=f.foreign_client_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Owner changed foreign customer'; end if;
  begin
    insert into public.clients(organization_id,name,phone_e164) values(f.foreign_org_id,'[security regression] cross-org insert','+15555550105');
    raise exception 'Owner inserted foreign customer';
  exception when insufficient_privilege then null; end;
  begin
    update public.clients set organization_id=f.foreign_org_id where id=f.client_id;
    raise exception 'Owner moved customer to foreign tenant';
  exception when insufficient_privilege then null; end;
  insert into storage.objects(bucket_id,name) values('business-files',f.org_id::text||'/'||f.prefix||'-owner.txt');
  delete from storage.objects where name in (f.org_id::text||'/'||f.prefix||'-owner.txt',f.org_id::text||'/'||f.prefix||'.txt',f.org_id::text||'/'||f.prefix||'.mp3');
  get diagnostics affected=row_count;
  if affected<>3 then raise exception 'Owner could not delete own files/recording'; end if;
  delete from storage.objects where name in (f.foreign_org_id::text||'/'||f.prefix||'.txt',f.foreign_org_id::text||'/'||f.prefix||'.mp3');
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Owner deleted foreign files'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('business-files',f.foreign_org_id::text||'/'||f.prefix||'-cross-org.txt');
    raise exception 'Owner inserted foreign file';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- More than the REST default 1,000-row cap; no test usage can reach Stripe.
insert into public.usage_records(organization_id,call_sid,started_at,ended_at,minutes_billable,billing_period_start,sync_skip_reason,synced_to_stripe_at)
select usage_org_id,'RT-TEST-USAGE-'||prefix||'-'||g,now()-interval '2 minutes',now()-interval '1 minute',1,date_trunc('month',now())::date,'test_data',now()
from security_owner_voice_fixture cross join generate_series(1,1005) g;
insert into public.usage_records(organization_id,started_at,ended_at,minutes_billable,billing_period_start,sync_skip_reason,synced_to_stripe_at)
select usage_org_id,now()+v.start_delta,case when v.finished then now() else null end,v.minutes,
       date_trunc('month',now())::date+v.period_delta,'test_data',now()
from security_owner_voice_fixture cross join (values
  (interval '-10 minutes',false,null::numeric,0),
  (interval '-50 minutes',false,null::numeric,0),
  (interval '-7 hours',false,null::numeric,0),
  (interval '5 minutes',false,null::numeric,0),
  (interval '-3 minutes',true,-5::numeric,0),
  (interval '-3 minutes',true,null::numeric,0),
  (interval '-3 minutes',true,999::numeric,-1)
) v(start_delta,finished,minutes,period_delta);

-- Recent room ownership is the source of truth for caller email claims.
insert into public.usage_records(organization_id,room_name,started_at,billing_period_start,sync_skip_reason,synced_to_stripe_at)
select org_id,prefix||'-call',now(),current_date,'test_data',now() from security_owner_voice_fixture
union all select hourly_org_id,prefix||'-hour-limit',now(),current_date,'test_data',now() from security_owner_voice_fixture
union all select daily_org_id,prefix||'-day-limit',now(),current_date,'test_data',now() from security_owner_voice_fixture
union all select case when g%2=1 then org_id else foreign_org_id end,prefix||'-recipient-'||g,now(),current_date,'test_data',now()
from security_owner_voice_fixture cross join generate_series(1,4) g;
insert into public.usage_records(organization_id,room_name,started_at,ended_at,billing_period_start,sync_skip_reason,synced_to_stripe_at)
select org_id,prefix||'-ended',now()-interval '10 minutes',now(),current_date,'test_data',now() from security_owner_voice_fixture
union all select org_id,prefix||'-stale',now()-interval '2 hours',null,current_date,'test_data',now() from security_owner_voice_fixture;
insert into public.call_transcript_captures(id,organization_id,room_name,started_at,status)
select gen_random_uuid(),org_id,prefix||'-capture-only',now(),'recording' from security_owner_voice_fixture
union all select gen_random_uuid(),org_id,prefix||'-capture-stale',now()-interval '2 hours','recording' from security_owner_voice_fixture;

set local role service_role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare f record; result jsonb; retry_result jsonb; recipient text; content text; n integer; total double precision; org uuid;
begin
  select * into f from security_owner_voice_fixture;
  total:=public.voice_usage_minutes_for_period(f.usage_org_id,date_trunc('month',now())::date);
  if abs(total-1045)>0.00001 then raise exception 'Usage aggregation incorrect: expected 1045, got %',total; end if;
  if public.voice_usage_minutes_for_period(f.foreign_org_id,date_trunc('month',now())::date)<>0 then raise exception 'Usage crossed organization boundary'; end if;
  recipient:=encode(sha256(convert_to(f.prefix||'-recipient','UTF8')),'hex');
  content:=encode(sha256(convert_to(f.prefix||'-content','UTF8')),'hex');
  result:=public.claim_voice_email_delivery(f.org_id,f.prefix||'-call','invalid-hash',content);
  if result->>'status'<>'invalid' then raise exception 'Invalid hash accepted'; end if;
  foreach content in array array[f.prefix||'-missing',f.prefix||'-ended',f.prefix||'-stale',f.prefix||'-capture-stale'] loop
    result:=public.claim_voice_email_delivery(f.org_id,content,recipient,repeat('a',64));
    if result->>'status'<>'invalid_session' then raise exception 'Unverified/stale call accepted: %',result; end if;
  end loop;
  content:=encode(sha256(convert_to(f.prefix||'-content','UTF8')),'hex');
  result:=public.claim_voice_email_delivery(f.foreign_org_id,f.prefix||'-call',recipient,content);
  if result->>'status'<>'invalid_session' then raise exception 'Room accepted for foreign tenant'; end if;
  result:=public.claim_voice_email_delivery(f.org_id,f.prefix||'-call',recipient,content);
  if result->>'status'<>'claimed' or result->>'lease_token' is null then raise exception 'Valid call not claimed: %',result; end if;
  if public.claim_voice_email_delivery(f.org_id,f.prefix||'-call',recipient,content)->>'status'<>'in_progress' then raise exception 'Concurrent duplicate was not suppressed'; end if;
  update public.voice_email_deliveries set status='sent' where id=(result->>'id')::uuid;
  if public.claim_voice_email_delivery(f.org_id,f.prefix||'-call',recipient,content)->>'status'<>'duplicate' then raise exception 'Sent duplicate was not suppressed'; end if;
  content:=encode(sha256(convert_to(f.prefix||'-retry','UTF8')),'hex');
  result:=public.claim_voice_email_delivery(f.org_id,f.prefix||'-call',recipient,content);
  update public.voice_email_deliveries set lease_until=now()-interval '1 second' where id=(result->>'id')::uuid;
  retry_result:=public.claim_voice_email_delivery(f.org_id,f.prefix||'-call',recipient,content);
  if retry_result->>'status'<>'claimed' or retry_result->>'id'<>result->>'id' or retry_result->>'lease_token'=result->>'lease_token' then
    raise exception 'Expired lease did not reclaim the same id with a fresh token';
  end if;
  for n in 3..4 loop
    result:=public.claim_voice_email_delivery(f.org_id,f.prefix||'-call',encode(sha256(convert_to(f.prefix||'-call-recipient-'||n,'UTF8')),'hex'),encode(sha256(convert_to(f.prefix||'-call-content-'||n,'UTF8')),'hex'));
    if result->>'status'<>(case when n=3 then 'claimed' else 'limited' end) then raise exception 'Per-call three-email limit failed at %: %',n,result; end if;
  end loop;
  if (select count(*) from public.voice_email_deliveries where organization_id=f.org_id and call_session_id=f.prefix||'-call')<>3 then raise exception 'Duplicate/retry consumed another budget slot'; end if;
  -- The recipient cap must apply across tenants, not merely per organization.
  recipient:=encode(sha256(convert_to(f.prefix||'-shared-recipient','UTF8')),'hex');
  for n in 1..4 loop
    org:=case when n%2=1 then f.org_id else f.foreign_org_id end;
    result:=public.claim_voice_email_delivery(org,f.prefix||'-recipient-'||n,recipient,encode(sha256(convert_to(f.prefix||'-recipient-content-'||n,'UTF8')),'hex'));
    if result->>'status'<>(case when n<=3 then 'claimed' else 'limited' end) then raise exception 'Cross-tenant recipient limit failed at %: %',n,result; end if;
  end loop;
  result:=public.claim_voice_email_delivery(f.org_id,f.prefix||'-capture-only',encode(sha256(convert_to(f.prefix||'-capture-recipient','UTF8')),'hex'),content);
  if result->>'status'<>'claimed' then raise exception 'Verified transcript-only session was denied'; end if;
end $$;

insert into public.voice_email_deliveries(organization_id,call_session_id,recipient_hash,content_hash,status,created_at)
select hourly_org_id,prefix||'-historical-hour-'||g,encode(sha256(convert_to(prefix||'-historical-hour-recipient-'||g,'UTF8')),'hex'),repeat('a',64),'sent',now()-interval '30 minutes'
from security_owner_voice_fixture cross join generate_series(1,60) g;
insert into public.voice_email_deliveries(organization_id,call_session_id,recipient_hash,content_hash,status,created_at)
select daily_org_id,prefix||'-historical-day-'||g,encode(sha256(convert_to(prefix||'-historical-day-recipient-'||g,'UTF8')),'hex'),repeat('b',64),'sent',now()-interval '2 hours'
from security_owner_voice_fixture cross join generate_series(1,300) g;
do $$
declare f record; result jsonb; recipient text;
begin
  select * into f from security_owner_voice_fixture;
  recipient:=encode(sha256(convert_to(f.prefix||'-quota-probe','UTF8')),'hex');
  result:=public.claim_voice_email_delivery(f.hourly_org_id,f.prefix||'-hour-limit',recipient,repeat('c',64));
  if result->>'status'<>'limited' then raise exception 'Organization hourly limit did not reject email 61: %',result; end if;
  result:=public.claim_voice_email_delivery(f.daily_org_id,f.prefix||'-day-limit',recipient,repeat('d',64));
  if result->>'status'<>'limited' then raise exception 'Organization daily limit did not reject email 301: %',result; end if;
end $$;
reset role;

-- Anonymous users get neither worker RPCs nor the ownership helper.
do $$
begin
  if has_function_privilege('anon','private.current_user_is_account_owner()','execute')
    or has_function_privilege('anon','public.voice_usage_minutes_for_period(uuid,date)','execute')
    or has_function_privilege('anon','public.claim_voice_email_delivery(uuid,text,text,text)','execute') then
    raise exception 'Anonymous role has privileged function execution';
  end if;
end $$;
select 'PASS: owner/member/tenant/storage, complete usage aggregation, email leases/idempotency and all quotas' as security_regression;
rollback;
