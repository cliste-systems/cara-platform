-- Overview is scoped to the supplied Dublin calendar day before pagination.
create or replace function public.admin_operations_overview(
  p_start timestamptz, p_end timestamptz, p_page integer default 0, p_size integer default 5,
  p_issue_page integer default 0, p_issue_size integer default 5
) returns jsonb language sql stable security invoker set search_path = public as $$
with activity as (
  select c.id::text id,c.id call_id,o.name,c.created_at at,c.duration_seconds,c.room_name,c.caller_number,
    coalesce(c.is_test_call,false) is_test_call,coalesce(c.engineer_test_call,false) engineer_test_call,
    coalesce(c.verification_call,false) verification_call,false active,c.post_call_status,
    a.status analysis_status,a.verdict
  from call_logs c left join organizations o on o.id=c.organization_id
  left join call_analysis a on a.call_log_id=c.id
  where c.created_at>=p_start and c.created_at<p_end and c.caller_data_erased_at is null
    and c.caller_number <> '+000000000000'
  union all
  select 'usage-'||u.id::text,null::uuid,o.name,u.started_at,0,u.room_name,u.caller_number,
    u.sync_skip_reason in ('test_call','test_data'),u.sync_skip_reason='engineer_test_call',false,true,
    'in_progress',null::text,null::text
  from usage_records u left join organizations o on o.id=u.organization_id
  where u.started_at>=p_start and u.started_at<p_end and u.ended_at is null
    and not exists(select 1 from call_logs c where c.organization_id=u.organization_id and
      ((u.call_sid is not null and c.call_sid=u.call_sid) or (u.room_name is not null and c.room_name=u.room_name)))
  union all
  select 'session-'||s.room_name,null::uuid,o.name,s.started_at,0,s.room_name,s.caller_number,
    true,true,false,true,'in_progress',null::text,null::text
  from admin_live_call_sessions s left join organizations o on o.id=s.organization_id
  where s.started_at>=p_start and s.started_at<p_end and s.active and s.ended_at is null
    and s.last_seen_at>now()-interval '90 seconds'
    and not exists(select 1 from call_logs c where c.room_name=s.room_name)
    and not exists(select 1 from usage_records u where u.room_name=s.room_name and u.ended_at is null)
), typed as (
  select *,case
    when caller_number='+353870000001' and room_name like 'admin-demo-%' then 'demo'
    when engineer_test_call or caller_number='+353870000001' or room_name like 'admin-demo-%' then 'engineer'
    when verification_call then 'verification' when is_test_call then 'demo' else 'customer' end kind
  from activity
), health as materialized (select * from admin_overview_call_health() where at>=p_start and at<p_end), issues as (
  select 'call-'||h.call_id::text id,h.call_id "callId",h.reasons[1] title,h.name detail,
    '/admin/call-analysis/'||h.call_id::text href,h.at,h.priority,h.signature,h.reasons
  from health h left join admin_overview_issue_reviews r on r.call_log_id=h.call_id and r.signature=h.signature
  where cardinality(h.reasons)>0 and r.call_log_id is null
  union all
  select 'support-'||s.id::text,null::uuid,coalesce(nullif(s.subject,''),'Open support ticket'),
    coalesce(o.name,'Support inbox'),'/admin/support/'||s.id::text,s.created_at,3,null::text,array['Support ticket']
  from support_tickets s left join organizations o on o.id=s.organization_id where s.status='open' and s.created_at>=p_start and s.created_at<p_end
)
select jsonb_build_object(
  'total',(select count(*) from typed),
  'calls',coalesce((select jsonb_agg(to_jsonb(rows) order by active desc,at desc,id desc)
    from (select * from typed order by active desc,at desc,id desc
      offset greatest(p_page,0)*least(greatest(p_size,1),50) limit least(greatest(p_size,1),50)) rows),'[]'::jsonb),
  'issueTotal',(select count(*) from issues),
  'issues',coalesce((select jsonb_agg(to_jsonb(rows) order by priority,at,id)
    from (select * from issues order by priority,at,id
      offset greatest(p_issue_page,0)*least(greatest(p_issue_size,1),50) limit least(greatest(p_issue_size,1),50)) rows),'[]'::jsonb),
  'stats',jsonb_build_object(
    'calls',(select count(*) from typed where at>=p_start and at<p_end),
    'customer',(select count(*) from typed where kind='customer' and at>=p_start and at<p_end),
    'demo',(select count(*) from typed where kind='demo' and at>=p_start and at<p_end),
    'engineer',(select count(*) from typed where kind='engineer' and at>=p_start and at<p_end),
    'verification',(select count(*) from typed where kind='verification' and at>=p_start and at<p_end),
    'active',(select count(*) from typed where active),
    'minutes',(select coalesce(sum(duration_seconds),0)::numeric/60 from typed where not active),
    'support',(select count(*) from support_tickets where status='open' and created_at>=p_start and created_at<p_end),
    'failed',(select count(*) from call_analysis a join call_logs c on c.id=a.call_log_id
      where a.status='completed' and a.verdict='fail' and a.checklist_version='2026-09-30.1'
        and c.created_at>=p_start and c.created_at<p_end and c.caller_data_erased_at is null and c.caller_number<>'+000000000000'),
    'failedCalls',(select count(*) from call_logs c where c.outcome in ('failed','stt_failure','tts_failure','speech_failure','connection_failed','dispatch_failed')
      and c.created_at>=p_start and c.created_at<p_end and c.caller_data_erased_at is null and c.caller_number<>'+000000000000'),
    'processingIssues',(select count(*) from health where processing_issue and at>=p_start and at<p_end),
    'pendingReviews',(select count(*) from call_analysis a join call_logs c on c.id=a.call_log_id
      where a.status in ('pending','running') and c.created_at>=p_start and c.created_at<p_end
        and c.caller_data_erased_at is null and c.caller_number<>'+000000000000')),
  'health',jsonb_build_object(
    'completed',(select count(*) from typed where not active),
    'voice',(select coalesce(sum(voice_count),0) from health where at>=p_start and at<p_end),
    'voiceAssessed',(select count(*) from health where voice_assessed and at>=p_start and at<p_end),
    'processing',(select count(*) from health where processing_issue and at>=p_start and at<p_end),
    'processingAssessed',(select count(*) from health where processing_assessed and at>=p_start and at<p_end),
    'capture',(select count(*) from health where capture_issue and at>=p_start and at<p_end),
    'captureAssessed',(select count(*) from health where capture_assessed and at>=p_start and at<p_end))
);
$$;
revoke all on function public.admin_operations_overview(timestamptz,timestamptz,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.admin_operations_overview(timestamptz,timestamptz,integer,integer,integer,integer) to service_role;



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
select jsonb_set(feed.data,'{stats,failedReviews}',to_jsonb(failures.total),true)
from feed cross join failures;
$$;
revoke all on function public.admin_operations_overview_for_version(timestamptz,timestamptz,text,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_operations_overview_for_version(timestamptz,timestamptz,text,integer,integer,integer,integer) to service_role;
