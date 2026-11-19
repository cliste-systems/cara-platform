-- Short Irish fixed-line numbers have seven national digits; allocation/type
-- validation remains in libphonenumber on the server.
alter table public.customer_phone_connections drop constraint customer_phone_connections_business_number_check;
alter table public.customer_phone_connections add constraint customer_phone_connections_business_number_check check (business_number ~ '^\+353[1-9][0-9]{6,8}$');

-- New completed signups only. Existing paying customers are never enrolled by
-- guessing their billing state. Recovery can enroll a known paused setup hold.
create table public.signup_setup_guards (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 account_id uuid not null references public.accounts(id) on delete cascade,
 subscription_id text not null unique,
 expires_at timestamptz not null default now()+interval '30 days',
 expired_at timestamptz,
 cleanup_completed_at timestamptz
);
alter table public.signup_setup_guards enable row level security;
revoke all on public.signup_setup_guards from anon, authenticated;
grant all on public.signup_setup_guards to service_role;
create index signup_setup_guards_expiry on public.signup_setup_guards(expires_at) where cleanup_completed_at is null;
create table public.signup_setup_test_calls (
 call_key text primary key check(length(call_key) between 1 and 200),
 organization_id uuid not null references public.signup_setup_guards(organization_id) on delete cascade,
 started_at timestamptz not null default now(),
 reserved_seconds integer not null check(reserved_seconds between 1 and 300),
 completed_seconds integer check(completed_seconds between 0 and 300)
);
create index signup_setup_test_calls_org on public.signup_setup_test_calls(organization_id);
alter table public.signup_setup_test_calls enable row level security;
revoke all on public.signup_setup_test_calls from anon, authenticated;
grant all on public.signup_setup_test_calls to service_role;

create function public.enroll_signup_setup_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.completed_at is not null and old.completed_at is null then
  insert into public.signup_setup_guards(organization_id,account_id,subscription_id)
   select o.id,new.account_id,new.completed_subscription_id from public.organizations o
   where o.account_id=new.account_id and o.is_primary_location and new.completed_subscription_id is not null
   on conflict(organization_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.enroll_signup_setup_guard() from public,anon,authenticated;
create trigger enroll_signup_setup_guard after update of completed_at on public.signup_billing_eligibility for each row execute function public.enroll_signup_setup_guard();

-- One lock serialises concurrent admissions and reserves remaining time before
-- the voice worker starts paid AI resources. Crashed calls consume reservation.
create function public.claim_signup_setup_call(p_org uuid,p_call_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.signup_setup_guards%rowtype; used integer; allowance integer;
begin
 select * into g from public.signup_setup_guards where organization_id=p_org for update;
 if not found then return jsonb_build_object('allowed',true,'restricted',false); end if;
 if exists(select 1 from public.customer_phone_connections where organization_id=p_org and trial_activated_at is not null) then
  return jsonb_build_object('allowed',true,'restricted',false);
 end if;
 if g.expired_at is not null or g.expires_at<=now() then return jsonb_build_object('allowed',false,'reason','setup_expired'); end if;
 if p_call_key is null or length(p_call_key) not between 1 and 200 then return jsonb_build_object('allowed',false,'reason','invalid_call'); end if;
 if exists(select 1 from public.signup_setup_test_calls where organization_id=p_org and completed_seconds is null and started_at>now()-interval '315 seconds') then
  return jsonb_build_object('allowed',false,'reason','setup_call_in_progress');
 end if;
 select coalesce(sum(coalesce(completed_seconds,reserved_seconds)),0)::integer into used from public.signup_setup_test_calls where organization_id=p_org;
 allowance=least(300,900-used);
 if allowance<11 then return jsonb_build_object('allowed',false,'reason','setup_test_allowance_used'); end if;
 insert into public.signup_setup_test_calls(call_key,organization_id,reserved_seconds) values(p_call_key,p_org,allowance) on conflict do nothing;
 if not found then return jsonb_build_object('allowed',false,'reason','duplicate_call'); end if;
 return jsonb_build_object('allowed',true,'restricted',true,'max_seconds',allowance);
end $$;
create function public.finish_signup_setup_call(p_org uuid,p_call_key text,p_seconds integer) returns void language sql security definer set search_path='' as $$
 update public.signup_setup_test_calls set completed_seconds=least(reserved_seconds,greatest(0,p_seconds))
 where organization_id=p_org and call_key=p_call_key and completed_seconds is null and p_seconds is not null;
$$;
revoke all on function public.claim_signup_setup_call(uuid,text),public.finish_signup_setup_call(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.claim_signup_setup_call(uuid,text),public.finish_signup_setup_call(uuid,text,integer) to service_role;

-- Expiry and activation lock the guard before touching connection state, so
-- they cannot race a subscription cancellation against starting the real trial.
create or replace function public.claim_connection_activation(p_org uuid) returns timestamptz language plpgsql set search_path='' as $$
declare guard public.signup_setup_guards%rowtype; lease timestamptz;
begin
 select * into guard from public.signup_setup_guards where organization_id=p_org for update;
 if found and (guard.expired_at is not null or guard.expires_at<=now()) then return null; end if;
 update public.customer_phone_connections set activation_lease_until=now()+interval '5 minutes',activation_attempts=activation_attempts+1,activation_next_attempt_at=now()+interval '5 minutes'
 where organization_id=p_org and verified_at is not null and trial_activated_at is null and (activation_lease_until is null or activation_lease_until<now()) returning activation_lease_until into lease;
 return lease;
end $$;
create function public.expire_signup_setup_hold(p_org uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare guard public.signup_setup_guards%rowtype; connection public.customer_phone_connections%rowtype;
begin
 select * into guard from public.signup_setup_guards where organization_id=p_org for update;
 if not found or guard.expires_at>now() then return false; end if;
 select * into connection from public.customer_phone_connections where organization_id=p_org for update;
 if connection.trial_activated_at is not null or connection.verified_at is not null or connection.activation_lease_until>now() then return false; end if;
 if exists(select 1 from public.signup_setup_test_calls where organization_id=p_org and completed_seconds is null and started_at>now()-interval '315 seconds') then return false; end if;
 update public.signup_setup_guards set expired_at=coalesce(expired_at,now()) where organization_id=p_org;
 update public.organizations set is_active=false,updated_at=now() where id=p_org;
 return true;
end $$;
revoke all on function public.expire_signup_setup_hold(uuid) from public,anon,authenticated;
grant execute on function public.expire_signup_setup_hold(uuid) to service_role;

create function public.guard_expired_signup_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_active and exists(select 1 from public.signup_setup_guards g where g.organization_id=new.id and (g.expired_at is not null or g.expires_at<=now()))
 and not exists(select 1 from public.customer_phone_connections c where c.organization_id=new.id and c.trial_activated_at is not null) then
  raise exception 'Setup access expired; contact support to resume';
 end if;
 return new;
end $$;
revoke all on function public.guard_expired_signup_line() from public,anon,authenticated;
create trigger guard_expired_signup_line before update of is_active on public.organizations for each row when(new.is_active) execute function public.guard_expired_signup_line();
