-- Use the expanded checklist for newly queued calls; retained reviews update only on an explicit retry.
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
    coalesce((select checklist_version from public.call_analysis where call_log_id = new.id), '2026-09-30.1')
  );
  return new;
end;
$$;

-- The current Vercel plan permits daily cron only. Use the project's existing
-- pg_cron/pg_net scheduler. Provision the matching secret in Vault and on the
-- dashboard server separately; no credential is stored in this migration.
select cron.schedule(
  'call-analysis-retry',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://app.hellocara.ie/api/cron/call-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'call_analysis_retry_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) where exists (select 1 from vault.secrets where name = 'call_analysis_retry_key');
  $job$
);
