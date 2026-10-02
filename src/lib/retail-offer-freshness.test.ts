import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRetailOfferObservationFresh } from "./retail-offer-freshness";
import { assessSyncedOffersFreshness, buildRetailWeeklyOffersPromptSection, filterRetailWeeklyOffersToActiveWeek, searchRetailWeeklyOffers, searchSyncedWeeklyOffersInRows } from "./retail-weekly-offers-search";
import { searchStructuredNationalPromotions } from "./retail-promotion-search";
import { resolveStoredRetailPrice } from "./retail-price-presentation";
import { searchSupervaluCatalogLive } from "./supervalu-catalog-search";
import type { RetailWeeklyOfferRow } from "./supervalu-offers-types";

const reference = new Date("2026-09-27T12:00:00Z");
const fresh = "2026-09-27T11:00:00Z";
const stale = "2026-09-25T11:59:59Z";
const observations = [fresh, stale, "2026-09-27T12:00:01Z", "invalid", ""];

function weeklyRow(id: string, observed: string): RetailWeeklyOfferRow {
  return {
    id, product_name: id, organization_id: null, retail_banner: "supervalu", sync_batch_id: "batch",
    department: "Milk", service_area: "dairy", fulfilment: "prepack", offer_channel: "grocery",
    current_price_eur: 1, was_price_eur: 2, discount_label: "Only €1", price_per_unit: null,
    category_breadcrumb: "Milk", sell_by: null, price_unit_type: null, is_alcohol: false,
    brand: null, sku: id, offer_week_start: "2026-09-24", offer_week_end: "2026-09-30",
    source_url: null, search_text: `${id} milk`, synced_at: observed,
  };
}

function database(offers: RetailWeeklyOfferRow[], products: unknown[] = []) {
  return {
    from(table: string) {
      const rows = table === "retail_weekly_offers" ? offers : products;
      return {
        select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; },
        ilike() { return this; }, order() { return this; },
        async range(from: number, to: number) { return { data: rows.slice(from, to + 1), error: null }; },
      };
    },
  };
}

describe("48-hour source observation guard", () => {
  it("requires a real nonfuture timestamp and accepts the exact 48-hour boundary", () => {
    assert.equal(isRetailOfferObservationFresh("2026-09-25T12:00:00Z", reference), true);
    assert.equal(isRetailOfferObservationFresh(reference.toISOString(), reference), true);
    for (const timestamp of [stale, "2026-09-27T12:00:00.001Z", "invalid", "", null, undefined]) {
      assert.equal(isRetailOfferObservationFresh(timestamp, reference), false, String(timestamp));
    }
  });

  it("suppresses stale rows in both in-memory and legacy database offer search", async () => {
    const rows = observations.map((observed, index) => weeklyRow(`Milk ${index}`, observed));
    assert.deepEqual(filterRetailWeeklyOffersToActiveWeek(rows, reference).map((row) => row.id), ["Milk 0"]);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "milk offers", { reference }).map((row) => row.id), ["Milk 0"]);
    const matches = await searchRetailWeeklyOffers(database(rows) as never, "supervalu", "milk offers", { reference });
    assert.deepEqual(matches.map((row) => row.id), ["Milk 0"]);
  });

  it("cannot revive stale row evidence with a new global sync timestamp or prompt", () => {
    const row = weeklyRow("Old Milk", stale);
    assert.equal(buildRetailWeeklyOffersPromptSection({ offers: [row], syncedAt: fresh, reference }), null);
    const warning = assessSyncedOffersFreshness({ syncedAt: stale, offerWeekEnd: row.offer_week_end, reference });
    assert.equal(warning.stale, true);
    assert.match(warning.message ?? "", /48 hours/);
    assert.match(warning.message ?? "", /Do not quote older/);
  });

  it("requires per-result RPC observation evidence even for date-valid bundles", async () => {
    const rows = observations.map((observed, index) => ({
      product_name: `Berries ${index}`, department: "Fruit", sku: `${index}`, service_area: "produce", fulfilment: "prepack", is_alcohol: false,
      promotion_type: "multibuy", loyalty_required: false, label: "3 for €10", description: null,
      offer_price_eur: null, regular_price_eur: null, display_price_eur: null, price_per_unit: null, source_store_count: 3,
      valid_from: "2026-09-24", valid_to: "2026-09-30", source_metadata: observed ? { source_observed_at: observed } : {},
    }));
    const client = { async rpc(_name: string, args: Record<string, unknown>) {
      assert.equal(args.p_reference_date, "2026-09-27");
      return { data: rows, error: null };
    } };
    const matches = await searchStructuredNationalPromotions(client as never, { retailBanner: "supervalu", query: "3 for 10", reference });
    assert.deepEqual(matches.map((row) => row.productName), ["Berries 0"]);
    assert.equal(matches[0]?.currentPriceEur, null);
    assert.match(matches[0]?.quoteText ?? "", /three for ten euro/i);
  });

  it("keeps regular national range evidence while suppressing a stale product promotion", async () => {
    const old = weeklyRow("Milk", stale);
    const product = { id: "milk", sku: "milk", product_name: "Milk", brand: null, department: "Milk", service_area: "dairy", fulfilment: "prepack", is_alcohol: false, search_text: "milk", national_store_count: 4, national_regular_price_eur: 2.5 };
    const client = database([old], [product]);
    const offers = await searchSupervaluCatalogLive("milk offers", { supabase: client as never, retailBanner: "supervalu", reference });
    assert.deepEqual(offers, []);
    const range = await searchSupervaluCatalogLive("price of milk", { supabase: client as never, retailBanner: "supervalu", reference });
    assert.equal(range.length, 1);
    assert.equal(range[0]?.currentPriceEur, 2.5);
    assert.equal(range[0]?.isOnOffer, false);
  });

  it("does not recover stale or unobserved discounts through a stored-price fallback", () => {
    for (const observed of observations.slice(1)) {
      const price = resolveStoredRetailPrice({ regular_price_eur: 4, display_price_eur: 2, source_price_label: "Only €2", price_per_unit: null,
        retail_promotions: [{ promotion_type: "standard_offer", loyalty_required: false, loyalty_program: null, offer_price_eur: 2, regular_price_eur: 4, label: "Only €2", valid_from: "2026-09-24", valid_to: "2026-09-30", synced_at: observed }],
      }, reference);
      assert.equal(price.isOnOffer, false, observed);
      assert.equal(price.offerLabel, null);
      assert.equal(price.currentPriceEur, 4);
    }
  });
});
