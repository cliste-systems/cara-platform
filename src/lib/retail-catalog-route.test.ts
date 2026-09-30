import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it, type TestContext } from "node:test";

import { currentSupervaluOfferWeek } from "./supervalu-offers-normalize";

// The handler is exercised in Node, where the framework's server-only marker
// would otherwise reject any server module before the handler can be tested.
async function loadHandler() {
  const require = createRequire(import.meta.url);
  const marker = require.resolve("server-only");
  const previous = require.cache[marker];
  require.cache[marker] = { exports: {} } as NodeJS.Module;
  try {
    return (await import("../app/api/voice/search-supervalu-products/route")).POST;
  } finally {
    if (previous) require.cache[marker] = previous;
    else delete require.cache[marker];
  }
}

function stubCatalogue(t: TestContext, options: { resolveSku: boolean; stall: "name" | "assortment" }) {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://catalogue-route.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
    CLISTE_VOICE_WEBHOOK_SECRET: "test-only-webhook-secret",
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous == null) delete process.env[key]; else process.env[key] = previous; });
  }
  const calls = { name: 0, assortment: 0, aborted: 0 };
  const identity = { id: "catalog-burger", sku: "burger-sku", product_name: "SuperValu Beef Burgers 8 Pack (454g)" };
  const week = currentSupervaluOfferWeek();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, env.NEXT_PUBLIC_SUPABASE_URL, "test must never contact a live service");
    const json = (value: unknown) => Response.json(value);
    const abort = () => new Promise<Response>((_resolve, reject) => {
      const fail = () => { calls.aborted += 1; reject(new DOMException("Synthetic optional lookup timeout", "AbortError")); };
      assert.ok(init?.signal, "optional enrichment must receive an abort signal");
      if (init.signal.aborted) fail();
      else init.signal.addEventListener("abort", fail, { once: true });
    });
    switch (url.pathname) {
      case "/rest/v1/phone_numbers": return json({ organization_id: "test-organization" });
      case "/rest/v1/organizations": return json({ is_active: true, niche: "retail", retail_banner: "supervalu", offers_synced_at: new Date().toISOString(), retail_source_store_id: null });
      case "/rest/v1/retail_weekly_offers": return json(url.searchParams.get("select") === "offer_week_end" ? { offer_week_end: week.end } : []);
      case "/rest/v1/retail_catalog_products": {
        if (url.searchParams.has("sku")) return json(options.resolveSku ? [identity] : []);
        if (url.searchParams.has("product_name")) {
          calls.name += 1;
          return options.stall === "name" ? abort() : json([identity]);
        }
        return json([{ ...identity, brand: "SuperValu", department: "Burgers", service_area: "grocery", fulfilment: "prepack", is_alcohol: false, search_text: identity.product_name.toLowerCase(), national_store_count: 5, national_regular_price_eur: 3 }]);
      }
      case "/rest/v1/retail_store_product_assortment":
        calls.assortment += 1;
        return options.stall === "assortment" ? abort() : json([]);
      default: assert.fail(`Unexpected catalogue request: ${url.pathname}`);
    }
  });
  return calls;
}

async function lookup() {
  const post = await loadHandler();
  return post(new Request("http://localhost/api/voice/search-supervalu-products", {
    method: "POST",
    headers: { "content-type": "application/json", "x-cliste-voice-secret": "test-only-webhook-secret" },
    body: JSON.stringify({ called_number: "+15550000000", query: "cheapest meat burgers for barbecue", intent: "price" }),
  }));
}

describe("catalogue voice route optional assortment deadlines", () => {
  it("skips the name scan for resolved SKUs and preserves price when assortment times out", async (t) => {
    const calls = stubCatalogue(t, { resolveSku: true, stall: "assortment" });
    const start = Date.now();
    const response = await lookup();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.matches[0]?.current_price_eur, 3);
    assert.equal(body.matches[0]?.store_assortment_status, "not_confirmed");
    assert.match(body.matches[0]?.quote_text, /three euro/i);
    assert.match(body.matches[0]?.quote_text, /does not prove that this store carries/i);
    assert.deepEqual(calls, { name: 0, assortment: 1, aborted: 1 });
    assert.ok(Date.now() - start < 3_000, "optional enrichment must not recreate the nine-second timeout");
  });

  it("keeps national prices and unknown availability when unresolved-name enrichment times out", async (t) => {
    const calls = stubCatalogue(t, { resolveSku: false, stall: "name" });
    const response = await lookup();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.matches[0]?.current_price_eur, 3);
    assert.equal(body.matches[0]?.store_assortment_status, "not_confirmed");
    assert.equal(body.no_match_quote, null);
    assert.deepEqual(calls, { name: 1, assortment: 0, aborted: 1 });
  });
});
