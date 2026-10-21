create function public.block_test_placeholder_activation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_active is true and old.is_active is not true and exists (
  select 1 from public.phone_numbers p where p.organization_id=new.id and p.status='assigned'
  and p.provider='manual' and (p.notes ilike '%[smoke test]%' or p.notes ilike '%[dev%')
 ) then raise exception 'This is a development test number and cannot receive calls. Assign a connected number before switching Cara on.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.block_test_placeholder_activation() from public,anon,authenticated;
create trigger block_test_placeholder_activation before update of is_active on public.organizations
for each row execute function public.block_test_placeholder_activation();
