alter table public.signup_setup_guards add column restricted boolean not null default true;
-- A non-restricted receipt records that Stripe confirmed an existing account
-- is not an unfinished hold; it prevents repeated scans without limiting calls.
create function public.signup_setup_rollout_candidates() returns table(organization_id uuid,account_id uuid,subscription_id text,completed_at timestamptz) language sql security definer set search_path='' as $$
 select o.id,e.account_id,e.completed_subscription_id,e.completed_at
 from public.signup_billing_eligibility e join public.organizations o on o.account_id=e.account_id and o.is_primary_location
 left join public.signup_setup_guards g on g.organization_id=o.id
 where e.completed_at is not null and e.completed_subscription_id is not null and g.organization_id is null
 order by e.completed_at limit 2;
$$;
revoke all on function public.signup_setup_rollout_candidates() from public,anon,authenticated;
grant execute on function public.signup_setup_rollout_candidates() to service_role;
do $$ declare body text; begin
 select pg_get_functiondef('public.claim_signup_setup_call(uuid,text)'::regprocedure) into body;
 if position('if not found then return' in body)=0 then raise exception 'Unexpected call admission definition'; end if;
 execute replace(body,'if not found then return','if not found or not g.restricted then return');
 select pg_get_functiondef('public.expire_signup_setup_hold(uuid)'::regprocedure) into body;
 execute replace(body,'if not found or guard.expires_at>now()','if not found or not guard.restricted or guard.expires_at>now()');
 select pg_get_functiondef('public.claim_connection_activation(uuid)'::regprocedure) into body;
 execute replace(body,'if found and (guard.expired_at','if found and guard.restricted and (guard.expired_at');
 select pg_get_functiondef('public.guard_expired_signup_line()'::regprocedure) into body;
 execute replace(body,'g.organization_id=new.id and (g.expired_at','g.organization_id=new.id and g.restricted and (g.expired_at');
end $$;
