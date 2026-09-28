create table public.admin_call_transport_samples (
  room_name text not null check (room_name ~ '^admin-demo-[a-f0-9-]{36}$'),
  sample_id uuid not null,
  sample jsonb not null check (jsonb_typeof(sample) = 'object' and octet_length(sample::text) <= 4096),
  created_at timestamptz not null default now(),
  primary key (room_name, sample_id)
);
create index admin_call_transport_samples_created_idx on public.admin_call_transport_samples(created_at);
alter table public.admin_call_transport_samples enable row level security;
revoke all on public.admin_call_transport_samples from public, anon, authenticated;
grant select, insert, delete on public.admin_call_transport_samples to service_role;
comment on table public.admin_call_transport_samples is 'Admin-only numeric browser receiver telemetry. No IP addresses or raw RTC reports. Retained for 30 days.';
