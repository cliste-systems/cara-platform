import { clean, readStorefrontState } from "./storefront.ts";

export const CAMPAIGN_GATEWAY_ORIGIN = "https://storefrontgateway.supervalu.ie";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function campaignPageUrl(value: string): string | null {
  try {
    const url = new URL(value, "https://shop.supervalu.ie");
    if (url.protocol !== "https:" || url.hostname !== "shop.supervalu.ie" || url.username || url.password) return null;
    url.pathname = url.pathname.replace(/^\/sm\/(?:pickup|delivery)\/rsid\/\d+(?=\/|$)/, "");
    if (!url.pathname || url.pathname === "/" || /^\/(?:categories|product|results|recipes?|cart|account|login|sign-in|terms-conditions)(?:\/|$)/i.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch { return null; }
}

/** CMS descriptions can be stale; use the listing API name after fetching membership. */
export function campaignDocument(html: string, sourceUrl: string) {
  const state = readStorefrontState(html);
  const references = new Set<string>();
  const links = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    const value = node as Record<string, unknown>;
    if (value.type === "ProductListing" && typeof value.referenceName === "string" && UUID.test(value.referenceName)) references.add(value.referenceName);
    for (const [key, entry] of Object.entries(value)) {
      if ((key === "LinkUrl" || key === "link") && typeof entry === "string") {
        const url = campaignPageUrl(entry);
        if (url && url !== sourceUrl) links.add(url);
      }
      walk(entry);
    }
  };
  walk(state.cms?.cmsContent);
  return { references: [...references], links: [...links] };
}

export function campaignListingUrl(storeId: string, reference: string): string {
  if (!UUID.test(reference)) throw new Error("Invalid campaign listing reference");
  return `${CAMPAIGN_GATEWAY_ORIGIN}/api/stores/${encodeURIComponent(storeId)}/listing/${reference}?q=*&take=100&skip=0&page=1`;
}

/** Validate source pagination. The gateway advances skip while page may remain 1. */
export function campaignListingPage(payload: any, input: {
  storeId: string; reference: string; url: string; skip: number;
}) {
  // The public gateway explicitly represents retired CMS widgets with this sentinel.
  // Do not mistake arbitrary malformed or partially loaded responses for empty lists.
  if (input.skip === 0 && payload?.listingId === "00000000-0000-0000-0000-000000000000"
    && payload.name === null && payload.count === 0 && payload.total === 0
    && Array.isArray(payload.items) && payload.items.length === 0
    && payload.pagination?._links && Object.keys(payload.pagination._links).length === 0) {
    return { skus: [] as string[], total: 0, name: "Inactive public listing", listingId: payload.listingId, nextUrl: null, nextSkip: null };
  }
  if (!Array.isArray(payload?.items) || !clean(payload?.name)) throw new Error("Campaign listing items or name missing");
  const total = Number(payload.total);
  if (!Number.isInteger(total) || total < 0 || total > 10000) throw new Error("Campaign listing total invalid or exceeds bounded import");
  const skus = payload.items.map((item: any) => clean(item?.sku));
  if (skus.some((sku: string) => !sku) || new Set(skus).size !== skus.length) throw new Error("Campaign listing SKU identities missing or duplicated");
  if (payload.count != null && Number(payload.count) !== skus.length) throw new Error("Campaign listing page count mismatch");
  if (input.skip + skus.length > total || (input.skip < total && skus.length === 0)) throw new Error("Campaign listing page incomplete");
  const next = payload.pagination?._links?.next;
  let nextUrl: string | null = null;
  let nextSkip: number | null = null;
  if (next) {
    const raw = next.href || (next.queryPart ? `?${next.queryPart}` : null);
    if (!raw) throw new Error("Campaign pagination next link missing");
    const url = new URL(raw, input.url);
    const expectedPath = `/api/stores/${encodeURIComponent(input.storeId)}/listing/${input.reference}`;
    if (url.origin !== CAMPAIGN_GATEWAY_ORIGIN || url.pathname !== expectedPath || url.username || url.password) throw new Error("Campaign pagination changed source store or listing");
    nextSkip = Number(url.searchParams.get("skip"));
    if (!Number.isInteger(nextSkip) || nextSkip !== input.skip + skus.length || nextSkip <= input.skip || nextSkip >= total) throw new Error("Campaign pagination skipped or repeated products");
    nextUrl = url.toString();
  } else if (input.skip + skus.length !== total) throw new Error("Campaign pagination ended before total products");
  return { skus, total, name: clean(payload.name), listingId: clean(payload.listingId), nextUrl, nextSkip };
}

/** Membership only. Deliberately discard gateway prices and promotion objects. */
export async function fetchCampaignMembership(input: {
  storeId: string; reference: string; sourceUrl: string;
  fetcher?: typeof fetch;
}) {
  const sourceUrl = campaignPageUrl(input.sourceUrl);
  if (!sourceUrl) throw new Error("Invalid official campaign page");
  let url: string | null = campaignListingUrl(input.storeId, input.reference);
  let skip = 0;
  let total: number | null = null;
  let name = "";
  let listingId = "";
  const skus = new Set<string>();
  const deadline = Date.now() + 75000;
  let pages = 0;
  while (url) {
    if (Date.now() >= deadline) throw new Error("Campaign membership crawl exceeded time budget");
    const response = await (input.fetcher ?? fetch)(url, {
      headers: { Accept: "application/json" }, redirect: "error",
      signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))),
    });
    if (!response.ok) throw new Error(`Campaign listing HTTP ${response.status}`);
    const page = campaignListingPage(await response.json(), { storeId: input.storeId, reference: input.reference, url, skip });
    if (total != null && (total !== page.total || name !== page.name || listingId !== page.listingId)) throw new Error("Campaign listing changed during pagination");
    total = page.total; name = page.name; listingId = page.listingId;
    for (const sku of page.skus) {
      if (skus.has(sku)) throw new Error("Campaign SKU repeated across pages");
      skus.add(sku);
    }
    pages++;
    url = page.nextUrl;
    skip = page.nextSkip ?? skip;
  }
  if (skus.size !== total) throw new Error("Campaign membership count does not match source total");
  return { campaignKey: input.reference, name, listingId, sourceUrl, skus: [...skus], pages, total };
}
