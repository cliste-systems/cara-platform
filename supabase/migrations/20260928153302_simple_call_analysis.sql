-- Queue the seven-question analysis for newly saved calls. Existing reviews stay unchanged until a founder updates them.
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
    coalesce((select checklist_version from public.call_analysis where call_log_id = new.id), '2026-09-28.2')
  );
  return new;
end;
$$;
