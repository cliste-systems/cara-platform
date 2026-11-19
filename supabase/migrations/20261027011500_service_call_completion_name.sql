alter table public.call_logs add column if not exists follow_up_completed_by_label text
  check (follow_up_completed_by_label is null or char_length(btrim(follow_up_completed_by_label)) between 1 and 80);
