-- Review browser demo calls while other engineer calls remain excluded. Existing unreviewed calls are not automatically backfilled.
create or replace function public.enqueue_call_analysis(
  p_call_log_id uuid,
  p_model text,
  p_checklist_version text,
  p_source_transcript text default null,
  p_source_diagnostics jsonb default null,
  p_force boolean default false
) returns boolean
language plpgsql security invoker set search_path = public
as $$
declare
  c public.call_logs%rowtype;
  a public.call_analysis%rowtype;
  source_text text;
  source_diagnostics jsonb;
  fingerprint text;
  changed boolean;
begin
  select * into c from public.call_logs where id = p_call_log_id for update;
  if not found or c.caller_data_erased_at is not null or c.caller_number = '+000000000000'
    or c.created_at < now() - interval '30 days' then
    return false;
  end if;
  -- Browser demos are deliberately reviewable even though they remain engineer calls for billing.
  if (c.engineer_test_call = true
    or btrim(coalesce(c.caller_number, '')) = '+353870000001'
    or btrim(coalesce(c.room_name, '')) like 'admin-demo-%')
    and not (btrim(coalesce(c.caller_number, '')) = '+353870000001'
      and btrim(coalesce(c.room_name, '')) like 'admin-demo-%') then
    delete from public.call_analysis where call_log_id = p_call_log_id;
    return false;
  end if;
  select * into a from public.call_analysis where call_log_id = p_call_log_id for update;
  -- Final and initial callbacks may arrive out of order. Preserve newer evidence.
  if jsonb_typeof(p_source_diagnostics -> 'capturedAtMs') = 'number'
    and jsonb_typeof(a.source_diagnostics -> 'capturedAtMs') = 'number'
    and (p_source_diagnostics ->> 'capturedAtMs')::numeric < (a.source_diagnostics ->> 'capturedAtMs')::numeric then
    p_source_diagnostics := null;
    p_source_transcript := null;
  end if;
  source_text := coalesce(nullif(p_source_transcript, ''), a.source_transcript, c.transcript);
  source_diagnostics := case
    when p_source_diagnostics is null then a.source_diagnostics
    else coalesce(a.source_diagnostics, '{}'::jsonb) || p_source_diagnostics
  end;
  -- MD5 is only an equality fingerprint, not a security or authenticity primitive.
  fingerprint := md5(jsonb_build_object(
    'transcript', source_text, 'diagnostics', source_diagnostics,
    'duration', c.duration_seconds, 'outcome', c.outcome,
    'post_call_status', c.post_call_status, 'post_call_errors', c.post_call_errors,
    'expected_ticket', c.post_call_expected_ticket, 'transfer_connected', c.transfer_connected,
    'model', p_model, 'checklist_version', p_checklist_version
  )::text);
  changed := a.call_log_id is null or a.input_fingerprint is distinct from fingerprint;
  -- Repeated requests cannot supersede an active lease or duplicate a paid request.
  if not changed and (not p_force or (a.status = 'running' and a.lease_expires_at > now())) then
    return false;
  end if;
  insert into public.call_analysis (
    call_log_id, organization_id, call_created_at, model, checklist_version,
    input_fingerprint, source_transcript, source_diagnostics
  ) values (
    c.id, c.organization_id, c.created_at, p_model, p_checklist_version,
    fingerprint, source_text, source_diagnostics
  ) on conflict (call_log_id) do update set
    model = excluded.model, checklist_version = excluded.checklist_version,
    input_fingerprint = excluded.input_fingerprint,
    source_transcript = excluded.source_transcript, source_diagnostics = excluded.source_diagnostics,
    status = 'pending', verdict = null, result = null, usage = null,
    attempts = 0, lease_token = null, lease_expires_at = null,
    next_attempt_at = now(), error_message = null, completed_at = null, updated_at = clock_timestamp();
  return true;
end;
$$;
revoke all on function public.enqueue_call_analysis(uuid,text,text,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.enqueue_call_analysis(uuid,text,text,text,jsonb,boolean) to service_role;

-- Keep caller erasure and transcript-removal cleanup atomic with the source update.
create or replace function call_analysis_private.sync_call_analysis_from_call() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.caller_data_erased_at is not null or new.caller_number = '+000000000000'
    or new.created_at < now() - interval '30 days'
    or ((new.engineer_test_call = true
      or btrim(coalesce(new.caller_number, '')) = '+353870000001'
      or btrim(coalesce(new.room_name, '')) like 'admin-demo-%')
      and not (btrim(coalesce(new.caller_number, '')) = '+353870000001'
        and btrim(coalesce(new.room_name, '')) like 'admin-demo-%')) then
    delete from public.call_analysis where call_log_id = new.id;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.transcript is not null and new.transcript is null then
      delete from public.call_analysis where call_log_id = new.id;
      return new;
    end if;
  end if;
  perform public.enqueue_call_analysis(
    new.id,
    coalesce((select model from public.call_analysis where call_log_id = new.id), 'gpt-6-sol'),
    coalesce((select checklist_version from public.call_analysis where call_log_id = new.id), '2026-09-28.1')
  );
  return new;
end;
$$;
revoke all on function call_analysis_private.sync_call_analysis_from_call() from public, anon, authenticated;
grant execute on function call_analysis_private.sync_call_analysis_from_call() to service_role;
drop trigger call_analysis_source_update on public.call_logs;
create trigger call_analysis_source_update after update of transcript, post_call_status, post_call_errors,
  post_call_expected_ticket, transfer_connected, outcome, caller_data_erased_at, caller_number,
  engineer_test_call, room_name, duration_seconds, created_at
  on public.call_logs for each row execute function call_analysis_private.sync_call_analysis_from_call();
