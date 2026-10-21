-- Business review is independent of call readiness. Keep billing, confirmed
-- ownership, saved configuration and a genuinely connected pool number required.
create or replace function public.first_call_line_eligible(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.organizations o
  join public.accounts a on a.id=o.account_id
  join public.customer_first_call_setup s on s.organization_id=o.id
  where o.id=p_org and a.status='active' and a.platform_subscription_id is not null
   and s.submitted_at is not null
   and nullif(s.completed_sections->>'profile','') is not null
   and nullif(s.completed_sections->>'hours','') is not null
   and nullif(s.completed_sections->>'greeting','') is not null
   and nullif(btrim(o.agent_business_type),'') is not null
   and nullif(btrim(o.greeting),'') is not null
   and (o.business_hours is not null or nullif(btrim(o.agent_opening_hours),'') is not null)
   and exists (
    select 1 from public.account_memberships m join auth.users u on u.id=m.user_id
    where m.account_id=o.account_id and m.role='admin' and u.email_confirmed_at is not null
   )
   and exists (
    select 1 from public.phone_numbers p where p.organization_id=o.id
     and p.status='assigned' and p.e164=o.phone_number and p.provider='twilio'
     and p.provider_sid is not null and p.livekit_sip_trunk_id is not null
   )
 );
$$;
revoke all on function public.first_call_line_eligible(uuid) from public,anon,authenticated;
grant execute on function public.first_call_line_eligible(uuid) to service_role;

create or replace function public.guard_self_service_phone_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.is_active is true and old.is_active is not true and exists (
  select 1 from public.account_memberships m join auth.users u on u.id=m.user_id
  where m.account_id=new.account_id and m.role='admin'
   and u.raw_app_meta_data->>'cliste_signup_flow'='simple_v1'
 ) then
  if not public.first_call_line_eligible(new.id) or not exists (
   select 1 from public.phone_numbers p where p.organization_id=new.id
    and p.status='assigned' and p.e164=new.phone_number and p.provider='twilio'
    and p.provider_sid is not null and p.livekit_sip_trunk_id is not null
  ) then
   raise exception 'Complete Cara setup and connect your assigned phone number before switching Cara on.' using errcode='23514';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.guard_self_service_phone_activation() from public,anon,authenticated;

-- Called only from the owner-authenticated server action. Lock the organization
-- and its setup record so an edit cannot invalidate configuration mid-activation.
create or replace function public.activate_first_call_line(p_org uuid)
returns boolean language plpgsql set search_path = '' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if not found then return false; end if;
 perform 1 from public.customer_first_call_setup where organization_id=p_org for update;
 if not public.first_call_line_eligible(p_org) then return false; end if;
 update public.organizations set is_active=true where id=p_org;
 return true;
end;
$$;
revoke all on function public.activate_first_call_line(uuid) from public,anon,authenticated;
grant execute on function public.activate_first_call_line(uuid) to service_role;
