-- Prevent delayed processing from restoring erased caller content.
create or replace function public.protect_erased_call_content()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.caller_data_erased_at is not null or new.caller_data_erased_at is not null then
    new.caller_number := '+000000000000';
    new.caller_name := null;
    new.transcript := null;
    new.transcript_review := null;
    new.ai_summary := null;
    new.audio_storage_path := null;
    new.caller_data_erased_at := coalesce(old.caller_data_erased_at, new.caller_data_erased_at);
    if old.caller_data_erased_at is not null then
      new.caller_data_erased_by := old.caller_data_erased_by;
      new.caller_data_erased_by_label := old.caller_data_erased_by_label;
      new.caller_data_erased_reason := old.caller_data_erased_reason;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_erased_call_content() from public;
drop trigger if exists protect_erased_call_content on public.call_logs;
create trigger protect_erased_call_content before update on public.call_logs
for each row execute function public.protect_erased_call_content();

create or replace function public.protect_erased_knowledge_context()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.call_log_id is not null and exists (
    select 1 from public.call_logs where id = new.call_log_id
      and caller_data_erased_at is not null
  ) then
    new.caller_context := null;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_erased_knowledge_context() from public;
drop trigger if exists protect_erased_knowledge_context on public.cara_training_items;
create trigger protect_erased_knowledge_context before insert or update on public.cara_training_items
for each row execute function public.protect_erased_knowledge_context();
