-- One publisher is serialized by the existing advisory lock. Limit the
-- larger sort budget to this function rather than every database connection.
ALTER FUNCTION public.refresh_supervalu_national_scope() SET work_mem='16MB';
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.current_retail_campaign_consensus(text)'::regprocedure) INTO definition;
 IF position('membership_source as materialized (' in definition)>0 THEN
  EXECUTE replace(definition,'membership_source as materialized (','membership_source as not materialized (');
 END IF;
END $migration$;
ALTER FUNCTION public.current_retail_campaign_consensus(text) SET search_path='public', 'pg_temp';
