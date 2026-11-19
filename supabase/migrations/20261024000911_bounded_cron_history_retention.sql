-- User approved 30-day retention for completed operational cron history.
SELECT cron.schedule('operational-cron-history-retention','23 * * * *',$job$
 DELETE FROM cron.job_run_details WHERE runid IN (
   SELECT runid FROM cron.job_run_details
   WHERE end_time < now()-interval '30 days'
   ORDER BY runid LIMIT 10000
 );
$job$);
