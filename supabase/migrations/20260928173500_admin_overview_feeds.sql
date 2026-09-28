create or replace function public.admin_overview_feeds(p_start timestamptz, p_end timestamptz, p_page integer default 0, p_size integer default 8, p_issue_page integer default 0, p_issue_size integer default 8)
returns jsonb language sql stable security invoker set search_path = public as $$
with activity as (
 select c.id::text id, c.id::text call_id, o.name, coalesce(nullif(c.caller_name,''),c.caller_number,'Unknown caller') caller,
 c.created_at at, c.duration_seconds, c.room_name, c.caller_number, c.is_test_call, c.engineer_test_call, false active, c.post_call_status
 from call_logs c left join organizations o on o.id=c.organization_id
 where c.created_at>=p_start and c.created_at<p_end and c.caller_data_erased_at is null
 union all
 select 'usage-'||u.id::text, null::text, o.name, coalesce(u.caller_number,'Unknown caller'), u.started_at, 0,
 u.room_name, u.caller_number, false, false, true, 'in_progress'
 from usage_records u left join organizations o on o.id=u.organization_id
 where u.started_at>=p_start and u.started_at<p_end and u.ended_at is null
 and not exists(select 1 from call_logs c where c.organization_id=u.organization_id and
 ((u.call_sid is not null and c.call_sid=u.call_sid) or (u.room_name is not null and c.room_name=u.room_name)))
), issues as (
 select 'support-'||s.id::text id, coalesce(nullif(s.subject,''),'Open support ticket') title, 'Support inbox'::text detail,
 '/admin/support/'||s.id::text href, s.created_at at
 from support_tickets s where s.status='open'
 union all
 select 'analysis-'||a.call_log_id::text, 'Failed quality review', o.name,
 '/admin/call-analysis/'||a.call_log_id::text, a.call_created_at
 from call_analysis a join call_logs c on c.id=a.call_log_id left join organizations o on o.id=a.organization_id
 where a.verdict='fail' and c.caller_data_erased_at is null and a.call_created_at>=p_start and a.call_created_at<p_end
)
select jsonb_build_object(
 'total',(select count(*) from activity),
 'calls',coalesce((select jsonb_agg(to_jsonb(rows) order by active desc,at desc,id desc) from
 (select * from activity order by active desc,at desc,id desc offset greatest(p_page,0)*least(greatest(p_size,1),50) limit least(greatest(p_size,1),50)) rows),'[]'::jsonb),
 'issueTotal',(select count(*) from issues),
 'issues',coalesce((select jsonb_agg(to_jsonb(rows) order by at desc,id desc) from
 (select * from issues order by at desc,id desc offset greatest(p_issue_page,0)*least(greatest(p_issue_size,1),50) limit least(greatest(p_issue_size,1),50)) rows),'[]'::jsonb)
);
$$;
revoke all on function public.admin_overview_feeds(timestamptz,timestamptz,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.admin_overview_feeds(timestamptz,timestamptz,integer,integer,integer,integer) to service_role;
