-- A bounded 90-second rebuild must not run continuously on shared call storage.
-- Dispatch remains every minute; publication retries get a recovery window.
select cron.schedule('supervalu-national-catalog-publish','*/5 * * * *',
  'set statement_timeout = ''90s''; select public.publish_ready_supervalu_catalog_run();');
