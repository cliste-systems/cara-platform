create table public.application_events (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 kind text not null check (kind in ('error','slow')),
 operation text not null check (length(operation) between 1 and 160),
 code text not null check (length(code) between 1 and 100),
 organization_id uuid,
 duration_ms integer check (duration_ms between 0 and 3600000),
 environment text not null check (environment in ('production','development','test'))
);
alter table public.application_events enable row level security;
revoke all on public.application_events from public, anon, authenticated;
grant select, insert, delete on public.application_events to service_role;
create index application_events_recent on public.application_events(created_at desc);
create index application_events_customer_recent on public.application_events(organization_id, created_at desc);
select cron.schedule('application-event-retention', '17 3 * * *', $$delete from public.application_events where created_at < now() - interval '30 days'$$);
