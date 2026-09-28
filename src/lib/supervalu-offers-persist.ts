import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type NormalizedWeeklyOffer,
} from "@/lib/supervalu-offers-normalize";
import {
  type SupervaluOffersSyncResult,
} from "@/lib/supervalu-offers-types";

export async function persistSupervaluNationalOffers(
  supabase: SupabaseClient,
  offers: NormalizedWeeklyOffer[],
): Promise<
  | {
      ok: true;
      syncBatchId: string;
      offerCount: number;
      organizationIds: string[];
      offerWeekStart: string;
      offerWeekEnd: string;
      syncedAt: string;
      serviceAreaCounts: Record<string, number>;
    }
  | { ok: false; message: string }
> {
  // A single source store cannot establish national availability or prices.
  // The public storefront consensus crawler is the only national publisher.
  // Previously this path deleted every verified row and replaced it with
  // is_national=false rows, making all offers disappear from Cara's search.
  void supabase;
  void offers;
  return {
    ok: false,
    message: "National SuperValu offers must be published by the multi-store public storefront crawler; single-store snapshot publication is disabled.",
  };
}

export function toSupervaluOffersSyncResult(
  persisted: Extract<
    Awaited<ReturnType<typeof persistSupervaluNationalOffers>>,
    { ok: true }
  >,
): Extract<SupervaluOffersSyncResult, { ok: true }> {
  return {
    ok: true,
    syncBatchId: persisted.syncBatchId,
    offerCount: persisted.offerCount,
    organizationsUpdated: persisted.organizationIds.length,
    offerWeekStart: persisted.offerWeekStart,
    offerWeekEnd: persisted.offerWeekEnd,
    syncedAt: persisted.syncedAt,
    serviceAreaCounts: persisted.serviceAreaCounts,
  };
}
