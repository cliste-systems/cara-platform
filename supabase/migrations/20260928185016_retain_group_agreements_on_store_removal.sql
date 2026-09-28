-- Agreements cover the parent organisation; deleting one store must not erase them.
alter table public.legal_acceptances
  drop constraint legal_acceptances_organization_id_fkey,
  alter column organization_id drop not null,
  add constraint legal_acceptances_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) on delete set null;
