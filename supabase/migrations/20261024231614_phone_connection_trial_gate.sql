-- Private connection evidence. Browser writes can never mark a line verified.
create table public.customer_phone_connections (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 business_number text not null check(business_number ~ '^\+353[1-9][0-9]{7,8}$'),
 phone_type text not null check(phone_type in ('iphone','android','landline','hosted')),
 provider text not null check(provider in ('Vodafone','Three','eir','Virgin Media','Other / not sure')),
 requested_at timestamptz not null default now(),
 verified_at timestamptz,
 verified_call_sid text unique,
 trial_activated_at timestamptz,
 support_ticket_id uuid references public.support_tickets(id) on delete set null,
 check ((verified_at is null) = (verified_call_sid is null)),
 check (verified_call_sid is null or verified_call_sid ~ '^CA[a-fA-F0-9]{32}$')
);
alter table public.customer_phone_connections enable row level security;
revoke all on public.customer_phone_connections from public,anon,authenticated;
grant all on public.customer_phone_connections to service_role;
