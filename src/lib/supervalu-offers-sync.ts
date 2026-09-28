import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import { currentSupervaluOfferWeek } from "@/lib/supervalu-offers-normalize";
import { SUPERVALU_MIN_FULL_STORE_OFFER_COUNT, type SupervaluOffersSyncResult } from "@/lib/supervalu-offers-types";

export {
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSupervaluGatewayProduct,
} from "@/lib/supervalu-offers-normalize";

export type SyncSupervaluNationalOffersOptions = {
  storeId?: string;
  /** Cron: skip when today's sync already loaded the current offer week. */
  skipIfAlreadySyncedToday?: boolean;
  /** Cron safety net: only sync when the DB is still on a prior offer week. */
  retryOnlyIfStaleWeek?: boolean;
  /** @deprecated Use retryOnlyIfStaleWeek on the Friday safety-net cron. */
  retryOnlyIfLowCount?: boolean;
  /** Use legacy meat-only fetch instead of full-store snapshot. */
  meatPilotOnly?: boolean;
  /** Skip Cara prompt recompile (CLI scripts). */
  skipPromptRecompile?: boolean;
};

const DUBLIN = "Europe/Dublin";

export type SupervaluOfferSyncMeta = {
  syncedAt: string | null;
  offerCount: number;
  offerWeekStart: string | null;
  offerWeekEnd: string | null;
};

/** True when the stored batch is from a previous SuperValu offer week. */
export function isSupervaluOfferWeekStale(
  meta: Pick<SupervaluOfferSyncMeta, "offerWeekStart" | "offerWeekEnd">,
  reference = new Date(),
): boolean {
  const week = currentSupervaluOfferWeek(reference);
  const start = String(meta.offerWeekStart ?? "").trim();
  if (!start || start !== week.start) return true;
  const today = formatInTimeZone(reference, DUBLIN, "yyyy-MM-dd");
  const end = String(meta.offerWeekEnd ?? "").trim();
  return !end || end < today;
}

/** Thursday repeat crons: skip when we already synced the current week today. */
export function shouldSkipThursdayOffersSync(
  meta: SupervaluOfferSyncMeta,
  reference = new Date(),
): boolean {
  if (isSupervaluOfferWeekStale(meta, reference)) return false;
  if (meta.offerCount < SUPERVALU_MIN_FULL_STORE_OFFER_COUNT) return false;
  if (!meta.syncedAt) return false;
  const syncedDay = formatInTimeZone(new Date(meta.syncedAt), DUBLIN, "yyyy-MM-dd");
  const today = formatInTimeZone(reference, DUBLIN, "yyyy-MM-dd");
  return syncedDay === today;
}

/** Dispatch the durable multi-store crawler. A single shop is never a national source. */
export async function syncSupervaluNationalOffers(
  supabase: SupabaseClient,
  options?: SyncSupervaluNationalOffersOptions,
): Promise<SupervaluOffersSyncResult> {
  if (options?.meatPilotOnly || options?.storeId) {
    return { ok: false, message: "National refresh requires the configured multi-store source set; single-store and meat-only publication is disabled." };
  }
  const { data, error } = await supabase.rpc("request_supervalu_catalog_refresh", { p_kind: "offers" });
  if (error) return { ok: false, message: error.message };
  if (data?.ok === false) return { ok: false, message: String(data.message ?? data.error ?? "National refresh could not be queued") };
  const meta = await loadLatestSupervaluOfferSyncMeta(supabase);
  return {
    ok: true, queued: true, syncBatchId: "queued-national-consensus",
    offerCount: meta.offerCount, organizationsUpdated: 0,
    offerWeekStart: meta.offerWeekStart ?? "", offerWeekEnd: meta.offerWeekEnd ?? "",
    syncedAt: meta.syncedAt ?? "",
  };
}

export async function loadLatestSupervaluOfferSyncMeta(
  supabase: SupabaseClient,
): Promise<SupervaluOfferSyncMeta> {
  const { data, error } = await supabase
    .from("retail_weekly_offers")
    .select("sync_batch_id, synced_at, offer_week_start, offer_week_end")
    .eq("retail_banner", "supervalu")
    .eq("is_national", true)
    .lte("offer_week_start", formatInTimeZone(new Date(), DUBLIN, "yyyy-MM-dd"))
    .gte("offer_week_end", formatInTimeZone(new Date(), DUBLIN, "yyyy-MM-dd"))
    .order("synced_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    return {
      syncedAt: null,
      offerCount: 0,
      offerWeekStart: null,
      offerWeekEnd: null,
    };
  }

  const latest = data[0];
  const { count } = await supabase
    .from("retail_weekly_offers")
    .select("id", { count: "exact", head: true })
    .eq("retail_banner", "supervalu")
    .eq("is_national", true)
    .eq("sync_batch_id", latest.sync_batch_id)
    .lte("offer_week_start", formatInTimeZone(new Date(), DUBLIN, "yyyy-MM-dd"))
    .gte("offer_week_end", formatInTimeZone(new Date(), DUBLIN, "yyyy-MM-dd"));

  return {
    syncedAt: String(latest.synced_at ?? ""),
    offerCount: count ?? 0,
    offerWeekStart: String(latest.offer_week_start ?? ""),
    offerWeekEnd: String(latest.offer_week_end ?? ""),
  };
}
