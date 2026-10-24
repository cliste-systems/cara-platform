create function public.select_signup_offer(p_account uuid,p_org uuid,p_plan text,p_launch text,p_interval text) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.begin_signup_billing(p_account,p_org);
 if p_plan not in ('starter','pro','business') or p_launch not in ('diy','remote','onsite') or p_interval not in ('month','year') then raise exception 'Invalid offer'; end if;
 update public.accounts set plan_tier=p_plan,launch_tier=p_launch,billing_interval=p_interval,updated_at=now() where id=p_account;
 update public.organizations set plan_tier=p_plan,launch_tier=p_launch,billing_interval=p_interval,updated_at=now() where account_id=p_account;
end $$;
revoke all on function public.select_signup_offer(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.select_signup_offer(uuid,uuid,text,text,text) to service_role;
create table public.stripe_subscription_leases(subscription_id text primary key,lease_token uuid not null,expires_at timestamptz not null);
alter table public.stripe_subscription_leases enable row level security;
revoke all on public.stripe_subscription_leases from public,anon,authenticated;
grant all on public.stripe_subscription_leases to service_role;
create function public.claim_stripe_subscription(p_subscription text,p_lease uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 insert into public.stripe_subscription_leases values(p_subscription,p_lease,now()+interval '5 minutes')
 on conflict(subscription_id) do update set lease_token=excluded.lease_token,expires_at=excluded.expires_at where stripe_subscription_leases.expires_at<now();
 return found;
end $$;
revoke all on function public.claim_stripe_subscription(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_stripe_subscription(text,uuid) to service_role;
create function public.reconcile_stripe_subscription(p_account uuid,p_subscription text,p_status text,p_lease uuid) returns void language plpgsql security invoker set search_path='' as $$
declare a public.accounts%rowtype;
begin
 perform 1 from public.stripe_subscription_leases where subscription_id=p_subscription and lease_token=p_lease and expires_at>now() for update;
 if not found then raise exception 'Subscription lease expired'; end if;
 select * into a from public.accounts where id=p_account for update;
 if not found then raise exception 'Account missing'; end if;
 if a.platform_subscription_id is distinct from p_subscription then return; end if;
 if p_status in ('unpaid','incomplete_expired','canceled','paused') and a.status='active' then
  update public.accounts set status='suspended',suspended_reason='stripe_subscription_'||p_status,suspended_at=now(),updated_at=now() where id=p_account;
  update public.organizations set status='suspended',is_active=false,suspended_reason='stripe_subscription_'||p_status,suspended_at=now(),updated_at=now() where account_id=p_account;
 elsif p_status in ('active','trialing') and a.status='suspended' and a.suspended_reason like 'stripe_subscription_%' then
  -- Never resume an account held by fraud review.
  if exists(select 1 from public.organizations o join public.onboarding_applications r on r.organization_id=o.id where o.account_id=p_account and r.review_status in ('pending_review','rejected')) then return; end if;
  update public.accounts set status='active',suspended_reason=null,suspended_at=null,updated_at=now() where id=p_account;
  update public.organizations set status='active',suspended_reason=null,suspended_at=null,updated_at=now() where account_id=p_account;
  -- A billing recovery does not bypass first-call setup or switch calls on.
 end if;
end $$;
revoke all on function public.reconcile_stripe_subscription(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_stripe_subscription(uuid,text,text,uuid) to service_role;
