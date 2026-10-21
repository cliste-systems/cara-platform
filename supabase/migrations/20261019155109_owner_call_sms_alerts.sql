alter table public.call_logs add column if not exists is_urgent boolean not null default false;
alter table public.call_logs add column if not exists owner_sms_status text check (owner_sms_status in ('pending','sent','failed','unknown','skipped'));

create table public.owner_call_sms_alerts (
 call_log_id uuid primary key references public.call_logs(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','sending','sent','failed','unknown','skipped')),
 attempts integer not null default 0 check (attempts between 0 and 3),
 lease_token uuid,
 lease_expires_at timestamptz,
 next_attempt_at timestamptz default now(),
 error_code text,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.owner_call_sms_alerts enable row level security;
revoke all on public.owner_call_sms_alerts from public, anon, authenticated;
grant select,insert,update,delete on public.owner_call_sms_alerts to service_role;
create index owner_call_sms_alerts_pending on public.owner_call_sms_alerts(next_attempt_at) where status in ('pending','failed');

-- Only backend workers may claim sends. Concurrent webhooks and cron jobs cannot
-- send the same row at once. Expired sends need review rather than blind resend.
create function public.claim_owner_call_sms_alerts(p_call_id uuid default null)
returns setof public.owner_call_sms_alerts
language sql security invoker set search_path = public
as $$
 update public.owner_call_sms_alerts jobs
 set status='sending', attempts=jobs.attempts+1, lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes'
 where jobs.call_log_id in (
  select j.call_log_id from public.owner_call_sms_alerts j
  where j.status in ('pending','failed') and j.attempts<3 and j.next_attempt_at<=now()
   and (p_call_id is null or j.call_log_id=p_call_id)
  order by j.created_at for update skip locked limit 10
 ) returning jobs.*;
$$;
revoke all on function public.claim_owner_call_sms_alerts(uuid) from public,anon,authenticated;
grant execute on function public.claim_owner_call_sms_alerts(uuid) to service_role;
