-- Owner-only writes are enforced in the database as well as server actions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.current_user_is_account_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.account_memberships m on m.user_id = p.id and m.account_id = p.account_id
    where p.id = auth.uid() and p.role = 'admin' and m.role = 'admin'
  );
$$;
revoke all on function private.current_user_is_account_owner() from public, anon;
grant execute on function private.current_user_is_account_owner() to authenticated;

-- Add restrictive policies: existing tenant isolation must ALSO pass. Personal
-- profile updates and support requests remain available to every member.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts','organizations','call_logs','action_tickets','services','clients',
    'business_files','blocked_callers','cara_training_items','cara_knowledge_events',
    'cara_knowledge_folder_assignments','cara_knowledge_temporal_updates',
    'cara_conversations','cara_messages','cara_pending_actions','staff_working_hours',
    'staff_time_off','staff_services','appointments','appointment_items',
    'store_contacts','store_departments','store_phone_systems','business_hours_overrides'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('create policy owner_insert_guard on public.%I as restrictive for insert to authenticated with check ((select private.current_user_is_account_owner()))', table_name);
      execute format('create policy owner_update_guard on public.%I as restrictive for update to authenticated using ((select private.current_user_is_account_owner())) with check ((select private.current_user_is_account_owner()))', table_name);
      execute format('create policy owner_delete_guard on public.%I as restrictive for delete to authenticated using ((select private.current_user_is_account_owner()))', table_name);
    end if;
  end loop;
end;
$$;
create policy owner_business_storage_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id not in ('business-files','call-recordings') or (select private.current_user_is_account_owner()));
create policy owner_business_storage_update on storage.objects as restrictive for update to authenticated
using (bucket_id not in ('business-files','call-recordings') or (select private.current_user_is_account_owner()))
with check (bucket_id not in ('business-files','call-recordings') or (select private.current_user_is_account_owner()));
create policy owner_business_storage_delete on storage.objects as restrictive for delete to authenticated
using (bucket_id not in ('business-files','call-recordings') or (select private.current_user_is_account_owner()));

-- Aggregate in PostgreSQL so PostgREST's max_rows cannot truncate a period.
create or replace function public.voice_usage_minutes_for_period(p_organization_id uuid, p_billing_period_start date)
returns double precision language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(case
    when u.minutes_billable is not null then greatest(u.minutes_billable,0)
    when u.ended_at is null and u.started_at >= now() - interval '6 hours'
      then least(30, greatest(0, extract(epoch from (now() - u.started_at)) / 60))
    else 0 end),0)::double precision
  from public.usage_records u
  where u.organization_id = p_organization_id and u.billing_period_start = p_billing_period_start;
$$;
revoke all on function public.voice_usage_minutes_for_period(uuid,date) from public, anon, authenticated;
grant execute on function public.voice_usage_minutes_for_period(uuid,date) to service_role;

-- Store hashes only; caller email bodies/addresses do not belong in the budget log.
create table public.voice_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_session_id text not null check (length(call_session_id) between 1 and 256),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  lease_token uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,call_session_id,recipient_hash,content_hash)
);
alter table public.voice_email_deliveries enable row level security;
revoke all on public.voice_email_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.voice_email_deliveries to service_role;
create index voice_email_deliveries_org_time on public.voice_email_deliveries(organization_id,created_at);
create index voice_email_deliveries_recipient_time on public.voice_email_deliveries(recipient_hash,created_at);

create or replace function public.claim_voice_email_delivery(
  p_organization_id uuid,p_call_session_id text,p_recipient_hash text,p_content_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.voice_email_deliveries%rowtype; claimed public.voice_email_deliveries%rowtype;
begin
  if p_call_session_id is null or length(p_call_session_id) not between 1 and 256
     or p_recipient_hash is null or p_recipient_hash !~ '^[0-9a-f]{64}$'
     or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','invalid');
  end if;
  -- Serialize budgets across workers, and across tenants targeting one recipient.
  perform pg_advisory_xact_lock(hashtextextended('voice-email-org:' || p_organization_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('voice-email-recipient:' || p_recipient_hash,0));
  select * into existing from public.voice_email_deliveries d
  where d.organization_id=p_organization_id and d.call_session_id=p_call_session_id
    and d.recipient_hash=p_recipient_hash and d.content_hash=p_content_hash;
  if found and existing.status='sent' then
    return jsonb_build_object('status','duplicate');
  end if;
  -- Room names originate in LiveKit, and must belong to this active tenant call.
  if not exists(select 1 from public.usage_records u where u.organization_id=p_organization_id
       and u.room_name=p_call_session_id and u.ended_at is null and u.started_at>=now()-interval '1 hour')
     and not exists(select 1 from public.call_transcript_captures c where c.organization_id=p_organization_id
       and c.room_name=p_call_session_id and c.status='recording' and c.started_at>=now()-interval '1 hour') then
    return jsonb_build_object('status','invalid_session');
  end if;
  if existing.id is not null then
    if existing.created_at < now()-interval '23 hours' then
      return jsonb_build_object('status','expired');
    end if;
    if existing.status='pending' and existing.lease_until>now() then
      return jsonb_build_object('status','in_progress');
    end if;
    update public.voice_email_deliveries set status='pending',lease_token=gen_random_uuid(),
      lease_until=now()+interval '2 minutes',updated_at=now() where id=existing.id returning * into claimed;
  else
    if (select count(*) from public.voice_email_deliveries where organization_id=p_organization_id and call_session_id=p_call_session_id)>=3
      or (select count(*) from public.voice_email_deliveries where recipient_hash=p_recipient_hash and created_at>=now()-interval '1 hour')>=3
      or (select count(*) from public.voice_email_deliveries where organization_id=p_organization_id and created_at>=now()-interval '1 hour')>=60
      or (select count(*) from public.voice_email_deliveries where organization_id=p_organization_id and created_at>=now()-interval '24 hours')>=300 then
      return jsonb_build_object('status','limited');
    end if;
    insert into public.voice_email_deliveries(organization_id,call_session_id,recipient_hash,content_hash)
    values(p_organization_id,p_call_session_id,p_recipient_hash,p_content_hash) returning * into claimed;
  end if;
  return jsonb_build_object('status','claimed','id',claimed.id,'lease_token',claimed.lease_token);
end;
$$;
revoke all on function public.claim_voice_email_delivery(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_voice_email_delivery(uuid,text,text,text) to service_role;
