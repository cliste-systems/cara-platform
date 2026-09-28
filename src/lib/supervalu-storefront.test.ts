import assert from "node:assert/strict";
import test from "node:test";
import { classify, currentOfferWeek, promotionMechanic, normalizeCards, promoRows, readStorefrontPage, sourceDate } from "../../supabase/functions/supervalu-catalog-bootstrap/storefront";

function pageHtml(input: { ids?: string[]; total?: number; page?: number; take?: number; fail?: boolean } = {}) {
  const ids = input.ids ?? ["a", "b"];
  return `<script>window.__PRELOADED_STATE__=${JSON.stringify({ search: {
    activeCategory: "O200170", products: { category: ids, promotions: ids },
    productCardDictionary: Object.fromEntries(ids.map(sku => [sku, { sku, name: `Milk ${sku}; { }` }])),
    pagination: {
      category: { totalItems: input.total ?? 4, activePage: input.page ?? 1, itemsPerPage: input.take ?? 2, failedToLoad: input.fail ?? false },
      promotions: { totalItems: input.total ?? 4, activePage: input.page ?? 1, itemsPerPage: input.take ?? 2 },
    },
  } })}; window.__NONCE__="test";</script>`;
}

test("source pagination continues even when HTML omits rel=next", () => {
  const result = readStorefrontPage(pageHtml(), { categoryId: "O200170", page: 1, skip: 0, take: 2 });
  assert.equal(result.products.length, 2);
  assert.equal(result.hasNext, true);
  assert.equal(readStorefrontPage(pageHtml({ ids: ["c"], total: 3, page: 2 }), { categoryId: "O200170", page: 2, skip: 2, take: 2 }).hasNext, false);
});

test("all-department promotions use the promotions page, retaining every source promotion", () => {
  const result = readStorefrontPage(pageHtml(), { categoryId: "PROMOTIONS", page: 1, skip: 0, take: 2 });
  assert.equal(result.total, 4);
});

test("truncated, empty error and wrong-page HTML never count as successful complete crawls", () => {
  const args = { categoryId: "O200170", page: 1, skip: 0, take: 2 };
  assert.throws(() => readStorefrontPage("<html>Access denied</html>", args), /state missing/);
  assert.throws(() => readStorefrontPage(pageHtml({ ids: [] }), args), /Incomplete/);
  assert.throws(() => readStorefrontPage(pageHtml({ fail: true }), args), /timed out/);
  assert.throws(() => readStorefrontPage(pageHtml({ page: 2 }), args), /ignored requested page/);
  assert.throws(() => readStorefrontPage(pageHtml({ ids: ["a", "a"] }), args), /Duplicate/);
});

test("Ireland offer week changes at local Thursday midnight during summer time", () => {
  assert.deepEqual(currentOfferWeek(new Date("2026-09-23T23:15:00Z")), { start: "2026-09-24", end: "2026-09-30" });
  assert.deepEqual(currentOfferWeek(new Date("2026-09-23T22:59:59Z")), { start: "2026-09-17", end: "2026-09-23" });
});

test("source campaign dates survive beyond a single Thursday week", () => {
  assert.equal(sourceDate("14/10/2026"), "2026-10-14");
  assert.equal(sourceDate("31/02/2026"), null);
});

test("multibuy mechanics retain totals and never imply a single-item offer price", () => {
  assert.deepEqual(promotionMechanic("Any 3 for €10 Rewards Price"), { multibuy: true, quantity: 3, totalEur: 10 });
  assert.equal(promotionMechanic("Buy 1 Get 1 Free").multibuy, true);
  assert.equal(promotionMechanic("Mix & Match").multibuy, true);
  assert.equal(promotionMechanic("Save €2").multibuy, false);
});

test("full department breadcrumbs protect counter classification", () => {
  assert.equal(classify("Canned Mince", "Grocery/Food Cupboard/Canned Meat").serviceArea, "grocery");
  assert.equal(classify("Chicken Nuggets", "Grocery/Frozen Foods/Chicken").serviceArea, "grocery");
  assert.equal(classify("Milk & Treats", "Grocery/Pets/Cat & Kitten/Milk & Treats").serviceArea, "grocery");
  assert.equal(classify("Apples", "Grocery/Fruit & Vegetables/Fruit/Apples").serviceArea, "produce");
  assert.deepEqual(classify("Steaks", "Grocery/Meat & Poultry/Beef/Butcher/Steaks"), { serviceArea: "butcher", fulfilment: "counter" });
  assert.deepEqual(classify("Prepared by our butcher", "Grocery/Meat & Poultry/Prepared by our butcher"), { serviceArea: "butcher", fulfilment: "prepack" });
});

test("legacy single-store persistence cannot erase national offers", async () => {
  const { persistSupervaluNationalOffers } = await import("./supervalu-offers-persist");
  const client = { from() { throw new Error("Unexpected national table write"); } };
  const result = await persistSupervaluNationalOffers(client as never, []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /multi-store/);
});

test("legacy refresh queues the national crawler without publishing a one-store snapshot", async () => {
  const { syncSupervaluNationalOffers } = await import("./supervalu-offers-sync");
  const calls: unknown[] = [];
  const query = {
    select() { return query; }, eq() { return query; }, lte() { return query; }, gte() { return query; }, order() { return query; },
    async limit() { return { data: [], error: null }; },
  };
  const client = {
    async rpc(name: string, args: unknown) { calls.push({ name, args }); return { data: { dispatched: 3 }, error: null }; },
    from(table: string) { assert.equal(table, "retail_weekly_offers"); return query; },
  };
  const result = await syncSupervaluNationalOffers(client as never);
  assert.deepEqual(calls, [{ name: "request_supervalu_catalog_refresh", args: { p_kind: "offers" } }]);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.queued, true);
  const singleStore = await syncSupervaluNationalOffers(client as never, { storeId: "5550" });
  assert.equal(singleStore.ok, false);
  assert.equal(calls.length, 1);
});


const observedAt = "2026-09-27T12:00:00Z";
const week = { start: "2026-09-24", end: "2026-09-30" };
function normalizedProduct(overrides: Record<string, unknown> = {}) {
  return normalizeCards([{
    sku: "beef-steak", name: "SuperValu Irish Beef Steak (1 kg)", price: "€13.39", wasPrice: "€19.99",
    sellBy: "weight", unitPrice: "€13.39/kg", unitOfPrice: { type: "kilogram" },
    defaultCategory: [{ category: "Steaks", categoryBreadcrumb: "Grocery/Meat & Poultry/Beef/Butcher/Steaks" }],
    promotions: [{ id: "meat", name: "Save 33%", startDate: "24/09/2026", endDate: "30/09/2026" }],
    ...overrides,
  }], "All promotions", "/promotions", '<article data-testid="ProductCardWrapper-beef-steak"><a href="/product/observed-beef-steak-id-beef-steak">Steak</a></article>')[0];
}

test("meat percentage rows use source selling and former prices, not the saving", () => {
  const card = normalizedProduct();
  const [row] = promoRows(card, "listing", week, observedAt);
  assert.equal(card.serviceArea, "butcher");
  assert.equal(card.fulfilment, "counter");
  assert.equal(card.sourceUrl, "/product/observed-beef-steak-id-beef-steak");
  assert.equal(row.offer_price_eur, 13.39);
  assert.equal(row.regular_price_eur, 19.99);
  assert.equal(row.promotion_type, "percentage");
  assert.equal(row.scope, "store");
  assert.equal(row.national_store_count, 1);
});

test("loyalty and simultaneous source promotions are retained with exact campaign dates", () => {
  const card = normalizedProduct({ price: "€1.75", wasPrice: "€2.25", promotions: [
    { id: "milk", name: "Rewards Price Only €1.75", loyaltyBased: true, startDate: "24/09/2026", endDate: "14/10/2026" },
    { id: "bundle", name: "3 for €10", startDate: "03/09/2026", endDate: "07/10/2026" },
  ] });
  const rows = promoRows(card, "listing", week, observedAt);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].offer_price_eur, 1.75);
  assert.equal(rows[0].loyalty_required, true);
  assert.equal(rows[0].loyalty_program, "Real Rewards");
  assert.equal(rows[0].valid_to, "2026-10-14");
  assert.equal(rows[1].valid_from, "2026-09-03");
  assert.equal(rows[1].valid_to, "2026-10-07");
  assert.equal(rows[1].offer_price_eur, null);
  assert.equal(rows[1].source_metadata.multibuy_quantity, 3);
  assert.equal(rows[1].source_metadata.multibuy_total_eur, 10);
});

test("free-item bundles and saving badges cannot become false unit prices", () => {
  const card = normalizedProduct({ price: "€3.99", promotions: [
    { name: "Buy 1 Get 1 Free" }, { name: "Real Rewards Save €2", loyaltyBased: true },
  ] });
  const rows = promoRows(card, "listing", week, observedAt);
  assert.equal(rows[0].promotion_type, "multibuy");
  assert.equal(rows[0].offer_price_eur, null);
  assert.equal(rows[1].offer_price_eur, 3.99);
});

test("expired, future and malformed promotions cannot be presented as current", () => {
  const card = normalizedProduct({ promotions: [
    { name: "Old offer", startDate: "17/09/2026", endDate: "23/09/2026" },
    { name: "Next offer", startDate: "01/10/2026", endDate: "07/10/2026" },
  ] });
  assert.deepEqual(promoRows(card, "listing", week, observedAt), []);
  assert.throws(() => promoRows(normalizedProduct({ promotions: [{ name: "Broken", startDate: "31/09/2026" }] }), "listing", week, observedAt), /Invalid source validity/);
  const noOffer = normalizedProduct({ price: "€2", wasPrice: "€2", promotions: [] });
  assert.deepEqual(promoRows(noOffer, "listing", week, observedAt), []);
});

test("material source terms survive into voice-search description and raw metadata", () => {
  const card = normalizedProduct({ promotions: [{
    id: "conditional", name: "Special offer", description: "Special offer",
    additionalInformation: "Selected 500 g packs only. Activate this coupon before paying.",
    limit: "One redemption per customer", minimumQuantity: 2, limitPerSku: 4,
    threshold: 0, loyaltyBased: true,
    startDate: "24/09/2026", endDate: "30/09/2026",
  }] });
  const [row] = promoRows(card, "listing", week, observedAt);
  assert.match(row.description, /Selected 500 g packs only/);
  assert.match(row.description, /Activate this coupon before paying/);
  assert.match(row.description, /Minimum quantity: 2/);
  assert.match(row.description, /Limit per product: 4/);
  assert.match(row.description, /One redemption per customer/);
  assert.match(row.description, /Real Rewards membership required/);
  assert.equal(row.source_metadata.minimum_quantity, 2);
  assert.equal(row.source_metadata.limit_per_sku, 4);
  assert.equal(row.source_metadata.threshold, 0);
  assert.equal(row.source_metadata.condition_verification_required, false);
});

test("unknown threshold semantics are retained without inventing a minimum euro spend", () => {
  const card = normalizedProduct({ promotions: [{ name: "Conditional offer", threshold: 20, externalOffers: true }] });
  const [row] = promoRows(card, "listing", week, observedAt);
  assert.equal(row.source_metadata.threshold, 20);
  assert.equal(row.source_metadata.external_offers, true);
  assert.equal(row.source_metadata.condition_verification_required, true);
  assert.match(row.description, /qualifying threshold applies/);
  assert.doesNotMatch(row.description, /€20|spend 20/i);
});

test("unsupported source channels are reported, never mistaken for parsed product offers", async () => {
  const { storefrontCoverageReport, mergeStorefrontCoverageReports } = await import("../../supabase/functions/supervalu-catalog-bootstrap/storefront");
  const report = storefrontCoverageReport({
    promotions: { cartpromoList: [{ name: "Spend and save" }], bundleGroups: [{ id: "bundle" }] },
    coupons: { couponsDictionary: { app: { activate: true } } },
    couponGallery: { couponIds: ["app"] }, discountsAndCharges: { vouchers: [{ code: "EXAMPLE" }] },
  }, [{ sku: "points", showCoupon: true, pointsBasedPromotions: [{ points: 500 }], promotions: [{ threshold: 20 }] }]);
  assert.equal(report.every_offer_type_verified, false);
  assert.equal(report.unsupported_observations.product_points_promotions, 1);
  assert.equal(report.unsupported_observations.cart_promotions, 1);
  assert.equal(report.unsupported_observations.promotion_bundle_groups, 1);
  assert.equal(report.unsupported_observations.app_product_coupons, 1);
  assert.equal(report.unsupported_observations.coupon_gallery, 1);
  assert.equal(report.unsupported_observations.basket_vouchers, 1);
  assert.equal(report.unsupported_observations.uninterpreted_thresholds, 1);
  assert.equal(mergeStorefrontCoverageReports([report, report]).unsupported_observations.product_points_promotions, 2);
  const empty = storefrontCoverageReport();
  assert.equal(empty.every_offer_type_verified, false);
  assert.ok(empty.unverified_offer_channels.includes("points_events"));
  assert.match(empty.observation_note, /Empty anonymous channels do not establish/);
});

test("official leaflet campaign links are evidence, never inferred SKU eligibility or prices", async () => {
  const { readLeafletCampaignLinks } = await import("../../supabase/functions/supervalu-catalog-bootstrap/storefront");
  const manifest = { pages: [{ hotspots: [
    { title: "€20 Wine", url: "https://shop.supervalu.ie/wine-cellar-from-15?df=tracking" },
    { title: "Fruit & Veg Offers - Super Fresh 5", url: "https://shop.supervalu.ie/super-stars-fruit-veg" },
    { title: "Next page", url: "https://supervalu.ie/offers/leaflet/614#page2" },
  ] }] };
  const report = readLeafletCampaignLinks(`<script>var manifest = ${JSON.stringify(manifest)};</script>`, "https://supervalu.ie/offers/leaflet/614");
  assert.equal(report.page_count, 1);
  assert.equal(report.source_hotspot_count, 3);
  assert.equal(report.shop_link_count, 2);
  assert.equal(report.links[0].url, "https://shop.supervalu.ie/wine-cellar-from-15");
  assert.equal(report.links[1].title, "Fruit & Veg Offers - Super Fresh 5");
  assert.equal(report.product_membership_verified, false);
  assert.equal(report.price_and_conditions_verified, false);
  assert.ok(report.limitation.includes("not assigned"));
  assert.throws(() => readLeafletCampaignLinks("", "https://example.com/offers/leaflet/614"), /Unrecognized/);
});

test("catalog writes retry transaction collisions only and stop after four attempts", async () => {
  const { retryCatalogWrite } = await import("../../supabase/functions/supervalu-catalog-bootstrap/storefront");
  let calls = 0;
  const success = await retryCatalogWrite(async () => ({ error: ++calls < 3 ? { code: "40P01" } : null }), async () => {});
  assert.equal(success.error, null); assert.equal(calls, 3);
  calls = 0;
  await retryCatalogWrite(async () => { calls++; return { error: { code: "40001" } }; }, async () => {});
  assert.equal(calls, 4);
  calls = 0;
  await retryCatalogWrite(async () => { calls++; return { error: { code: "23505" } }; }, async () => {});
  assert.equal(calls, 1);
});
