
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "supabase";
import * as cheerio from "cheerio";
import { retryCatalogWrite, clean, currentOfferWeek, normalizeCards, promoRows, readStorefrontPage, storefrontCoverageReport, mergeStorefrontCoverageReports, type StorefrontCoverageReport, readLeafletCampaignLinks } from "./storefront.ts";
import { campaignPageUrl, campaignDocument, fetchCampaignMembership } from "./campaigns.ts";

const DEFAULT_STORE_ID = "992";
const TAKE = 100;
const H = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
};
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Capability = {
  id: string;
  mode: "discover" | "work";
  source_store_id: string;
  sync_batch_id: string | null;
  work_limit: number;
  refresh_kind: "full" | "offers";
};
type CategoryJob = {
  id: string;
  category_id: string;
  category_name: string;
  category_href: string;
  source_store_id: string;
  sync_batch_id: string;
  next_page: number;
  next_skip: number;
  pages_fetched: number;
  product_cards_seen: number;
  unique_skus_seen: number;
};

function publicCategoryUrl(storeId: string, href: string, page = 1, skip = 0) {
  let path: string;
  if (href.startsWith("http")) {
    path = new URL(href).pathname.replace(/^\/sm\/pickup\/rsid\/\d+/, "");
  } else {
    path = href;
  }
  if (!path.startsWith("/")) path = "/" + path;
  return `https://shop.supervalu.ie/sm/pickup/rsid/${encodeURIComponent(storeId)}${path}?page=${page}&skip=${skip}&take=${TAKE}`;
}
async function consumeCapability(requestId: string): Promise<Capability> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("retail_catalog_bootstrap_requests")
    .select("id,mode,source_store_id,sync_batch_id,work_limit,refresh_kind,expires_at,used_at")
    .eq("id", requestId)
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (error) throw new Error("capability lookup: " + error.message);
  if (!data) throw new Error("invalid or expired capability");
  const { data: used, error: ue } = await supabase
    .from("retail_catalog_bootstrap_requests")
    .update({ used_at: now })
    .eq("id", requestId)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (ue) throw new Error("capability consume: " + ue.message);
  if (!used) throw new Error("capability already consumed");
  return data as Capability;
}
async function upsertCards(cards: any[], job: CategoryJob, batchId: string) {
  if (!cards.length) return { unique: 0, promotions: 0 };
  cards = [...new Map(cards.map(c => [c.sku, c])).values()].sort((a, b) => a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0);
  const now = new Date().toISOString();
  const productRows = cards.map((c) => ({
    retail_banner: "supervalu",
    sku: c.sku,
    product_name: c.name,
    brand: c.brand,
    department: c.department,
    category_breadcrumb: c.breadcrumb,
    sell_by: c.sellBy,
    price_unit_type: c.priceUnitType,
    service_area: c.serviceArea,
    fulfilment: c.fulfilment,
    is_alcohol: c.isAlcohol,
    source_url: c.sourceUrl,
    search_text: c.searchText,
    last_seen_at: now,
    updated_at: now,
  }));
  const { error: pe } = await retryCatalogWrite(() => supabase.from("retail_catalog_products")
    .upsert(productRows, { onConflict: "retail_banner,sku" }));
  if (pe) throw new Error("product upsert: " + pe.message);

  const skus = [...new Set(cards.map((c) => c.sku))];
  const { data: ids, error: ie } = await supabase.from("retail_catalog_products")
    .select("id,sku").eq("retail_banner", "supervalu").in("sku", skus);
  if (ie) throw new Error("product id lookup: " + ie.message);
  const idBySku = new Map<string, string>((ids ?? []).map((r:any) => [String(r.sku), String(r.id)]));
  if (idBySku.size !== skus.length) throw new Error("Incomplete product ID lookup");

  const listings = cards.flatMap((c) => {
    const productId = idBySku.get(c.sku);
    if (!productId) return [];
    return [{
      product_id: productId,
      source_store_id: job.source_store_id,
      sync_batch_id: batchId,
      regular_price_eur: c.regularPrice,
      display_price_eur: c.displayPrice,
      price_per_unit: c.unitPrice,
      source_price_label: c.badges.join(" | ") || null,
      source_price_source: "supervalu_public_storefront",
      is_listed: true,
      synced_at: now,
      last_seen_at: now,
      updated_at: now,
    }];
  });
  const { error: le } = await retryCatalogWrite(() => supabase.from("retail_store_products")
    .upsert(listings.sort((a,b) => a.product_id.localeCompare(b.product_id)), { onConflict: "source_store_id,product_id" }));
  if (le) throw new Error("listing upsert: " + le.message);

  const productIds = listings.map((x:any) => x.product_id);
  const { data: storeRows, error: se } = await supabase.from("retail_store_products")
    .select("id,product_id").eq("source_store_id", job.source_store_id).in("product_id", productIds);
  if (se) throw new Error("store listing lookup: " + se.message);
  const spByProduct = new Map<string, string>((storeRows ?? []).map((r:any) => [String(r.product_id), String(r.id)]));
  if (spByProduct.size !== productIds.length) throw new Error("Incomplete store product ID lookup");
  const week = currentOfferWeek();
  const promotions: any[] = [];
  for (const card of cards) {
    const productId = idBySku.get(card.sku);
    const storeProductId = productId ? spByProduct.get(productId) : null;
    if (storeProductId) promotions.push(...promoRows(card, storeProductId, week, now));
  }
  if (promotions.length) {
    const { error: pre } = await retryCatalogWrite(() => supabase.from("retail_promotions")
      .upsert(promotions.sort((a,b) => `${a.store_product_id}:${a.promotion_key}`.localeCompare(`${b.store_product_id}:${b.promotion_key}`)), { onConflict: "store_product_id,promotion_key" }));
    if (pre) throw new Error("promotion upsert: " + pre.message);
  }
  // Obsolete promotions remain until the complete source run passes coverage
  // checks. finalize_supervalu_catalog_run removes them atomically at publication.
  return { unique: skus.length, promotions: promotions.length };
}
async function discoverCampaignJobs(storeId: string, leafletLinks: Array<{url: string}>) {
  const pending = new Set<string>([
    ...leafletLinks.map((link) => campaignPageUrl(link.url)).filter((url): url is string => Boolean(url)),
    "https://shop.supervalu.ie/selected-offers",
  ]);
  const visited = new Set<string>();
  const references = new Map<string, { listing_reference: string; source_url: string }>();
  const unresolved: Array<{ source_url: string; reason: string }> = [];
  const deadline = Date.now() + 60000;
  while (pending.size && visited.size < 60 && Date.now() < deadline) {
    const urls = [...pending].slice(0, Math.min(4, 60 - visited.size));
    urls.forEach((url) => { pending.delete(url); visited.add(url); });
    await Promise.all(urls.map(async (sourceUrl) => {
      try {
        const scopedUrl = `https://shop.supervalu.ie/sm/pickup/rsid/${encodeURIComponent(storeId)}${new URL(sourceUrl).pathname}`;
        const response = await fetch(scopedUrl, { headers: H, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Campaign page HTTP ${response.status}`);
        const document = campaignDocument(await response.text(), sourceUrl);
        for (const reference of document.references) {
          if (!references.has(reference)) references.set(reference, { listing_reference: reference, source_url: sourceUrl });
        }
        for (const linked of document.links) if (!visited.has(linked)) pending.add(linked);
        if (!document.references.length && !document.links.length) unresolved.push({ source_url: sourceUrl, reason: "No explicit product-list membership was published in this page" });
      } catch (error) {
        unresolved.push({ source_url: sourceUrl, reason: error instanceof Error ? error.message : String(error) });
      }
    }));
  }
  for (const sourceUrl of pending) unresolved.push({ source_url: sourceUrl, reason: "Campaign discovery safety or time limit reached" });
  return { widget_references: [...references.values()], pages_checked: visited.size, unresolved_pages: unresolved, discovery_truncated: pending.size > 0 };
}

async function processCampaignJob(job: CategoryJob, batchId: string) {
  const coverage = storefrontCoverageReport();
  coverage.supported_sources.push("published_campaign_membership_only");
  try {
    const reference = job.category_id.slice("CAMPAIGN:".length);
    const membership = await fetchCampaignMembership({ storeId: job.source_store_id, reference, sourceUrl: job.category_href });
    const observedAt = new Date().toISOString();
    // Replace only this uncommitted batch's staging rows after complete source
    // pagination. Prior completed membership remains until atomic finalization.
    const { error: stagingError } = await supabase.from("retail_campaign_memberships").delete()
      .eq("retail_banner", "supervalu").eq("source_store_id", job.source_store_id)
      .eq("campaign_key", membership.campaignKey).eq("sync_batch_id", batchId);
    if (stagingError) throw new Error("campaign staging reset: " + stagingError.message);
    const rows = membership.skus.map((sku) => ({
      retail_banner: "supervalu", source_store_id: job.source_store_id, sku,
      campaign_key: membership.campaignKey, campaign_name: membership.name,
      source_url: membership.sourceUrl, listing_reference: reference,
      source_listing_id: membership.listingId, sync_batch_id: batchId,
      observed_at: observedAt,
      source_metadata: { source: "supervalu_public_listing", evidence: "membership_only", gateway_prices_discarded: true, source_total: membership.total },
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("retail_campaign_memberships").upsert(rows.slice(i, i + 500), {
        onConflict: "retail_banner,source_store_id,campaign_key,sku,sync_batch_id",
      });
      if (error) throw new Error("campaign membership staging: " + error.message);
    }
    const { count, error: countError } = await supabase.from("retail_campaign_memberships")
      .select("sku", { count: "exact", head: true }).eq("retail_banner", "supervalu")
      .eq("source_store_id", job.source_store_id).eq("campaign_key", membership.campaignKey).eq("sync_batch_id", batchId);
    if (countError || count !== membership.total) throw new Error("Campaign persisted membership count differs from complete source");
    const { error: completeError } = await supabase.from("retail_catalog_category_queue").update({
      status: "completed", category_name: membership.name, pages_fetched: membership.pages,
      product_cards_seen: membership.total, unique_skus_seen: membership.total,
      completed_at: observedAt, updated_at: observedAt, last_error: null,
    }).eq("id", job.id).eq("sync_batch_id", batchId);
    if (completeError) throw new Error("campaign completion: " + completeError.message);
    return { category_id: job.category_id, pages: [], campaign_name: membership.name, membership_count: membership.total, coverage_report: coverage };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { error: failedError } = await supabase.from("retail_catalog_category_queue").update({
      status: "failed", last_error: message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("sync_batch_id", batchId);
    if (failedError) throw new Error("record campaign failure: " + failedError.message);
    coverage.unsupported_observations.failed_campaign_membership = 1;
    coverage.warnings.push(message);
    return { category_id: job.category_id, pages: [], error: message, coverage_report: coverage };
  }
}

async function discover(storeId: string, refreshKind: "full" | "offers") {
  const navUrl = `https://shop.supervalu.ie/sm/pickup/rsid/${encodeURIComponent(storeId)}/categories/milk-yogurt-butter-eggs-id-O100025`;
  const response = await fetch(navUrl, { headers: H, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("navigation HTTP " + response.status);
  const html = await response.text();
  const $ = cheerio.load(html);
  const found = new Map<string, {category_id:string,category_name:string,category_href:string}>();
  $('a[href*="/categories/"]').each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/-id-(O\d+)/);
    if (!match) return;
    const categoryId = match[1];
    // Include department roots too: products need not be assigned to a leaf.
    if (!found.has(categoryId)) {
      found.set(categoryId, {
        category_id: categoryId,
        category_name: clean($(el).text()) || categoryId,
        category_href: href,
      });
    }
  });
  if (found.size < 100) throw new Error(`Incomplete storefront navigation: only ${found.size} categories`);
  const departmentManifest = [...found.values()].filter(c => c.category_id.startsWith("O1"));
  if (refreshKind === "offers") found.clear();
  found.set("PROMOTIONS", { category_id: "PROMOTIONS", category_name: "All promotions", category_href: "/promotions" });
  // Follow the current leaflet linked by the official storefront. This is
  // campaign-discovery evidence only; no hotspot price is applied to a SKU.
  const leafletHref = $('a[href*="supervalu.ie/offers/leaflet/"]').first().attr("href")?.trim() || "https://supervalu.ie/offers";
  let campaignDiscovery: Record<string, unknown> = { verified: false, reason: "Official storefront did not expose a current leaflet link" };
  if (leafletHref) {
    try {
      const leafletUrl = new URL(leafletHref);
      if (leafletUrl.protocol !== "https:" || leafletUrl.hostname !== "supervalu.ie" || !/^\/offers(?:\/leaflet(?:\/\d+[a-z]?)?)?\/?$/i.test(leafletUrl.pathname)) {
        throw new Error("Unrecognized official leaflet link");
      }
      const leafletResponse = await fetch(leafletUrl, { headers: H, signal: AbortSignal.timeout(15000) });
      if (!leafletResponse.ok) throw new Error(`Leaflet HTTP ${leafletResponse.status}`);
      campaignDiscovery = { verified: false, ...readLeafletCampaignLinks(await leafletResponse.text(), leafletResponse.url) };
    } catch (error) {
      campaignDiscovery = { verified: false, source_url: leafletHref, error: error instanceof Error ? error.message : String(error) };
    }
  }
  const campaignJobs = await discoverCampaignJobs(storeId, (campaignDiscovery.links ?? []) as Array<{url: string}>);
  campaignDiscovery = { ...campaignDiscovery, ...campaignJobs };
  for (const campaign of campaignJobs.widget_references) {
    found.set(`CAMPAIGN:${campaign.listing_reference}`, {
      category_id: `CAMPAIGN:${campaign.listing_reference}`,
      category_name: "Official campaign membership", category_href: campaign.source_url,
    });
  }
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: runError } = await supabase.from("retail_catalog_sync_runs").insert({
    retail_banner: "supervalu",
    source_store_id: storeId,
    sync_batch_id: batchId,
    status: "running",
    started_at: now,
    metadata: { source: "supervalu_public_storefront", category_count: found.size, department_manifest: departmentManifest, refresh_kind: refreshKind, coverage_report: storefrontCoverageReport(), campaign_discovery: campaignDiscovery },
  });
  if (runError) throw new Error("sync run insert: " + runError.message);

  const queueRows = [...found.values()].map((c) => ({
    retail_banner: "supervalu",
    source_store_id: storeId,
    sync_batch_id: batchId,
    ...c,
    status: "pending",
    retry_count: 0,
    next_page: 1,
    next_skip: 0,
    pages_fetched: 0,
    product_cards_seen: 0,
    unique_skus_seen: 0,
    last_error: null,
    started_at: null,
    completed_at: null,
    updated_at: now,
  }));
  for (let i = 0; i < queueRows.length; i += 200) {
    const { error } = await supabase.from("retail_catalog_category_queue")
      .upsert(queueRows.slice(i, i + 200), { onConflict: "source_store_id,category_id" });
    if (error) throw new Error("queue upsert: " + error.message);
  }
  return { batch_id: batchId, categories: queueRows.length, campaign_discovery: campaignDiscovery, coverage_report: storefrontCoverageReport() };
}
async function processJob(job: CategoryJob, batchId: string) {
  if (job.category_id.startsWith("CAMPAIGN:")) return processCampaignJob(job, batchId);
  const results = [];
  const coverageReports: StorefrontCoverageReport[] = [];
  const deadline = Date.now() + 45000;
  // Promotion-only passes need just one queue entry. Consume several pages
  // while holding its claim, so 2,000 offers do not take 20 scheduler ticks.
  const maxPages = job.category_id === "PROMOTIONS" ? 4 : 1;
  try {
    for (let step = 0; step < maxPages; step++) {
      const page = Number(job.next_page || 1);
      const skip = Number(job.next_skip || 0);
      const url = publicCategoryUrl(job.source_store_id, job.category_href, page, skip);
      const response = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const sourcePage = readStorefrontPage(html, { categoryId: job.category_id, page, skip, take: TAKE });
      coverageReports.push(storefrontCoverageReport(sourcePage.state, sourcePage.products));
      const cards = normalizeCards(sourcePage.products, job.category_name, job.category_href, html);
      const saved = await upsertCards(cards, job, batchId);
      const hasNext = sourcePage.hasNext;
      const keepClaim = hasNext && step + 1 < maxPages && Date.now() < deadline;
      const now = new Date().toISOString();
      const progress = {
        status: !hasNext ? "completed" : keepClaim ? "running" : "pending",
        pages_fetched: Number(job.pages_fetched || 0) + 1,
        product_cards_seen: Number(job.product_cards_seen || 0) + cards.length,
        unique_skus_seen: Number(job.unique_skus_seen || 0) + saved.unique,
        next_page: hasNext ? page + 1 : page,
        next_skip: hasNext ? skip + sourcePage.take : skip,
        completed_at: hasNext ? null : now, updated_at: now, last_error: null,
      };
      const { error: queueError } = await supabase.from("retail_catalog_category_queue")
        .update(progress).eq("id", job.id).eq("sync_batch_id", batchId);
      if (queueError) throw new Error("queue progress: " + queueError.message);
      results.push({ total: sourcePage.total, page, cards: cards.length, promotions: saved.promotions, has_next: hasNext, coverage_report: storefrontCoverageReport(sourcePage.state, sourcePage.products) });
      Object.assign(job, progress);
      if (!keepClaim) break;
    }
    return { category_id: job.category_id, pages: results, coverage_report: mergeStorefrontCoverageReports(coverageReports) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { error: failedError } = await supabase.from("retail_catalog_category_queue").update({
      status: "failed", last_error: message,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("sync_batch_id", batchId);
    if (failedError) throw new Error("record category failure: " + failedError.message);
    return { category_id: job.category_id, pages: results, error: message, coverage_report: mergeStorefrontCoverageReports(coverageReports) };
  }
}
async function work(storeId: string, batchId: string, limit: number) {
  const { data, error } = await supabase.rpc("claim_retail_catalog_categories", {
    p_source_store_id: storeId,
    p_sync_batch_id: batchId,
    p_limit: Math.max(1, Math.min(limit, 10)),
  });
  if (error) throw new Error("category claim: " + error.message);
  const jobs = (data ?? []) as CategoryJob[];
  const results = [];
  for (let i = 0; i < jobs.length; i += 4) {
    results.push(...await Promise.all(jobs.slice(i, i + 4).map((job) => processJob(job, batchId))));
  }

  const { count: remaining, error: remainingError } = await supabase
    .from("retail_catalog_category_queue")
    .select("id", { count: "exact", head: true })
    .eq("source_store_id", storeId)
    .eq("sync_batch_id", batchId)
    .in("status", ["pending", "running"]);
  if (remainingError) throw new Error("queue completion check: " + remainingError.message);

  const coverageReport = mergeStorefrontCoverageReports(results.map((result) => result.coverage_report));
  // The database publisher validates and atomically finalizes complete queues.
  // Running consensus through PostgREST exceeded its statement timeout even
  // after lock contention was removed; pg_cron has a separate bounded budget.
  return { claimed: jobs.length, results, remaining: remaining ?? 0,
    ready_for_publication: (remaining ?? 0) === 0, coverage_report: coverageReport };
}

Deno.serve(async (req) => {
  let requestId = "";
  try {
    const body = await req.json().catch(() => ({}));
    requestId = clean(body.request_id);
    if (!requestId) return Response.json({ ok: false, error: "request_id required" }, { status: 401 });
    const capability = await consumeCapability(requestId);
    let result: any;
    if (capability.mode === "discover") {
      result = await discover(capability.source_store_id || DEFAULT_STORE_ID, capability.refresh_kind ?? "full");
    } else {
      if (!capability.sync_batch_id) throw new Error("work capability missing sync batch");
      result = await work(capability.source_store_id, capability.sync_batch_id, capability.work_limit);
    }
    await supabase.from("retail_catalog_bootstrap_requests").update({
      result_status: 200,
      result_summary: result,
    }).eq("id", requestId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (requestId) {
      await supabase.from("retail_catalog_bootstrap_requests").update({
        result_status: 500,
        result_summary: { error: message, coverage_report: (error as { coverageReport?: StorefrontCoverageReport })?.coverageReport ?? storefrontCoverageReport() },
      }).eq("id", requestId);
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
