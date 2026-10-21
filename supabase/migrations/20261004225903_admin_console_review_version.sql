create or replace function public.admin_operations_overview_for_version(
  p_start timestamptz, p_end timestamptz, p_version text,
  p_page integer default 0, p_size integer default 5,
  p_issue_page integer default 0, p_issue_size integer default 5
) returns jsonb language sql stable security invoker set search_path = public as $$
with feed as (
  select public.admin_operations_overview(p_start,p_end,p_page,p_size,p_issue_page,p_issue_size) data
), failures as (
  select count(*) total from public.call_logs c
  join public.call_analysis a on a.call_log_id=c.id
  where c.created_at>=p_start and c.created_at<p_end
    and c.caller_data_erased_at is null and c.caller_number<>'+000000000000'
    and a.status='completed' and a.verdict='fail' and a.checklist_version=p_version
)
select jsonb_set(jsonb_set(feed.data,'{stats,failed}',to_jsonb(failures.total)),
  '{stats,failedReviews}',to_jsonb(failures.total),true)
from feed cross join failures;
$$;
revoke all on function public.admin_operations_overview_for_version(timestamptz,timestamptz,text,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_operations_overview_for_version(timestamptz,timestamptz,text,integer,integer,integer,integer) to service_role;
