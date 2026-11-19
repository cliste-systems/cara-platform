-- Index the scheduler's per-store history and retention lookups.
SET lock_timeout = '90s';
CREATE INDEX IF NOT EXISTS retail_bootstrap_store_created_idx
 ON public.retail_catalog_bootstrap_requests (source_store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS retail_bootstrap_created_idx
 ON public.retail_catalog_bootstrap_requests (created_at);
CREATE INDEX IF NOT EXISTS retail_queue_batch_idx
 ON public.retail_catalog_category_queue (sync_batch_id, source_store_id, status);
CREATE INDEX IF NOT EXISTS retail_runs_completed_store_idx
 ON public.retail_catalog_sync_runs (retail_banner, source_store_id, completed_at DESC)
 WHERE status = 'completed';
ANALYZE public.retail_catalog_bootstrap_requests;
ANALYZE public.retail_catalog_category_queue;
ANALYZE public.retail_catalog_sync_runs;
