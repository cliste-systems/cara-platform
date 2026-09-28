create or replace function public.admin_overview_snapshot(p_start timestamptz, p_end timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $$
select jsonb_build_object(
 'calls', (select count(*) from call_logs where created_at >= p_start and created_at < p_end and caller_data_erased_at is null),
 'minutes', (select coalesce(sum(duration_seconds),0)::numeric / 60 from call_logs where created_at >= p_start and created_at < p_end and caller_data_erased_at is null),
 'support', (select count(*) from support_tickets where status = 'open'),
 'failed', (select count(*) from call_analysis a join call_logs c on c.id = a.call_log_id where a.verdict = 'fail' and c.caller_data_erased_at is null and c.created_at >= p_start and c.created_at < p_end)
);
$$;
revoke all on function public.admin_overview_snapshot(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_overview_snapshot(timestamptz,timestamptz) to service_role;
