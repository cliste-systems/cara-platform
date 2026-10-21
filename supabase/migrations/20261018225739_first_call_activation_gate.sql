-- Billing unlocks the dashboard; it must not bypass first-call verification.
create function public.guard_self_service_phone_activation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_active is true and old.is_active is not true and exists (
  select 1 from public.account_memberships m join auth.users u on u.id=m.user_id
  where m.account_id=new.account_id and m.role='admin'
  and u.raw_app_meta_data->>'cliste_signup_flow'='simple_v1'
 ) then
  if not exists (select 1 from public.customer_first_call_setup s where s.organization_id=new.id and s.verification_status='verified' and s.twilio_bundle_sid is not null) then
   raise exception 'Complete business verification before switching Cara on.' using errcode='23514';
  end if;
  if not exists (select 1 from public.phone_numbers p where p.organization_id=new.id and p.status='assigned' and p.e164=new.phone_number) then
   raise exception 'Assign and confirm your Cara phone number before switching Cara on.' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_self_service_phone_activation() from public,anon,authenticated;
create trigger guard_self_service_phone_activation before update of is_active on public.organizations
for each row execute function public.guard_self_service_phone_activation();
