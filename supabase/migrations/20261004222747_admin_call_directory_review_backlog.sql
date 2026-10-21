create or replace function public.admin_call_directory(
  p_start timestamptz default null, p_end timestamptz default null,
  p_status text default 'all', p_outcome text default 'all', p_processing boolean default false,
  p_query text default '', p_customer text default '', p_kind text default 'all',
  p_page integer default 0, p_size integer default 10, p_version text default '2026-09-30.1'
) returns jsonb language sql stable security invoker set search_path = public as $$
with base as materialized (
 select c.id,c.organization_id,coalesce(o.name,'Unknown customer') organization_name,
   c.caller_number,c.caller_name,c.created_at,c.duration_seconds,c.outcome,
   c.is_test_call,c.engineer_test_call,c.post_call_status,
   coalesce(c.post_call_status in ('partial','failed') or
     (c.post_call_status='pending' and c.created_at<now()-interval '5 minutes'),false) processing_issue,
   case when c.caller_number='+353870000001' and c.room_name like 'admin-demo-%' then 'demo'
     when c.engineer_test_call or c.caller_number='+353870000001' or c.room_name like 'admin-demo-%' then 'engineer'
     when c.verification_call then 'verification' when c.is_test_call then 'demo' else 'customer' end kind,
   case when a.call_log_id is null then 'unreviewed' when a.status='pending' then 'queued'
     when a.status='error' then 'error' when a.status<>'completed' then 'pending'
     when a.checklist_version is distinct from p_version then 'outdated' else coalesce(a.verdict,'review') end display_status,
   case when a.call_log_id is not null then jsonb_build_object(
     'call_log_id',a.call_log_id,'status',a.status,'verdict',a.verdict,
     'checklist_version',a.checklist_version,'model',a.model,'resolved_model',a.resolved_model,
     'completed_at',a.completed_at,'next_attempt_at',a.next_attempt_at,'error_message',a.error_message,
     'result',case when a.checklist_version=p_version and a.status='completed' then
       jsonb_build_object('summary',a.result->>'summary','failedCount',coalesce(a.result->'failedCount','0'::jsonb),'unverifiedCount',coalesce(a.result->'unverifiedCount','0'::jsonb)) else null end
   ) else null end analysis
 from call_logs c left join organizations o on o.id=c.organization_id
 left join call_analysis a on a.call_log_id=c.id
 where c.caller_data_erased_at is null and c.caller_number<>'+000000000000'
   and c.created_at>=now()-interval '30 days'
), filtered as materialized (
 select * from base where (p_start is null or created_at>=p_start) and (p_end is null or created_at<p_end)
   and (p_status='all' or display_status=p_status or (p_status='backlog' and display_status in ('queued','pending')))
   and (p_outcome='all' or (p_outcome='failed' and outcome in ('failed','stt_failure','tts_failure','speech_failure','connection_failed','dispatch_failed')))
   and (not p_processing or processing_issue)
   and (p_customer='' or organization_id::text=p_customer)
   and (p_kind='all' or kind=p_kind)
   and (p_query='' or position(lower(left(p_query,200)) in lower(concat_ws(' ',organization_name,caller_name,caller_number,id::text,analysis->'result'->>'summary')))>0)
), paging as (
 select count(*) total,least(greatest(coalesce(p_size,10),1),50) size,
   least(greatest(coalesce(p_page,0),0),greatest(0,(count(*)-1)/least(greatest(coalesce(p_size,10),1),50))) page from filtered
)
select jsonb_build_object(
 'total',(select total from paging),'page',(select page from paging),'size',(select size from paging),
 'calls',coalesce((select jsonb_agg(to_jsonb(rows) order by created_at desc,id desc) from
   (select * from filtered order by created_at desc,id desc offset (select page*size from paging) limit (select size from paging)) rows),'[]'::jsonb),
 'customers',coalesce((select jsonb_agg(jsonb_build_object('id',organization_id,'name',organization_name) order by organization_name) from
   (select distinct organization_id,organization_name from base) customers),'[]'::jsonb),
 'counts',jsonb_build_object('pass',(select count(*) from filtered where display_status='pass'),
   'fail',(select count(*) from filtered where display_status='fail'),'review',(select count(*) from filtered where display_status='review'),
   'outdated',(select count(*) from filtered where display_status='outdated'),'pending',(select count(*) from filtered where display_status='pending'),
   'queued',(select count(*) from filtered where display_status='queued'),'unreviewed',(select count(*) from filtered where display_status='unreviewed'),
   'error',(select count(*) from filtered where display_status='error'))
);
$$;
revoke all on function public.admin_call_directory(timestamptz,timestamptz,text,text,boolean,text,text,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.admin_call_directory(timestamptz,timestamptz,text,text,boolean,text,text,text,integer,integer,text) to service_role;
