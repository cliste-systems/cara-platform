import assert from "node:assert/strict";
import test from "node:test";
import { campaignDocument, campaignListingPage, campaignListingUrl, campaignPageUrl, fetchCampaignMembership } from "../../supabase/functions/supervalu-catalog-bootstrap/campaigns";

const reference = "00ac46ba-d6b3-43bd-b9a7-d91ba0677d8b";
const sourceUrl = "https://shop.supervalu.ie/super-stars-fruit-veg";
const url = campaignListingUrl("992", reference);
function response(skus: string[], total: number, next?: string) {
  return { name: "Super Fresh 5 F&V - WK39", listingId: "runtime-list", count: skus.length, total,
    items: skus.map(sku => ({ sku, price: "€999.00", priceNumeric: 999, promotions: [] })),
    pagination: { _links: next ? { next: { href: next } } : {} },
  };
}

test("campaign HTML yields explicit widget references, never empty product membership", () => {
  const state = { cms: { cmsContent: { rows: [{ columns: [
    { type: "ProductListing", referenceName: reference, description: "Old WK27 description" },
    { data: { LinkUrl: "/3-for-10-meats" } }, { data: { LinkUrl: "https://example.com/campaign" } },
  ] }] } }, search: { products: { category: [] } } };
  const result = campaignDocument(`<script>window.__PRELOADED_STATE__=${JSON.stringify(state)};</script>`, sourceUrl);
  assert.deepEqual(result.references, [reference]);
  assert.deepEqual(result.links, ["https://shop.supervalu.ie/3-for-10-meats"]);
  assert.equal(campaignPageUrl("https://example.com/super-stars-fruit-veg"), null);
  assert.equal(campaignPageUrl("https://shop.supervalu.ie/product/example"), null);
  assert.equal(campaignPageUrl("https://shop.supervalu.ie/sm/pickup/rsid/992/super-stars-fruit-veg?dftracking=abc"), sourceUrl);
  assert.equal(campaignPageUrl("https://shop.supervalu.ie/sm/delivery/rsid/5550/super-stars-fruit-veg?dftracking=abc"), sourceUrl);
  assert.equal(campaignPageUrl("https://shop.supervalu.ie/sm/delivery/rsid/5550/product/example"), null);
});

test("listing pagination follows skip while page remains one", async () => {
  const next = `/api/stores/992/listing/${reference}?q=*&take=2&skip=2&page=1`;
  const payloads = [response(["a", "b"], 3, next), response(["c"], 3)];
  const visited: string[] = [];
  const fetcher: typeof fetch = async (input) => { visited.push(String(input)); return new Response(JSON.stringify(payloads.shift()), { status: 200 }); };
  const result = await fetchCampaignMembership({ storeId: "992", reference, sourceUrl, fetcher });
  assert.equal(result.name, "Super Fresh 5 F&V - WK39");
  assert.deepEqual(result.skus, ["a", "b", "c"]);
  assert.equal(new URL(visited[1]).searchParams.get("skip"), "2");
  assert.equal(new URL(visited[1]).searchParams.get("page"), "1");
  assert.doesNotMatch(JSON.stringify(result), /999|priceNumeric|promotions/);
});

test("truncated, duplicate and redirected campaign sources cannot publish complete membership", async () => {
  const args = { storeId: "992", reference, url, skip: 0 };
  assert.throws(() => campaignListingPage(response(["a"], 3), args), /ended before/);
  assert.throws(() => campaignListingPage(response(["a", "a"], 2), args), /duplicated/);
  assert.throws(() => campaignListingPage(response(["a"], 3, "https://example.com/next?skip=1"), args), /changed source/);
  assert.throws(() => campaignListingPage(response(["a"], 3, `/api/stores/992/listing/${reference}?skip=2`), args), /skipped/);
  const payloads = [response(["a"], 2, `/api/stores/992/listing/${reference}?skip=1`), response(["a"], 2)];
  const fetcher: typeof fetch = async () => new Response(JSON.stringify(payloads.shift()));
  await assert.rejects(fetchCampaignMembership({ storeId: "992", reference, sourceUrl, fetcher }), /repeated across pages/);
});

test("verified empty listings are represented explicitly for safe old-membership retirement", async () => {
  const result = await fetchCampaignMembership({ storeId: "992", reference, sourceUrl,
    fetcher: async () => new Response(JSON.stringify(response([], 0))),
  });
  assert.deepEqual(result.skus, []);
  assert.equal(result.total, 0);
  assert.equal(result.campaignKey, reference);
});

 test("retired gateway sentinel is empty but malformed unnamed listings fail closed", () => {
  const args = { storeId: "992", reference, url, skip: 0 };
  const retired = { listingId: "00000000-0000-0000-0000-000000000000", name: null, count: 0, total: 0, items: [], pagination: { _links: {} } };
  assert.equal(campaignListingPage(retired, args).total, 0);
  assert.throws(() => campaignListingPage({ ...retired, listingId: reference }, args), /missing/);
  assert.throws(() => campaignListingPage({ ...retired, total: 1 }, args), /missing/);
});
