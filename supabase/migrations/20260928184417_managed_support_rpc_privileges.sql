-- Supabase grants anon explicit EXECUTE privileges independently of PUBLIC.
-- Keep support mutations authenticated-only, alongside the managed setup guard.
revoke all on function public.support_ticket_close_if_open(uuid) from anon;
revoke all on function public.support_ticket_reopen_if_closed(uuid) from anon;
