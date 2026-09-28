/** Pure helpers shared by the production crawler and regression tests. */
export function dublinDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
export function currentOfferWeek(now = new Date()) {
  const start = new Date(`${dublinDate(now)}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 3) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function sourceDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

// Parse JSON as data, never evaluate source-page JavaScript. Product data
// includes the retailer's start/end dates, all simultaneous promotions and
// authoritative pagination counts, which rendered card badges omit.
function readJsonAssignment(html: string, pattern: RegExp, sourceName: string): Record<string, any> {
  const marker = pattern.exec(html);
  if (!marker) throw new Error(`${sourceName} missing; refusing an empty successful crawl`);
  const start = marker.index + marker[0].length;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }
  throw new Error(`${sourceName} incomplete`);
}
export function readStorefrontState(html: string): Record<string, any> {
  return readJsonAssignment(html, /window\.__PRELOADED_STATE__\s*=\s*/, "Public storefront product state");
}

/** Official leaflet links identify campaigns, not the eligibility of linked products. */
export function readLeafletCampaignLinks(html: string, leafletUrl: string) {
  const source = new URL(leafletUrl);
  if (source.protocol !== "https:" || source.hostname !== "supervalu.ie" || !/^\/offers\/leaflet\/\d+\/?$/.test(source.pathname)) {
    throw new Error("Unrecognized official leaflet source");
  }
  const manifest = readJsonAssignment(html, /(?:var|let|const)\s+manifest\s*=\s*/, "Official leaflet manifest");
  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) throw new Error("Official leaflet has no pages");
  const links: Array<{ title: string; url: string; page: number }> = [];
  let hotspotCount = 0;
  for (let pageIndex = 0; pageIndex < manifest.pages.length; pageIndex++) {
    for (const hotspot of manifest.pages[pageIndex]?.hotspots ?? []) {
      hotspotCount++;
      if (!hotspot?.title || !hotspot?.url) continue;
      const url = new URL(String(hotspot.url), source);
      if (url.protocol !== "https:" || url.hostname !== "shop.supervalu.ie") continue;
      // Tracking parameters are not campaign identity or offer conditions.
      url.searchParams.delete("df");
      links.push({ title: clean(hotspot.title), url: url.toString(), page: pageIndex + 1 });
    }
  }
  return {
    source_url: source.toString(), page_count: manifest.pages.length,
    source_hotspot_count: hotspotCount, shop_link_count: links.length,
    product_membership_verified: false, price_and_conditions_verified: false,
    limitation: "Leaflet links can target broad collections. Titles and prices are not assigned to linked products without explicit membership and current product promotion evidence.",
    links,
  };
}

export function readStorefrontPage(html: string, input: {
  categoryId: string; page: number; skip: number; take: number;
}) {
  const state = readStorefrontState(html);
  const search = state.search;
  const section = input.categoryId === "PROMOTIONS" ? "promotions" : "category";
  const pagination = search?.pagination?.[section];
  const ids = search?.products?.[section];
  if (search?.searchTimedOut || pagination?.failedToLoad) throw new Error("Public storefront search timed out");
  if (!pagination || !Array.isArray(ids)) throw new Error("Public storefront product pagination missing");
  if (section === "category" && search.activeCategory !== input.categoryId) {
    throw new Error(`Category mismatch: expected ${input.categoryId}, received ${search.activeCategory}`);
  }
  const total = Number(pagination.totalItems);
  const take = Number(pagination.itemsPerPage);
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(take) || take < 1) {
    throw new Error("Public storefront product count invalid");
  }
  if (Number(pagination.activePage) !== input.page) throw new Error("Public storefront ignored requested page");
  const products = ids.map((sku: string) => search.productCardDictionary?.[sku]);
  if (products.some((p: any) => !p?.sku || !p?.name)) throw new Error("Public storefront product dictionary incomplete");
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate product identities within source page");
  const expected = Math.max(0, Math.min(take, total - input.skip));
  if (products.length !== expected) {
    throw new Error(`Incomplete storefront page: received ${products.length}, expected ${expected} of ${total}`);
  }
  return { products, total, take, hasNext: input.skip + products.length < total, state };
}

export function classify(categoryName: string, href: string) {
  const x = `${categoryName} ${href}`.toLowerCase();
  const segments = href.toLowerCase().split("/").filter(Boolean);
  const top = segments[0] === "grocery" ? segments[1] ?? "" : "";
  let serviceArea = "grocery";
  // Prefer the actual department. Leaf words such as meat, milk or butter
  // must not move pet food, canned meals or baking ingredients to counters.
  if (top && /food cupboard|pets|baby|household|beauty|health|newsagent/.test(top)) serviceArea = "grocery";
  else if (top && /frozen/.test(top)) serviceArea = /fish|seafood/.test(x) ? "fish" : "grocery";
  else if (top && /chilled food/.test(top)) serviceArea = /sliced cooked meats/.test(x) ? "deli" : "grocery";
  else if (/wine|beer|spirits|off.?licen|cider/.test(top || x)) serviceArea = "off_licence";
  else if (/deli/.test(top || x)) serviceArea = "deli";
  else if (/fish|seafood/.test(top || x)) serviceArea = "fish";
  else if (/meat|poultry|butcher|prepack/.test(top || x)) serviceArea = "butcher";
  else if (/fruit|vegetables|fresh.?fruit.?veg/.test(top || x)) serviceArea = "produce";
  else if (/bakery|bread|cake/.test(top || x)) serviceArea = "bakery";
  else if (/milk|yogurt|yoghurt|cheese|butter|dairy/.test(top || x)) serviceArea = "dairy";
  const explicitlyPrepack = /pre.?pack|packaged/.test(x);
  const counterPath = /(?:^|\/)butcher(?:\/|$|-id-)|deli.counter|fish.counter|\bcounter\b|\bloose\b|by.?weight/.test(x);
  return { serviceArea, fulfilment: !explicitlyPrepack && counterPath ? "counter" : "prepack" };
}

export function promotionMechanic(label: string) {
  const multi = label.match(/\b(?:any\s+)?(\d+)\s+for\s+(?:€\s*)?([0-9]+(?:[.,][0-9]{1,2})?)(?:\s*euro)?\b/i);
  const multiOther = /\bbuy\s+\d+.*\b(?:get|free)|\bbuy\s+one.*\bget\s+one|\b(?:bogof|mix\s*(?:&|and)\s*match)\b/i.test(label);
  return { multibuy: Boolean(multi) || multiOther, quantity: multi ? Number(multi[1]) : null, totalEur: multi ? Number(multi[2].replace(",", ".")) : null };
}

export function clean(s: string | null | undefined) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function eur(s: string | null | undefined): number | null {
  const text = String(s ?? "");
  const euro = text.match(/€\s*([0-9]+(?:[.,][0-9]{1,2})?)/);
  if (euro) {
    const n = Number(euro[1].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const cents = text.match(/\b([0-9]{1,2})\s*c\b/i);
  if (cents) {
    const n = Number(cents[1]) / 100;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
export function normalizeCards(products: any[], categoryName: string, href: string, html: string) {
  // Read only observed product links; no DOM or inferred product URL is needed.
  const sourceUrls = new Map<string, string>();
  for (const article of html.matchAll(/<article\b[^>]*data-testid="ProductCardWrapper-([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)) {
    const href = article[2].match(/<a\b[^>]*href="([^"]*\/product\/[^"]*)"/);
    if (href) sourceUrls.set(article[1], href[1].replace(/&amp;/g, "&"));
  }
  return products.map((product) => {
    const sku = clean(product.sku);
    const category = product.defaultCategory?.[0] ?? [...(product.categories ?? [])].reverse()[0];
    const breadcrumb = clean(category?.categoryBreadcrumb) || href;
    const department = clean(category?.category) || categoryName;
    const classification = classify(department, breadcrumb);
    const displayPrice = eur(product.price);
    const regularPrice = eur(product.wasPrice) ?? eur(product.subtotalWithoutLoyalty) ?? displayPrice;
    const promotions = [...(product.promotions ?? [])];
    if (!promotions.length && (product.priceLabel || (regularPrice && displayPrice && regularPrice > displayPrice))) {
      promotions.push({ name: clean(product.priceLabel) || `Was €${regularPrice!.toFixed(2)}`, description: null });
    }
    return {
      sku, name: clean(product.name), brand: clean(product.brand) || null,
      sourceUrl: sourceUrls.get(sku) ?? null,
      department, breadcrumb, displayPrice, regularPrice,
      unitPrice: clean(product.unitPrice) || null,
      sellBy: clean(product.sellBy) || null,
      priceUnitType: clean(product.unitOfPrice?.type) || null,
      promotions,
      badges: [...new Set(promotions.map((p: any) => clean(p.name || p.description)).filter(Boolean))],
      isAlcohol: product.attributes?.["Alcohol Restricted"] === true || classification.serviceArea === "off_licence",
      searchText: clean([product.name, product.brand, department, breadcrumb, sku, ...promotions.map((p: any) => p.name)].filter(Boolean).join(" ")).toLowerCase(),
      ...classification,
    };
  });
}
export function promoRows(card: any, storeProductId: string, week: {start:string,end:string}, now: string) {
  const today = dublinDate(new Date(now));
  return card.promotions.flatMap((promotion: any) => {
    const label = clean(promotion.name || promotion.description);
    if (!label) return [];
    if ((promotion.startDate && !sourceDate(promotion.startDate)) || (promotion.endDate && !sourceDate(promotion.endDate))) {
      throw new Error(`Invalid source validity dates for promotion ${promotion.id || label}`);
    }
    const validFrom = sourceDate(promotion.startDate) ?? week.start;
    const validTo = sourceDate(promotion.endDate) ?? week.end;
    if (validTo < today || validFrom > today || validTo < validFrom) return [];
    const loyalty = promotion.loyaltyBased === true || /rewards?\s+price|real\s+rewards?/i.test(label);
    const multi = promotionMechanic(label);
    const savePercent = label.match(/\bsave\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i);
    const promotionType = multi.multibuy ? "multibuy" : loyalty ? "loyalty" : savePercent ? "percentage" : "standard_offer";
    // A multi-buy total, saving amount or points reward is never a unit price.
    const explicitLoyaltyPrice = loyalty && /\bonly\s*€|\bprice\s*€/i.test(label) ? eur(label) : null;
    const offerPrice = multi.multibuy ? null : explicitLoyaltyPrice ?? card.displayPrice;
    return [{
      store_product_id: storeProductId,
      promotion_key: [promotionType, validFrom, promotion.id || label].join(":").slice(0, 240),
      promotion_type: promotionType, loyalty_required: loyalty,
      scope: "store", national_store_count: 1,
      loyalty_program: loyalty ? "Real Rewards" : null,
      offer_price_eur: offerPrice, regular_price_eur: card.regularPrice,
      label, description: promotionConditions(promotion),
      valid_from: validFrom, valid_to: validTo, synced_at: now,
      source_metadata: {
        source: "supervalu_public_storefront", source_promotion_id: promotion.id || null,
        source_validity: Boolean(sourceDate(promotion.startDate) && sourceDate(promotion.endDate)),
        multibuy_quantity: multi.quantity, multibuy_total_eur: multi.totalEur,
        mechanic: multi.multibuy ? "multibuy" : loyalty ? "loyalty" : savePercent ? "save_percent" : /half\s+price/i.test(label) ? "half_price" : /super\s*7/i.test(label) ? "super_7" : "named_or_generic",
        additional_information: promotion.additionalInformation ?? null,
        source_description: promotion.description ?? null,
        limit: promotion.limit ?? null,
        minimum_quantity: promotion.minimumQuantity ?? null,
        threshold: promotion.threshold ?? null,
        limit_per_sku: promotion.limitPerSku ?? null,
        external_offers: promotion.externalOffers ?? null,
        condition_verification_required: (promotion.threshold != null && Number(promotion.threshold) !== 0) || promotion.externalOffers === true,
      },
      updated_at: now,
    }];
  });
}

export const UNVERIFIED_OFFER_CHANNELS = [
  "basket_vouchers_and_spend_save", "app_and_personal_coupons",
  "points_events", "separate_cart_and_bundle_promotions", "campaign_only_conditions",
] as const;

/** Preserve source wording and only interpret fields with unambiguous units. */
export function promotionConditions(promotion: Record<string, any>): string | null {
  const label = clean(promotion.name || promotion.description);
  const parts: string[] = [];
  const add = (text: string) => {
    const normalized = clean(text);
    if (normalized && normalized.toLowerCase() !== label.toLowerCase() &&
        !parts.some((part) => part.toLowerCase() === normalized.toLowerCase())) parts.push(normalized);
  };
  add(promotion.description);
  add(promotion.additionalInformation);
  const minimum = Number(promotion.minimumQuantity);
  if (Number.isInteger(minimum) && minimum > 1 && promotionMechanic(label).quantity !== minimum) {
    add(`Minimum quantity: ${minimum}.`);
  }
  const perProduct = Number(promotion.limitPerSku);
  if (Number.isInteger(perProduct) && perProduct > 0) add(`Limit per product: ${perProduct}.`);
  if (promotion.limit != null && clean(String(promotion.limit)) && String(promotion.limit) !== "0") {
    add(`Limit: ${clean(String(promotion.limit))}.`);
  }
  // The public payload does not establish whether threshold is a spend,
  // quantity or points threshold. Keep its raw value and flag the ambiguity.
  if (promotion.threshold != null && Number(promotion.threshold) !== 0 && clean(String(promotion.threshold))) {
    add("An additional qualifying threshold applies; check the offer terms.");
  }
  if (promotion.externalOffers === true) add("This promotion is marked as an external offer; check the offer terms.");
  if (promotion.loyaltyBased === true && !/real\s+rewards|rewards?\s+price|rewards?\s+members/i.test([label, ...parts].join(" "))) {
    add("Real Rewards membership required.");
  }
  return parts.length ? parts.join(" ") : null;
}

export type StorefrontCoverageReport = {
  every_offer_type_verified: false;
  supported_sources: string[];
  unverified_offer_channels: readonly string[];
  unsupported_observations: Record<string, number>;
  warnings: string[];
  observation_note: string;
};

export function storefrontCoverageReport(
  state: Record<string, any> = {}, products: any[] = [],
): StorefrontCoverageReport {
  const size = (value: unknown) => Array.isArray(value) ? value.length
    : value && typeof value === "object" ? Object.keys(value).length : 0;
  const observations: Record<string, number> = {};
  const observe = (key: string, count: number) => { if (count > 0) observations[key] = count; };
  observe("product_points_promotions", products.reduce((count, p) => count + size(p.pointsBasedPromotions), 0));
  observe("product_coupon_controls", products.filter((p) => p.showCoupon === true).length);
  observe("cart_promotions", size(state.promotions?.cartpromoList));
  observe("promotion_bundle_groups", size(state.promotions?.bundleGroups));
  observe("separate_product_promotions", size(state.promotions?.productPromoList));
  observe("app_product_coupons", size(state.coupons?.couponsDictionary));
  observe("coupon_gallery", Math.max(size(state.couponGallery?.couponIds), size(state.couponGallery?.couponDictionary)));
  observe("basket_vouchers", size(state.discountsAndCharges?.vouchers));
  const promotions = products.flatMap((p) => Array.isArray(p.promotions) ? p.promotions : []);
  observe("uninterpreted_thresholds", promotions.filter((p) => p.threshold != null && Number(p.threshold) !== 0 && clean(String(p.threshold))).length);
  observe("external_offer_conditions", promotions.filter((p) => p.externalOffers === true).length);
  observe("missing_source_promotion_dates", promotions.filter((p) => !sourceDate(p.startDate) || !sourceDate(p.endDate)).length);
  return {
    every_offer_type_verified: false,
    supported_sources: ["published_catalogue_products", "attached_product_promotions"],
    unverified_offer_channels: UNVERIFIED_OFFER_CHANNELS,
    unsupported_observations: observations,
    warnings: Object.entries(observations).map(([channel, count]) => `${channel}: ${count} source observations require additional coverage or condition verification`),
    observation_note: "Counts are page observations, not unique offers. Empty anonymous channels do not establish that no offers exist.",
  };
}

export function mergeStorefrontCoverageReports(reports: StorefrontCoverageReport[]): StorefrontCoverageReport {
  const report = storefrontCoverageReport();
  for (const item of reports) {
    for (const [channel, count] of Object.entries(item.unsupported_observations)) {
      report.unsupported_observations[channel] = (report.unsupported_observations[channel] ?? 0) + count;
    }
  }
  report.warnings = Object.entries(report.unsupported_observations)
    .map(([channel, count]) => `${channel}: ${count} source observations require additional coverage or condition verification`);
  return report;
}

/** Retry only transient transaction collisions; validation and auth failures remain visible. */
export async function retryCatalogWrite<T extends { error: { code?: string } | null }>(
  write: () => PromiseLike<T>,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await write();
    if (!result.error || !["40P01", "40001"].includes(result.error.code ?? "") || attempt >= 3) return result;
    await wait(100 * 2 ** attempt + Math.floor(Math.random() * 100));
  }
}
