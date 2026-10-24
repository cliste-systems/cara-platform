-- Server-only, durable trial eligibility and atomic signup activation.
create table public.signup_billing_eligibility (
 account_id uuid primary key references public.accounts(id) on delete cascade,
 trial_ends_at timestamptz not null,
 completed_subscription_id text,
 completed_at timestamptz
);
alter table public.signup_billing_eligibility enable row level security;
revoke all on public.signup_billing_eligibility from public,anon,authenticated;
grant all on public.signup_billing_eligibility to service_role;
insert into public.signup_billing_eligibility(account_id,trial_ends_at,completed_subscription_id,completed_at)
select id,now(),platform_subscription_id,now() from public.accounts
where platform_subscription_id is not null and status <> 'onboarding';

create function public.signup_review_approved(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select review_status in ('auto_approved','approved') from public.onboarding_applications
 where organization_id=p_org order by submitted_at desc,id desc limit 1),false);
$$;
revoke all on function public.signup_review_approved(uuid) from public,anon,authenticated;
grant execute on function public.signup_review_approved(uuid) to service_role;

create function public.begin_signup_billing(p_account uuid,p_org uuid) returns bigint
language plpgsql security invoker set search_path='' as $$
declare a public.accounts%rowtype; e public.signup_billing_eligibility%rowtype;
begin
 select * into a from public.accounts where id=p_account for update;
 if not found or a.status <> 'onboarding' or not exists(select 1 from public.organizations where id=p_org and account_id=p_account)
 or not public.signup_review_approved(p_org) then raise exception 'Signup billing is not eligible'; end if;
 insert into public.signup_billing_eligibility(account_id,trial_ends_at) values(p_account,now()+interval '7 days') on conflict do nothing;
 select * into e from public.signup_billing_eligibility where account_id=p_account;
 if e.completed_at is not null or e.trial_ends_at <= now()+interval '2 minutes' then raise exception 'Trial already used or expired'; end if;
 return floor(extract(epoch from e.trial_ends_at))::bigint;
end $$;
revoke all on function public.begin_signup_billing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_signup_billing(uuid,uuid) to service_role;

create function public.finalize_signup_billing(p_account uuid,p_org uuid,p_subscription text,p_customer text,p_plan text,p_launch text,p_interval text) returns void
language plpgsql security invoker set search_path='' as $$
declare a public.accounts%rowtype; e public.signup_billing_eligibility%rowtype;
begin
 select * into a from public.accounts where id=p_account for update;
 if not found or not exists(select 1 from public.organizations where id=p_org and account_id=p_account)
 or not public.signup_review_approved(p_org) then raise exception 'Signup needs review'; end if;
 select * into e from public.signup_billing_eligibility where account_id=p_account for update;
 if a.status='active' and a.platform_subscription_id=p_subscription and e.completed_subscription_id=p_subscription then return; end if;
 if a.status<>'onboarding' or e.account_id is null or e.completed_at is not null then raise exception 'Signup already completed or ineligible'; end if;
 if p_plan not in ('starter','pro','business') or p_launch not in ('diy','remote','onsite') or p_interval not in ('month','year') then raise exception 'Invalid offer'; end if;
 update public.signup_billing_eligibility set completed_at=now(),completed_subscription_id=p_subscription where account_id=p_account;
 -- The confirmed Stripe offer is authoritative, never a newer browser selection.
 update public.accounts set platform_subscription_id=p_subscription,platform_customer_id=p_customer,plan_tier=p_plan,launch_tier=p_launch,billing_interval=p_interval,status='active',updated_at=now() where id=p_account;
 update public.organizations set platform_subscription_id=p_subscription,platform_customer_id=p_customer,plan_tier=p_plan,launch_tier=p_launch,billing_interval=p_interval,status='active',updated_at=now() where account_id=p_account;
end $$;
revoke all on function public.finalize_signup_billing(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_signup_billing(uuid,uuid,text,text,text,text,text) to service_role;

-- A pending or rejected fraud review cannot be bypassed by an activation caller.
create function public.guard_signup_review_activation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.is_active is true and old.is_active is not true) or (new.status='active' and old.status is distinct from 'active') then
  if exists(select 1 from public.account_memberships m join auth.users u on u.id=m.user_id where m.account_id=new.account_id and u.raw_app_meta_data->>'cliste_signup_flow'='simple_v1')
   and not public.signup_review_approved(new.id) then raise exception 'Signup needs review'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_signup_review_activation() from public,anon,authenticated;
create trigger guard_signup_review_activation before update on public.organizations for each row execute function public.guard_signup_review_activation();

-- Reclaim interrupted events and fence late workers with a unique lease token.
alter table public.stripe_webhook_events add column lease_token uuid;
create function public.claim_stripe_webhook(p_event text,p_lease uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.stripe_webhook_events set status='processing',attempts=attempts+1,processing_started_at=now(),lease_token=p_lease,last_error=null
 where event_id=p_event and (status in ('pending','failed') or (status='processing' and processing_started_at < now()-interval '5 minutes'));
 return found;
end $$;
revoke all on function public.claim_stripe_webhook(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_stripe_webhook(text,uuid) to service_role;
