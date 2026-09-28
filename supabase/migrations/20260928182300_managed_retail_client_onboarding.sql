-- Accounts are the legal organisation and invoice boundary; organizations are stores.
alter table public.accounts
  add column billing_method text
    check (billing_method in ('card', 'manual_invoice')),
  add column billing_email text,
  add column billing_contact_name text,
  add column billing_address text,
  add column billing_vat_number text;

alter table public.admin_invites
  add column user_id uuid references auth.users(id) on delete set null,
  add column delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  add column delivery_error text,
  alter column sent_at drop not null,
  alter column sent_at drop default;
create index admin_invites_user_id_idx on public.admin_invites(user_id);

-- Preserve the accepted legal identity, not just a mutable store label.
alter table public.legal_acceptances
  add column account_id uuid references public.accounts(id) on delete cascade,
  add column organisation_name text,
  add column signatory_name text,
  add column signatory_role text,
  add column authority_confirmed boolean not null default false;
create index legal_acceptances_account_user_idx
  on public.legal_acceptances(account_id, user_id, document_type, document_version);
-- Historical per-store acceptances are deliberately not promoted to group agreements.
