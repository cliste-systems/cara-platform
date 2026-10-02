import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentSupervaluOfferWeek } from "./supervalu-offers-normalize";
import { searchSupervaluCatalogLive, inferCatalogSearchIntent } from "./supervalu-catalog-search";
import { resolveProductSearchResponse } from "./retail-product-clarification";
import { offerSearchProductIdentityTokens } from "./retail-weekly-offers-search";
import { isPreparedBurgerProduct } from "./retail-product-context";

type Row = Record<string, unknown>;
function database(catalog: Row[], offers: Row[], stallConsensus = false) {
  return {
    rpc() {
      return {
        abortSignal(signal: AbortSignal) {
          if (!stallConsensus) return Promise.resolve({ data: [], error: null });
          return new Promise((resolve) => {
            signal.addEventListener("abort", () => resolve({ data: null, error: { message: "Synthetic consensus timeout" } }), { once: true });
          });
        },
      };
    },
    from(table: string) {
      const rows = table === "retail_catalog_products" ? catalog : offers;
      const filters: Array<(row: Row) => boolean> = [];
      return {
        select() { return this; },
        eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return this; },
        gte(key: string, value: number | string) { filters.push((row) => row[key] >= value); return this; },
        lte(key: string, value: string) { filters.push((row) => row[key] <= value); return this; },
        ilike(key: string, value: string) { filters.push((row) => String(row[key]).toLowerCase().includes(value.replaceAll("%", "").toLowerCase())); return this; },
        order() { return this; },
        async range(from: number, to: number) { return { data: rows.filter((row) => filters.every((filter) => filter(row))).slice(from, to + 1), error: null }; },
      };
    },
  };
}
function catalogRow(name: string, price: number, fulfilment = "prepack"): Row {
  return { id: name, sku: name, product_name: name, brand: "Other", department: "Beef Burgers", retail_banner: "supervalu", is_national: true, service_area: "butcher", fulfilment, is_alcohol: false, search_text: name.toLowerCase(), national_store_count: 5, national_regular_price_eur: price };
}
function offerRow(name: string, price: number, fulfilment = "prepack", terms = `Only €${price}`): Row {
  const week = currentSupervaluOfferWeek();
  return { ...catalogRow(name, price, fulfilment), current_price_eur: price, was_price_eur: null, discount_label: terms, price_unit_type: fulfilment === "counter" ? "kilogram" : "each", sell_by: fulfilment === "counter" ? "weight" : "each", price_per_unit: fulfilment === "counter" ? `€${price}/kg` : null, offer_channel: fulfilment === "counter" ? "butcher_counter" : "prepack", offer_week_start: week.start, offer_week_end: week.end, synced_at: new Date().toISOString() };
}
async function lookup(query: string, catalog: Row[], offers: Row[], fulfilment?: "counter" | "prepack") {
  const matches = await searchSupervaluCatalogLive(query, { intent: "price", supabase: database(catalog, offers) as never, retailBanner: "supervalu", fulfilment });
  return {
    candidates: matches,
    response: resolveProductSearchResponse(query, matches.map((match) => ({ product_name: match.productName, department: match.department, service_area: match.serviceArea, fulfilment: match.fulfilment, current_price_eur: match.currentPriceEur, is_on_offer: match.isOnOffer, price_basis: match.priceBasis, quote_text: match.quoteText, score: match.score })), { intent: "price", fulfilment }),
  };
}

describe("cheapest product requests", () => {
  it("strips comparison wording from identity without stripping product or promotion words", () => {
    for (const words of ["cheapest", "least expensive", "lowest priced", "best value", "budget"]) {
      assert.deepEqual(offerSearchProductIdentityTokens(`${words} burgers`), ["burgers"]);
      assert.equal(inferCatalogSearchIntent(`${words} burgers`), "price");
    }
    assert.deepEqual(offerSearchProductIdentityTokens("cheapest burger sauce"), ["burger", "sauce"]);
  });

  it("compares past both the top-five result cutoff and the first database page", async () => {
    const rows = Array.from({ length: 505 }, (_, index) => catalogRow(`A Beef Burgers ${index}`, 6));
    rows.push(catalogRow("Z Beef Burgers", 2));
    const { candidates, response } = await lookup("cheapest burgers", rows, []);
    assert.equal(candidates.length, 506);
    assert.deepEqual(response.matches.map((match) => match.product_name), ["Z Beef Burgers"]);
  });

  it("includes cheaper weekly-only products and rejects sauce, buns and dinner", async () => {
    const offers = Array.from({ length: 7 }, (_, index) => offerRow(`A Beef Burger ${index}`, 4));
    offers.push(offerRow("Z Chicken Burger", 3.99, "prepack", "3 for €10 with Real Rewards, selected packs only"));
    offers.push(offerRow("Burger Sauce", 0.5), offerRow("Beef Burger Dinner", 1), offerRow("Burger Buns", 0.75), offerRow("Burger Mayonnaise", 0.25));
    const { response } = await lookup("cheapest burgers", [catalogRow("Regular Beef Burgers", 5)], offers);
    assert.deepEqual(response.matches.map((match) => match.product_name), ["Z Chicken Burger"]);
    assert.match(response.matches[0]!.quote_text, /three for ten euro|Real Rewards/i);
    assert.match(response.matches[0]!.quote_text, /selected packs only/i);
    assert.match(response.comparisonNote!, /not an absolute cheapest|Pack sizes can differ/);
  });

  it("does not substitute sauce or dinner when those are the only matches", async () => {
    const { response } = await lookup("cheapest burgers", [], [offerRow("Burger Sauce", 1), offerRow("Beef Burger Dinner", 2)]);
    assert.deepEqual(response.matches, []);
  });

  it("keeps sauce when the caller actually asks for burger sauce", async () => {
    const { response } = await lookup("cheapest burger sauce", [], [offerRow("Burger Sauce", 1), offerRow("Beef Burgers", 2), offerRow("Classic Burger with Tomato Sauce", 0.5)]);
    assert.equal(response.matches[0]?.product_name, "Burger Sauce");
  });

  it("returns separate pack and per-kilo options without comparing their raw prices", async () => {
    const { response } = await lookup("cheapest burgers", [], [offerRow("Pack Beef Burgers", 4), offerRow("Counter Beef Burgers", 2, "counter")]);
    assert.equal(response.matches.length, 2);
    assert.deepEqual(new Set(response.matches.map((match) => match.price_basis)), new Set(["pack", "per_kilo"]));
    assert.match(response.comparisonNote!, /separate comparisons/);
    assert.match(response.matches.find((match) => match.price_basis === "per_kilo")!.quote_text, /per kilo/);
  });

  it("keeps an explicit counter request and does not substitute cheaper prepack", async () => {
    const { response } = await lookup("cheapest burgers", [], [offerRow("Pack Beef Burgers", 1), offerRow("Counter Beef Burgers", 8, "counter")], "counter");
    assert.equal(response.matches.length, 1);
    assert.equal(response.matches[0]?.fulfilment, "counter");
  });

  it("preserves exact multibuy conditions instead of substituting a lower unrelated price", async () => {
    const { response } = await lookup("cheapest burgers three for ten euro", [], [offerRow("Eligible Beef Burgers", 4, "prepack", "3 for €10"), offerRow("Other Beef Burgers", 1, "prepack", "2 for €5")]);
    assert.deepEqual(response.matches.map((match) => match.product_name), ["Eligible Beef Burgers"]);
    assert.match(response.matches[0]!.quote_text, /three for ten euro/i);
  });

  it("retains an unpriced bundle as unranked instead of inventing a single-item price", async () => {
    const row = { ...offerRow("Beef Burgers", 4, "prepack", "Buy one get one free, selected packs only"), current_price_eur: null };
    const { response } = await lookup("cheapest burgers buy one get one free", [], [row]);
    assert.equal(response.matches.length, 1);
    assert.equal(response.matches[0]!.current_price_eur, null);
    assert.match(response.matches[0]!.quote_text, /buy one get one free/i);
    assert.match(response.comparisonNote!, /without a verified single price/);
  });

  it("preserves barbecue preparation context without requiring BBQ in the product name", async () => {
    const raw = { ...catalogRow("SuperValu Beef Burgers 8 Pack (454g)", 3), department: "Bbq Meats" };
    const prepared = { ...catalogRow("Classic Cheese Burger with Tomato Sauce (111g)", 2.25), department: "Single Serve Burgers & Grills" };
    const meal = { ...catalogRow("Butcher Beef Burger & Fries", 1.5), department: "Prepared By Our Butcher" };
    const snack = { ...catalogRow("Tayto Burger Bites Snacks 6 Pack", 1), department: "Multipack" };
    for (const query of ["cheapest BBQ burgers", "cheapest burgers for a barbecue", "cheapest raw burgers", "cheapest burgers for grilling"]) {
      const { response } = await lookup(query, [raw, prepared, meal, snack], []);
      assert.deepEqual(response.matches.map((match) => match.product_name), [raw.product_name]);
    }
    const generic = await lookup("cheapest burgers", [raw, prepared, snack], []);
    assert.equal(generic.response.matches[0]?.product_name, prepared.product_name, "a generic burger query may include prepared burgers, identified by form");
    assert.equal(isPreparedBurgerProduct(String(prepared.product_name), String(prepared.department)), true);
    assert.equal(isPreparedBurgerProduct(String(raw.product_name), String(raw.department)), false);
    assert.match(generic.response.comparisonNote!, /prepared single-serve burgers are not equivalent/i);
    assert.deepEqual(offerSearchProductIdentityTokens("cheapest BBQ burger sauce"), ["bbq", "burger", "sauce"], "BBQ remains a sauce flavour, not a cooking context");
  });

  it("does not substitute prepared burgers when no cooking burger matches", async () => {
    const prepared = { ...offerRow("Classic Beef Burger", 2), department: "Family Ready Meals" };
    const { response } = await lookup("cheapest BBQ burgers", [], [prepared]);
    assert.deepEqual(response.matches, []);
  });

  it("keeps an explicit beef restriction for barbecue burgers", async () => {
    const { response } = await lookup("cheapest beef burgers for a barbecue", [
      catalogRow("Vegetarian Burgers", 1),
      catalogRow("SuperValu Beef Burgers 8 Pack", 3),
      { ...catalogRow("Prepared Beef Burger", 2), department: "Single Serve Burgers & Grills" },
    ], []);
    assert.deepEqual(response.matches.map((match) => match.product_name), ["SuperValu Beef Burgers 8 Pack"]);
  });

  it("treats explicit meat as a burger preference across departments, not literal name or beef-only", async () => {
    const { response } = await lookup("cheapest meat burgers for barbecue", [
      catalogRow("Vegetarian Burgers", 1),
      { ...catalogRow("Plant Based Beef Burgers", 1.5), department: "Meat Free" },
      catalogRow("Beef Burgers 8 Pack", 3),
      { ...catalogRow("Chicken Burgers 4 Pack", 2.5), department: "Chicken Burgers", service_area: "grocery" },
      catalogRow("Turkey Burgers 4 Pack", 4),
    ], []);
    assert.deepEqual(response.matches.map((match) => match.product_name), ["Chicken Burgers 4 Pack"]);
  });

  it("returns matching weekly multibuys when the optional consensus query reaches its deadline", async () => {
    const start = Date.now();
    const keepAlive = setTimeout(() => {}, 5_000);
    try {
      const matches = await searchSupervaluCatalogLive("cheapest BBQ burgers three for ten euro", {
        intent: "price", retailBanner: "supervalu",
        supabase: database([], [offerRow("Eligible Beef Burgers", 4, "prepack", "3 for €10 with Real Rewards"), offerRow("Other Beef Burgers", 1, "prepack", "2 for €5")], true) as never,
      });
      assert.deepEqual(matches.map((match) => match.productName), ["Eligible Beef Burgers"]);
      assert.match(matches[0]!.quoteText, /three for ten euro/i);
      assert.ok(Date.now() - start < 4_000, "must leave time for the voice webhook to return");
    } finally {
      clearTimeout(keepAlive);
    }
  });
});
