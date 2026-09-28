-- Platform Income: durable Stripe projections and replayable webhook inbox.

alter table public.stripe_webhook_events
  alter column processed_at drop not null,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  add column if not exists attempts integer not null default 0,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_error text,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists livemode boolean not null default false,
  add column if not exists payload jsonb;

update public.stripe_webhook_events
set status = 'completed'
where processed_at is not null and status = 'pending';

comment on table public.stripe_webhook_events is
  'Durable Stripe event inbox. Failed and interrupted events remain replayable.';

create index if not exists stripe_webhook_events_pending_idx
  on public.stripe_webhook_events (status, next_attempt_at, received_at)
  where status in ('pending', 'failed');

create table if not exists public.billing_stripe_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete restrict,
  stripe_customer_id text not null,
  livemode boolean not null default false,
  email text,
  name text,
  currency text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_customer_id, livemode)
);

create index if not exists billing_stripe_customers_account_idx
  on public.billing_stripe_customers (account_id);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete restrict,
  stripe_subscription_id text not null,
  stripe_customer_id text,
  livemode boolean not null default false,
  status text not null,
  collection_method text,
  currency text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  trial_end timestamptz,
  service_access_role text not null default 'core'
    check (service_access_role in ('core', 'supplemental', 'none')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_subscription_id, livemode)
);

create index if not exists billing_subscriptions_account_idx
  on public.billing_subscriptions (account_id, status);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete restrict,
  stripe_invoice_id text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  livemode boolean not null default false,
  status text not null,
  collection_method text,
  currency text not null,
  amount_due bigint not null default 0,
  amount_paid bigint not null default 0,
  amount_remaining bigint not null default 0,
  subtotal bigint not null default 0,
  total bigint not null default 0,
  due_date timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  hosted_invoice_url text,
  invoice_pdf text,
  number text,
  attempted boolean not null default false,
  last_finalization_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_invoice_id, livemode)
);

create index if not exists billing_invoices_attention_idx
  on public.billing_invoices (status, due_date, amount_remaining);
create index if not exists billing_invoices_account_idx
  on public.billing_invoices (account_id, created_at desc);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete restrict,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_invoice_id text,
  livemode boolean not null default false,
  status text not null,
  currency text not null,
  amount bigint not null default 0,
  amount_received bigint not null default 0,
  receipt_url text,
  failure_code text,
  failure_message text,
  captured_at timestamptz,
  refunded_amount bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_payment_intent_id, livemode),
  unique (stripe_charge_id, livemode)
);

create index if not exists billing_payments_account_idx
  on public.billing_payments (account_id, created_at desc);
create index if not exists billing_payments_status_idx
  on public.billing_payments (status, created_at desc);

create table if not exists public.billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete restrict,
  stripe_object_id text not null,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  livemode boolean not null default false,
  kind text not null check (kind in ('refund', 'credit_note', 'dispute')),
  status text not null,
  currency text not null,
  amount bigint not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_object_id, livemode)
);

alter table public.billing_stripe_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_adjustments enable row level security;

revoke all on public.billing_stripe_customers, public.billing_subscriptions,
  public.billing_invoices, public.billing_payments, public.billing_adjustments
  from anon, authenticated;
grant select, insert, update, delete on public.billing_stripe_customers,
  public.billing_subscriptions, public.billing_invoices, public.billing_payments,
  public.billing_adjustments to service_role;
