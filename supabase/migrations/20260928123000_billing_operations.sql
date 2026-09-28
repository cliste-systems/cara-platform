-- Durable idempotency records for admin-created Stripe billing operations.

create table if not exists public.billing_operations (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null unique,
  operation_type text not null,
  account_id uuid references public.accounts (id) on delete restrict,
  stripe_object_id text,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  request jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_operations_account_idx
  on public.billing_operations (account_id, created_at desc);

alter table public.billing_operations enable row level security;
revoke all on public.billing_operations from anon, authenticated;
grant select, insert, update, delete on public.billing_operations to service_role;
