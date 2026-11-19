import { runSupervaluCatalogSyncCron } from "@/lib/supervalu-catalog-sync-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = runSupervaluCatalogSyncCron;
export const POST = runSupervaluCatalogSyncCron;
