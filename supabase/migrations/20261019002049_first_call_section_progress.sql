-- Completion receipts are server-owned; existing private-table RLS and grants remain in force.
alter table public.customer_first_call_setup
  add column if not exists completed_sections jsonb not null default '{}'::jsonb;
