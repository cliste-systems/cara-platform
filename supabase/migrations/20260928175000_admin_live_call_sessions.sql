create table public.admin_live_call_sessions (
 room_name text primary key,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 caller_number text,
 started_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 active boolean not null default false,
 ended_at timestamptz
);
alter table public.admin_live_call_sessions enable row level security;
revoke all on public.admin_live_call_sessions from anon, authenticated;
grant all on public.admin_live_call_sessions to service_role;
alter publication supabase_realtime add table public.admin_live_call_sessions;
