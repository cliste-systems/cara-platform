-- Storage objects must be removed through the Storage API before this transaction.
create function public.admin_delete_call_history(p_call_id uuid, p_expected_storage_path text default null)
returns boolean language plpgsql security invoker set search_path = public as $$
declare c public.call_logs%rowtype;
begin
  select * into c from public.call_logs where id=p_call_id for update;
  if not found then return false; end if;
  if exists (select 1 from public.admin_live_call_sessions s where s.room_name=c.room_name and s.active and s.last_seen_at>now()-interval '90 seconds') then
    raise exception 'An active call cannot be deleted';
  end if;
  if c.audio_storage_path is distinct from p_expected_storage_path then
    raise exception 'The call recording changed. Refresh and try again';
  end if;
  if c.audio_storage_path is not null and exists (select 1 from storage.objects where bucket_id='call-recordings' and name=c.audio_storage_path) then
    raise exception 'Remove the recording through the Storage API first';
  end if;
  delete from public.cara_knowledge_events where call_log_id=c.id;
  delete from public.cara_training_items where call_log_id=c.id;
  delete from public.action_tickets where call_log_id=c.id;
  delete from public.platform_events where call_log_id=c.id;
  delete from public.voice_pipeline_incidents where organization_id=c.organization_id and
    ((c.room_name is not null and room_name=c.room_name) or (c.call_sid is not null and call_sid=c.call_sid));
  delete from public.voice_email_deliveries where organization_id=c.organization_id and
    call_session_id in (c.id::text,c.room_name,c.call_sid);
  delete from public.admin_call_transport_samples where room_name=c.room_name;
  delete from public.admin_live_call_sessions where room_name=c.room_name;
  delete from public.call_transcript_captures where call_log_id=c.id or
    (organization_id=c.organization_id and c.room_name is not null and room_name=c.room_name);
  -- Reviews, test reports, transcript events and overview markers cascade.
  delete from public.call_logs where id=c.id;
  return true;
end $$;
revoke all on function public.admin_delete_call_history(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_delete_call_history(uuid,text) to service_role;
