-- Only existing MFA-protected owner endpoints call these service-role functions.
-- Review markers contain no transcripts, error messages or caller identifiers.
create table public.admin_overview_issue_reviews (
  call_log_id uuid primary key references public.call_logs(id) on delete cascade,
  signature text not null check (signature ~ '^[a-f0-9]{32}$'),
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.admin_overview_issue_reviews enable row level security;
revoke all on public.admin_overview_issue_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.admin_overview_issue_reviews to service_role;
create policy admin_overview_issue_reviews_service on public.admin_overview_issue_reviews
  for all to service_role using (true) with check (true);

-- One row per retained call, combining related failures without copying raw evidence.
create function public.admin_overview_call_health()
returns table (
  call_id uuid, organization_id uuid, name text, at timestamptz,
  voice_count bigint, voice_assessed boolean, processing_issue boolean, processing_assessed boolean,
  capture_issue boolean, capture_assessed boolean, quality_issue boolean, analysis_issue boolean,
  reasons text[], priority integer, signature text
) language sql stable security invoker set search_path = public as $$
with evidence as (
  select c.id, c.organization_id, o.name, c.created_at, c.post_call_status,
    a.status analysis_status, a.verdict, a.next_attempt_at, a.updated_at analysis_updated,
    coalesce(v.total,0) voice_count, v.latest voice_latest,
    coalesce((a.source_diagnostics->>'incidentListComplete') = 'true',false) voice_assessed,
    c.post_call_status in ('partial','failed') or
      (c.post_call_status = 'pending' and c.created_at < now()-interval '5 minutes') processing_issue,
    coalesce(c.post_call_status in ('complete','partial','failed'),false) processing_assessed,
    coalesce(t.status = 'partial' or (t.status = 'captured' and t.expected_events is distinct from t.persisted_events)
      or a.source_diagnostics->'transcriptCapture'->>'status' = 'partial',false) capture_issue,
    coalesce(t.status in ('captured','partial') or
      a.source_diagnostics->'transcriptCapture'->>'status' in ('captured','partial'),false) capture_assessed,
    t.updated_at capture_updated,
    coalesce(a.status = 'completed' and a.verdict in ('fail','review'),false) quality_issue,
    coalesce(a.status = 'error' and a.next_attempt_at is null,false) analysis_issue
  from public.call_logs c
  left join public.organizations o on o.id=c.organization_id
  left join public.call_analysis a on a.call_log_id=c.id
  left join lateral (
    select count(*) total, max(i.occurred_at) latest
    from public.voice_pipeline_incidents i
    where i.organization_id=c.organization_id and
      ((c.call_sid is not null and i.call_sid=c.call_sid) or (c.room_name is not null and i.room_name=c.room_name))
  ) v on true
  left join lateral (
    select x.status,x.expected_events,x.persisted_events,x.updated_at
    from public.call_transcript_captures x
    where x.organization_id=c.organization_id and
      (x.call_log_id=c.id or (c.room_name is not null and x.room_name=c.room_name))
    order by x.updated_at desc limit 1
  ) t on true
  where c.caller_data_erased_at is null and c.created_at >= now()-interval '30 days'
    and c.caller_number <> '+000000000000'
), classified as (
  select *, array_remove(array[
    case when voice_count>0 then 'Voice incident' end,
    case when processing_issue then case when post_call_status='pending' then 'Processing overdue' else 'Post-call processing issue' end end,
    case when capture_issue then 'Incomplete call evidence' end,
    case when quality_issue then case when verdict='fail' then 'Failed quality review' else 'Needs quality review' end end,
    case when analysis_issue then 'Analysis could not finish' end
  ],null) reasons,
  case when voice_count>0 or post_call_status='failed' then 1
    when processing_issue or capture_issue or analysis_issue or verdict='fail' then 2 else 3 end priority
  from evidence
)
select id,organization_id,coalesce(name,'Unknown customer'),created_at,voice_count,voice_assessed,
  coalesce(processing_issue,false),processing_assessed,capture_issue,capture_assessed,quality_issue,analysis_issue,
  reasons,priority,md5(jsonb_build_object('reasons',reasons,'processing',post_call_status,
    'analysis',analysis_updated,'voice',voice_latest,'capture',capture_updated)::text)
from classified;
$$;
revoke all on function public.admin_overview_call_health() from public, anon, authenticated;
grant execute on function public.admin_overview_call_health() to service_role;

create function public.admin_operations_overview(
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
  where u.started_at>=now()-interval '24 hours' and u.ended_at is null
    and not exists(select 1 from call_logs c where c.organization_id=u.organization_id and
      ((u.call_sid is not null and c.call_sid=u.call_sid) or (u.room_name is not null and c.room_name=u.room_name)))
  union all
  select 'session-'||s.room_name,null::uuid,o.name,s.started_at,0,s.room_name,s.caller_number,
    true,true,false,true,'in_progress',null::text,null::text
  from admin_live_call_sessions s left join organizations o on o.id=s.organization_id
  where s.started_at>=now()-interval '24 hours' and s.active and s.ended_at is null
    and s.last_seen_at>now()-interval '90 seconds'
    and not exists(select 1 from call_logs c where c.room_name=s.room_name)
    and not exists(select 1 from usage_records u where u.room_name=s.room_name and u.ended_at is null)
), typed as (
  select *,case
    when caller_number='+353870000001' and room_name like 'admin-demo-%' then 'demo'
    when engineer_test_call or caller_number='+353870000001' or room_name like 'admin-demo-%' then 'engineer'
    when verification_call then 'verification' when is_test_call then 'demo' else 'customer' end kind
  from activity
), health as materialized (select * from admin_overview_call_health()), issues as (
  select 'call-'||h.call_id::text id,h.call_id "callId",h.reasons[1] title,h.name detail,
    '/admin/call-analysis/'||h.call_id::text href,h.at,h.priority,h.signature,h.reasons
  from health h left join admin_overview_issue_reviews r on r.call_log_id=h.call_id and r.signature=h.signature
  where cardinality(h.reasons)>0 and r.call_log_id is null
  union all
  select 'support-'||s.id::text,null::uuid,coalesce(nullif(s.subject,''),'Open support ticket'),
    coalesce(o.name,'Support inbox'),'/admin/support/'||s.id::text,s.created_at,3,null::text,array['Support ticket']
  from support_tickets s left join organizations o on o.id=s.organization_id where s.status='open'
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
    'support',(select count(*) from support_tickets where status='open'),
    'failed',(select count(*) from call_analysis a join call_logs c on c.id=a.call_log_id
      where a.status='completed' and a.verdict='fail' and c.created_at>=p_start and c.created_at<p_end and c.caller_data_erased_at is null)),
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

-- Reject stale reviews: changed evidence must be inspected again.
create function public.admin_review_overview_issue(p_call_id uuid,p_signature text,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.call_logs where id=p_call_id for update;
  if not exists(select 1 from public.admin_overview_call_health()
    where call_id=p_call_id and signature=p_signature and cardinality(reasons)>0) then return false; end if;
  insert into public.admin_overview_issue_reviews(call_log_id,signature,reviewed_by)
    values(p_call_id,p_signature,p_user_id) on conflict(call_log_id) do update
    set signature=excluded.signature,reviewed_by=excluded.reviewed_by,reviewed_at=now();
  return true;
end;
$$;
revoke all on function public.admin_review_overview_issue(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_review_overview_issue(uuid,text,uuid) to service_role;
