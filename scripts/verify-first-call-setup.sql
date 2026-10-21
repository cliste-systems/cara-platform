begin;
do $$
declare v_org uuid; v_user uuid; v_ticket uuid; v_retry uuid; v_at timestamptz;
begin
 if has_table_privilege('anon','public.customer_first_call_setup','SELECT') or has_table_privilege('authenticated','public.customer_first_call_setup','UPDATE') then raise exception 'Customer can access server-owned verification'; end if;
 if has_function_privilege('authenticated','public.submit_first_call_business(uuid,uuid,jsonb,text)','EXECUTE') or has_function_privilege('anon','public.review_first_call_business(uuid,uuid,text,text,text,timestamptz)','EXECUTE') then raise exception 'Untrusted role can call verification RPC'; end if;
 select o.id,m.user_id into v_org,v_user from organizations o join account_memberships m on m.account_id=o.account_id join auth.users u on u.id=m.user_id where o.name ilike '%smoke test%' and m.role='admin' and u.raw_app_meta_data->>'cliste_signup_flow'='simple_v1' limit 1;
 if v_org is null then raise exception 'No marked smoke-test business available'; end if;
 delete from customer_first_call_setup where organization_id=v_org;
 v_ticket:=submit_first_call_business(v_org,v_user,'{"legalName":"[smoke test] First call verification"}','[smoke test] Initial verification submission');
 update organizations set is_active=false where id=v_org;
 begin
  update organizations set is_active=true where id=v_org;
  raise exception 'Unverified business activated';
 exception when check_violation then null; end;
 v_retry:=submit_first_call_business(v_org,v_user,'{"legalName":"[smoke test] Revised details"}','[smoke test] Revised verification submission');
 if v_ticket<>v_retry then raise exception 'Retry created duplicate ticket'; end if;
 if not exists(select 1 from support_ticket_messages where ticket_id=v_ticket and body='[smoke test] Revised verification submission') then raise exception 'Revision audit not recorded'; end if;
 select submitted_at into v_at from customer_first_call_setup where organization_id=v_org;
 perform review_first_call_business(v_org,v_user,'needs_information','[smoke test] Please confirm your address',null,v_at);
 if not exists(select 1 from customer_first_call_setup where organization_id=v_org and verification_status='needs_information' and reviewed_by=v_user) then raise exception 'Review was not saved'; end if;
 if not exists(select 1 from support_ticket_messages where ticket_id=v_ticket and author_kind='admin') then raise exception 'Customer-facing review not recorded'; end if;
 begin
  perform review_first_call_business(v_org,v_user,'verified','[smoke test] stale review',null,v_at-interval '1 second');
  raise exception 'Stale review accepted';
 exception when raise_exception then if sqlerrm='Stale review accepted' then raise; end if; end;
 raise notice 'PASS: private progress, RPC grants, retry deduplication, submission history, review visibility and stale-review protection and activation gate';
end $$;
rollback;
