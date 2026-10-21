-- Vercel Hobby supports daily jobs only. Drain SMS retries every minute using
-- the existing backend scheduler and its Vault-held service credential.
-- Apply after the POST endpoint is deployed. No secret is stored in source.
select cron.schedule(
  'owner-call-alerts',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://app.hellocara.ie/api/cron/owner-call-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'call_analysis_retry_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) where exists (select 1 from vault.secrets where name = 'call_analysis_retry_key');
  $job$
);
