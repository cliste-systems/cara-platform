-- Deploy compatible dashboard loaders before applying this read-access restriction.
-- Table SELECT must be removed: a column REVOKE cannot override a table grant.
revoke select on public.organizations from public, anon, authenticated;
revoke select (custom_prompt, admin_notes) on public.organizations from public, anon, authenticated;
do $$
declare visible_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into visible_columns
  from pg_attribute
  where attrelid = 'public.organizations'::regclass and attnum > 0 and not attisdropped
    and attname not in ('custom_prompt', 'admin_notes');
  execute format('grant select (%s) on public.organizations to authenticated', visible_columns);
end $$;
-- Retain full backend access and existing row-level membership policies.
grant select on public.organizations to service_role;
revoke all on public.platform_cara_rules from public, anon, authenticated;
grant select, insert, update, delete on public.platform_cara_rules to service_role;
notify pgrst, 'reload schema';
