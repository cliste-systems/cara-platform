-- Run after the permission migration in a transaction that is rolled back.
do $$ begin
  if has_column_privilege('authenticated','public.organizations','custom_prompt','select')
    or has_column_privilege('authenticated','public.organizations','admin_notes','select')
    or has_column_privilege('anon','public.organizations','custom_prompt','select') then
    raise exception 'Private organisation fields are readable';
  end if;
  if not has_column_privilege('authenticated','public.organizations','name','select')
    or not has_column_privilege('authenticated','public.organizations','id','select')
    or not has_column_privilege('service_role','public.organizations','custom_prompt','select') then
    raise exception 'Required customer/backend permissions were removed';
  end if;
  if has_table_privilege('authenticated','public.platform_cara_rules','select')
    or has_table_privilege('anon','public.platform_cara_rules','select') then
    raise exception 'Private runtime rules are directly readable';
  end if;
end $$;
set local role authenticated;
select id,name,greeting,business_hours,agent_faqs,updated_at from public.organizations where false;
do $$ begin
  begin perform custom_prompt from public.organizations where false;
    raise exception 'Compiled prompt query unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin perform admin_notes from public.organizations where false;
    raise exception 'Internal notes query unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin perform * from public.organizations where false;
    raise exception 'Wildcard query unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin perform * from public.platform_cara_rules where false;
    raise exception 'Runtime-rule query unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
