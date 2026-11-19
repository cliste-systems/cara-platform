alter table public.call_logs add column if not exists pending_knowledge_gaps jsonb;
alter table public.call_logs add column if not exists knowledge_gap_attempts integer not null default 0;
alter table public.call_logs add column if not exists knowledge_gap_retry_at timestamptz;

alter table public.cara_training_items add column if not exists notify_owner boolean not null default false;

create table if not exists public.knowledge_notifications (
 item_id uuid not null references public.cara_training_items(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 channel text not null check(channel in ('email','sms')),
 status text not null default 'pending' check(status in ('pending','sending','sent','skipped','failed','unknown')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_expires_at timestamptz,
 error_code text,
 primary key(item_id,channel)
);
alter table public.knowledge_notifications enable row level security;
revoke all on public.knowledge_notifications from anon, authenticated;
grant all on public.knowledge_notifications to service_role;
create index if not exists knowledge_notifications_pending on public.knowledge_notifications(next_attempt_at) where status='pending';
create or replace function public.enqueue_knowledge_notification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.notify_owner and new.status in ('awaiting_answer','draft_ready') then
  insert into public.knowledge_notifications(item_id,organization_id,channel)
   values(new.id,new.organization_id,'email'),(new.id,new.organization_id,'sms')
   on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.enqueue_knowledge_notification() from public;
create trigger enqueue_knowledge_notification after insert on public.cara_training_items
for each row execute function public.enqueue_knowledge_notification();

create or replace function public.claim_knowledge_notifications() returns setof public.knowledge_notifications
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- An interrupted provider send has an ambiguous result. Do not send it twice.
 update public.knowledge_notifications set status='unknown',error_code='delivery_interrupted'
 where status='sending' and lease_expires_at < now();
 return query
 with candidates as (
  select item_id,channel from public.knowledge_notifications
  where status='pending' and next_attempt_at<=now() and attempts<5
  order by next_attempt_at for update skip locked limit 10
 )
 update public.knowledge_notifications j set status='sending',attempts=j.attempts+1,
 lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes'
 from candidates c where j.item_id=c.item_id and j.channel=c.channel returning j.*;
end; $$;
revoke all on function public.claim_knowledge_notifications() from public;
grant execute on function public.claim_knowledge_notifications() to service_role;

-- Queue payloads share the transcript retention/erasure boundary.
create or replace function public.clear_erased_knowledge_payload() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.caller_data_erased_at is not null then new.pending_knowledge_gaps:=null;
 elsif tg_op='UPDATE' then
  if old.caller_data_erased_at is not null then new.pending_knowledge_gaps:=null; end if;
 end if;
 return new;
end; $$;
revoke all on function public.clear_erased_knowledge_payload() from public;
create trigger clear_erased_knowledge_payload before insert or update on public.call_logs
for each row execute function public.clear_erased_knowledge_payload();

-- Serialize knowledge writes against erasure, then remove existing linked context.
create or replace function public.protect_erased_knowledge_context()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare erased_at timestamptz;
begin
 if new.call_log_id is not null then
  select caller_data_erased_at into erased_at from public.call_logs
   where id=new.call_log_id for share;
  if erased_at is not null then new.caller_context:=null; end if;
 end if;
 return new;
end; $$;
revoke all on function public.protect_erased_knowledge_context() from public;
create or replace function public.erase_linked_knowledge_context() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.caller_data_erased_at is not null then
  update public.cara_training_items set caller_context=null
   where call_log_id=new.id and organization_id=new.organization_id;
  update public.knowledge_notifications set status='skipped',error_code='caller_erased'
   where item_id in (select id from public.cara_training_items where call_log_id=new.id)
     and status='pending';
 end if;
 return new;
end; $$;
revoke all on function public.erase_linked_knowledge_context() from public;
create trigger erase_linked_knowledge_context after update on public.call_logs
for each row when (old.caller_data_erased_at is null and new.caller_data_erased_at is not null)
execute function public.erase_linked_knowledge_context();

-- Retain removed object references until storage confirms deletion, including
-- uploads that finished concurrently with erasure.
create table public.call_recording_cleanup (
 storage_path text primary key,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 created_at timestamptz not null default now(),
 check (split_part(storage_path,'/',1)=organization_id::text)
);
alter table public.call_recording_cleanup enable row level security;
revoke all on public.call_recording_cleanup from anon,authenticated;
grant all on public.call_recording_cleanup to service_role;
create or replace function public.queue_removed_call_recording() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.audio_storage_path is not null and old.audio_storage_path is distinct from new.audio_storage_path then
  insert into public.call_recording_cleanup(storage_path,organization_id)
   values(old.audio_storage_path,old.organization_id) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.queue_removed_call_recording() from public;
create trigger queue_removed_call_recording after update on public.call_logs
for each row execute function public.queue_removed_call_recording();
