-- Checked before application: zero existing auth users have managed_onboarding=true.
-- This gate applies only to future managed invitations. Existing clients, staff,
-- and service-role workers keep their current access. No billing or user data changes.
-- UI and server gates are backed by RLS for newly invited managed clients.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.managed_client_access_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then false
    when not coalesce((u.raw_app_meta_data->>'managed_onboarding')::boolean, false) then true
    when coalesce((u.raw_app_meta_data->>'needs_password')::boolean, false) then false
    else exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_id is not null
      and not exists (
        select 1 from (values ('terms'), ('privacy'), ('dpa')) required(document_type)
        where not exists (
          select 1 from public.legal_acceptances l
          where l.user_id = p.id and l.account_id = p.account_id
            and l.document_type = required.document_type
            and l.document_version = '2026-09-28'
            and l.authority_confirmed
        )
      )
    ) end
  from auth.users u where u.id = auth.uid();
$$;
revoke all on function private.managed_client_access_ready() from public;
grant execute on function private.managed_client_access_ready() to authenticated;

-- Explicit scope: tenant data reachable through the customer dashboard.
-- Existing permissive tenant isolation stays in place; this adds a setup condition.
create policy managed_client_onboarding_gate on public.accounts
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.organizations
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.call_logs
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.action_tickets
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.clients
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.blocked_callers
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.business_files
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.business_hours_overrides
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.call_analysis
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.call_test_profiles
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.call_test_reports
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.call_transcript_captures
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.call_transcript_events
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.caller_abuse_signals
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.cara_knowledge_events
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.cara_knowledge_folder_assignments
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.cara_knowledge_temporal_updates
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.cara_training_items
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.phone_numbers
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.retail_store_product_assortment
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.retail_store_products
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.services
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.sms_usage_records
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.store_contacts
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.store_departments
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.store_phone_systems
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.support_ticket_messages
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.support_tickets
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.usage_records
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));
create policy managed_client_onboarding_gate on public.voice_pipeline_incidents
  as restrictive for all to authenticated
  using ((select private.managed_client_access_ready()))
  with check ((select private.managed_client_access_ready()));

-- Files are exposed through Storage, independently of public.business_files/call_logs.
-- Other buckets retain their existing policies (e.g. a user's profile avatar).
create policy managed_client_onboarding_gate on storage.objects
  as restrictive for all to authenticated
  using (
    bucket_id not in ('business-files', 'call-recordings')
    or (select private.managed_client_access_ready())
  )
  with check (
    bucket_id not in ('business-files', 'call-recordings')
    or (select private.managed_client_access_ready())
  );

-- These RPCs run as their owner and therefore bypass table RLS. Preserve their
-- existing tenant check and require completed setup before a customer can use them.
create or replace function public.support_ticket_close_if_open(p_ticket_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
begin
  if not coalesce(private.managed_client_access_ready(), false) then
    raise exception 'Complete account setup before using support tickets' using errcode = '42501';
  end if;
  select p.organization_id into org from public.profiles p where p.id = auth.uid();
  if org is null then raise exception 'not authenticated'; end if;
  update public.support_tickets t set status = 'closed', updated_at = now()
  where t.id = p_ticket_id and t.organization_id = org and t.status = 'open';
end;
$$;
revoke all on function public.support_ticket_close_if_open(uuid) from public;
grant execute on function public.support_ticket_close_if_open(uuid) to authenticated;

create or replace function public.support_ticket_reopen_if_closed(p_ticket_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
begin
  if not coalesce(private.managed_client_access_ready(), false) then
    raise exception 'Complete account setup before using support tickets' using errcode = '42501';
  end if;
  select p.organization_id into org from public.profiles p where p.id = auth.uid();
  if org is null then raise exception 'not authenticated'; end if;
  update public.support_tickets t set status = 'open', updated_at = now()
  where t.id = p_ticket_id and t.organization_id = org and t.status = 'closed';
end;
$$;
revoke all on function public.support_ticket_reopen_if_closed(uuid) from public;
grant execute on function public.support_ticket_reopen_if_closed(uuid) to authenticated;
