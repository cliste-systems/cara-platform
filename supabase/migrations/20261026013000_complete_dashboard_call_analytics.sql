-- Full-period analytics, retaining invoker permissions and the existing customer filters.
-- Invoker rights retain each caller's existing tenant RLS.
CREATE OR REPLACE FUNCTION public.dashboard_home_rollups(
 p_organization_ids uuid[], p_start timestamptz, p_end timestamptz, p_billing_start date
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 WITH calls AS MATERIALIZED (
 SELECT outcome, duration_seconds, ai_summary, created_at FROM public.call_logs
 WHERE organization_id = ANY(p_organization_ids) AND created_at >= p_start
 AND created_at < coalesce(p_end, now())
 AND is_test_call=false AND engineer_test_call=false
 AND caller_number <> '+353870000001'
 AND (room_name IS NULL OR room_name NOT LIKE 'admin-demo-%')
 ), hourly AS (
 SELECT extract(hour FROM created_at AT TIME ZONE 'Europe/Dublin')::int AS hour,
 count(*) AS calls, count(duration_seconds) FILTER (WHERE duration_seconds >= 0) AS measured,
 avg(duration_seconds) FILTER (WHERE duration_seconds >= 0) AS average_seconds
 FROM calls GROUP BY 1
 ), daily AS (
 SELECT (created_at AT TIME ZONE 'Europe/Dublin')::date AS day,
 count(*) AS calls, count(duration_seconds) FILTER (WHERE duration_seconds >= 0) AS measured,
 avg(duration_seconds) FILTER (WHERE duration_seconds >= 0) AS average_seconds
 FROM calls GROUP BY 1
 ), outcomes AS (
 SELECT outcome, count(*) AS count FROM calls GROUP BY outcome
 ), summaries AS (
 SELECT ai_summary AS summary, count(*) AS count FROM calls
 WHERE ai_summary IS NOT NULL GROUP BY ai_summary
 ), usage AS (
 SELECT coalesce(sum(minutes_billable),0) AS minutes FROM public.usage_records
 WHERE organization_id=ANY(p_organization_ids) AND billing_period_start>=p_billing_start
 AND (sync_skip_reason IS NULL OR sync_skip_reason NOT IN ('engineer_test_call','test_data','test_call'))
 AND (caller_number IS NULL OR caller_number <> '+353870000001')
 AND (room_name IS NULL OR (room_name NOT LIKE 'admin-demo-%' AND room_name NOT LIKE 'text-rehearsal-%'))
 AND (call_sid IS NULL OR (call_sid NOT LIKE 'RT-TEST-%' AND call_sid NOT LIKE 'KAV-TEST-%' AND call_sid NOT LIKE 'DEMO-5PART-%'))
 )
 SELECT jsonb_build_object(
 'calls', (SELECT count(*) FROM calls),
 'minutes', (SELECT coalesce(sum(round(greatest(coalesce(duration_seconds,0),0)::numeric / 60,2)),0) FROM calls),
 'billing_minutes', (SELECT minutes FROM usage),
 'outcomes', coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM outcomes o),'[]'::jsonb),
 'analytics', jsonb_build_object(
   'total', (SELECT count(*) FROM calls),
   'measured', (SELECT count(*) FROM calls WHERE duration_seconds >= 0),
   'average_seconds', (SELECT avg(duration_seconds) FROM calls WHERE duration_seconds >= 0),
   'longest_seconds', (SELECT max(duration_seconds) FROM calls WHERE duration_seconds >= 0),
   'total_seconds', (SELECT coalesce(sum(duration_seconds::bigint),0) FROM calls WHERE duration_seconds >= 0),
   'hourly', (SELECT jsonb_agg(jsonb_build_object('id',h,'calls',coalesce(a.calls,0),'measured',coalesce(a.measured,0),'average_seconds',a.average_seconds) ORDER BY h) FROM generate_series(0,23) h LEFT JOIN hourly a ON a.hour=h),
   'daily', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY day) FROM daily d),'[]'::jsonb)
 ),
 'summaries', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM summaries s),'[]'::jsonb)
 );
$$;
REVOKE ALL ON FUNCTION public.dashboard_home_rollups(uuid[],timestamptz,timestamptz,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_home_rollups(uuid[],timestamptz,timestamptz,date) TO authenticated, service_role;
