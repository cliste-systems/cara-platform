-- All fixtures are synthetic; execute only inside a transaction that rolls back.
create temporary table cara_prompt_access_fixture on commit drop as
  select gen_random_uuid() user_id,gen_random_uuid() account_id,gen_random_uuid() org_id,
    gen_random_uuid() foreign_account_id,gen_random_uuid() foreign_org_id;
grant select on cara_prompt_access_fixture to authenticated,service_role;
insert into public.accounts(id,name,slug)
 select account_id,'[smoke test] Prompt owner','rt-test-prompt-account-'||account_id from cara_prompt_access_fixture
 union all select foreign_account_id,'[smoke test] Foreign prompt owner','rt-test-prompt-account-'||foreign_account_id from cara_prompt_access_fixture;
insert into public.organizations(id,account_id,name,slug,tier,custom_prompt,admin_notes,is_active)
 select org_id,account_id,'[smoke test] Prompt access','rt-test-prompt-org-'||org_id,'native','SYNTHETIC INTERNAL PROMPT','SYNTHETIC INTERNAL NOTES',false from cara_prompt_access_fixture
 union all select foreign_org_id,foreign_account_id,'[smoke test] Foreign prompt access','rt-test-prompt-org-'||foreign_org_id,'native','SYNTHETIC FOREIGN PROMPT','SYNTHETIC FOREIGN NOTES',false from cara_prompt_access_fixture;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select user_id,'authenticated','authenticated','rt-test-'||user_id||'@example.invalid','{"security_fixture":true}','{}',now(),now() from cara_prompt_access_fixture;
insert into public.profiles(id,organization_id,active_organization_id,account_id,role,name)
 select user_id,org_id,org_id,account_id,'admin','[smoke test] Prompt owner' from cara_prompt_access_fixture;
insert into public.account_memberships(user_id,account_id,role)
 select user_id,account_id,'admin' from cara_prompt_access_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',user_id::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'role','authenticated')::text,true)
 from cara_prompt_access_fixture;
do $$ declare f record; stamp timestamptz; changed integer; begin
 select * into f from cara_prompt_access_fixture;
 if (select count(*) from public.organizations where id=f.org_id)<>1 then raise exception 'Owner lost organisation read access';end if;
 if (select count(*) from public.organizations where id=f.foreign_org_id)<>0 then raise exception 'Foreign organisation became visible';end if;
 select updated_at into stamp from public.organizations where id=f.org_id;
 update public.organizations set greeting='Hello from the synthetic test' where id=f.org_id returning updated_at into stamp;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Owner configuration save failed';end if;
 perform public.publish_service_catalog(f.org_id,stamp,'[]'::jsonb,'',false,'SYNTHETIC COMPILED PROMPT',null);
 begin perform custom_prompt from public.organizations where id=f.org_id;raise exception 'Private prompt became readable after save';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare f record; begin
 select * into f from cara_prompt_access_fixture;
 if (select custom_prompt from public.organizations where id=f.org_id)<>'SYNTHETIC COMPILED PROMPT' then raise exception 'Backend prompt write did not persist';end if;
 if (select admin_notes from public.organizations where id=f.org_id)<>'SYNTHETIC INTERNAL NOTES' then raise exception 'Internal notes were changed';end if;
end $$;
