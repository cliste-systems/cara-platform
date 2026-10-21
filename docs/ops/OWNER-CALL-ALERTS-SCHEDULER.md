# Owner call SMS retry scheduler

Completed calls attempt eligible owner alerts immediately. The durable outbox is retried every minute by the existing Supabase `pg_cron` / `pg_net` scheduler, rather than Vercel Cron, to remain compatible with the Hobby plan.

- Job: `owner-call-alerts`, schedule `* * * * *`.
- Endpoint: `POST https://app.hellocara.ie/api/cron/owner-call-alerts`.
- Authentication: the existing Vault secret `call_analysis_retry_key`, matching the server's `CALL_ANALYSIS_CRON_SECRET` (or `CRON_SECRET` fallback). Secrets must never appear in migration source or logs.
- Release order: deploy the endpoint, then apply `20261021131046_owner_call_alerts_backend_scheduler.sql` to the app's existing Supabase project.
- Verify both `cron.job_run_details` and the corresponding `net._http_response`: a successful cron dispatch alone does not prove the HTTP worker succeeded. Expected response: HTTP 200, `ok: true`.
- Pause if needed with `select cron.alter_job(jobid, active := false) from cron.job where jobname = 'owner-call-alerts';`. Resume using `active := true`.

The worker retains queue leases, opt-out checks, a three-attempt cap, and protection against duplicate or uncertain sends. Do not retry `unknown` provider outcomes automatically.
