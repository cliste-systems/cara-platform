import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expandSupervaluCatalogSearchQueries,
  filterCatalogMatchesByQuery,
  formatCatalogStockNoMatchQuote,
  formatCatalogStockQuote,
  formatOfferFulfilmentMissQuote,
  formatOwnBrandFallbackQuote,
  inferCatalogOfferBrowseCategories,
  inferCatalogSearchIntent,
  searchSupervaluCatalogLive,
  normalizeCatalogBrandQuery,
  normalizeSupervaluCatalogProduct,
  stripCatalogPackagingNoise,
  stripCatalogSearchBoilerplate,
} from "./supervalu-catalog-search";

import { currentSupervaluOfferWeek } from "./supervalu-offers-normalize";

describe("supervalu catalog search", () => {
  it("normalizes any gateway product with a name", () => {
    const product = normalizeSupervaluCatalogProduct({
      sku: "999",
      name: "Heinz Tomato Ketchup 570g",
      priceNumeric: 4.5,
      attributes: { altCategory: "Grocery" },
    });
    assert.ok(product);
    assert.match(product?.searchText ?? "", /heinz/);
    assert.match(product?.searchText ?? "", /ketchup/);
  });

  it("formats a professional stock quote with spoken national range price", () => {
    const quote = formatCatalogStockQuote({
      productName: "Weetabix 24 Pack (430 g)",
      department: "Cereals",
      currentPriceEur: 4.79,
      pricePerUnit: "€11.14/kg",
      isOnOffer: false,
      intent: "price",
    });
    assert.match(quote, /four euro seventy nine/i);
    assert.match(quote, /regular price/i);
    assert.match(quote, /not on offer this week/i);
  });

  it("formats promotional catalog prices with spoken was price", () => {
    const quote = formatCatalogStockQuote({
      productName: "Heinz Tomato Ketchup 570g",
      department: "Grocery",
      currentPriceEur: 3.5,
      wasPriceEur: 4.5,
      discountLabel: "Only €3.50",
      isOnOffer: true,
      intent: "price",
    });
    assert.match(quote, /on offer at three euro fifty/i);
    assert.match(quote, /was four euro fifty/i);
  });

  it("says not on offer when caller asks about offers", () => {
    const quote = formatCatalogStockQuote({
      productName: "Weetabix 24 Pack (430 g)",
      department: "Cereals",
      currentPriceEur: 4.79,
      isOnOffer: false,
      intent: "offer",
    });
    assert.match(quote, /not showing as on offer this week/i);
    assert.doesNotMatch(quote, /listed at four euro/i);
  });

  it("quotes offer price when caller asks about offers and product is promotional", () => {
    const quote = formatCatalogStockQuote({
      productName: "McVitie's Hobnobs Milk Chocolate Biscuits (262 g)",
      currentPriceEur: 2.5,
      wasPriceEur: 3.19,
      discountLabel: "Only €2.50",
      isOnOffer: true,
      intent: "offer",
    });
    assert.match(quote, /on offer this week at two euro fifty/i);
    assert.match(quote, /was three euro nineteen/i);
  });

  it("strips offer phrasing before product search", () => {
    assert.equal(
      stripCatalogSearchBoilerplate("is Weetabix on offer this week"),
      "Weetabix",
    );
    assert.equal(
      stripCatalogSearchBoilerplate("how much is Cadbury Snack Shortcake 5-pack"),
      "Cadbury Snack Shortcake 5-pack",
    );
  });

  it("infers offer intent from caller phrasing", () => {
    assert.equal(inferCatalogSearchIntent("is Weetabix on offer this week"), "offer");
    assert.equal(inferCatalogSearchIntent("What's on Rewards Price for €2.50?"), "offer");
    assert.equal(inferCatalogSearchIntent("Anything with Rewards at two fifty?"), "offer");
    assert.equal(inferCatalogSearchIntent("how much is Weetabix"), "price");
    assert.equal(inferCatalogSearchIntent("do you stock Weetabix"), "stock");
  });

  it("returns no browse categories — product-token search only", () => {
    assert.deepEqual(inferCatalogOfferBrowseCategories("weekly offers"), []);
    assert.deepEqual(inferCatalogOfferBrowseCategories("milk bread crisps"), []);
  });

  it("expands sriracha queries to gateway-friendly chilli search", () => {
    const queries = expandSupervaluCatalogSearchQueries("Hellmann's Sriracha");
    assert.ok(queries.includes("Hellmann's chilli"));
    assert.ok(queries.some((q) => /chilli/i.test(q)));
  });

  it("strips packaging noise and searches core product term first", () => {
    assert.equal(stripCatalogPackagingNoise("turkey packets"), "turkey");
    assert.equal(stripCatalogPackagingNoise("pre-pack turkey"), "turkey");
    const queries = expandSupervaluCatalogSearchQueries("turkey packets");
    assert.equal(queries[0], "turkey");
    assert.ok(queries.includes("turkey packets"));
  });

  it("expands brand plus product queries without hardcoding brands", () => {
    const queries = expandSupervaluCatalogSearchQueries("greenfarm turkey");
    assert.ok(queries.includes("greenfarm turkey"));
    assert.ok(queries.includes("greenfarm"));
  });

  it("does not claim stock on no match", () => {
    const quote = formatCatalogStockNoMatchQuote("unicorn meat");
    assert.match(quote, /couldn't find/i);
    assert.match(quote, /don't want to guess/i);
  });

  it("normalizes own-brand phrasing for search", () => {
    assert.equal(
      normalizeCatalogBrandQuery("SuperValu own brand dried egg noodles"),
      "SuperValu dried egg noodles",
    );
    assert.ok(
      expandSupervaluCatalogSearchQueries("SuperValu own brand dried egg noodles").some(
        (q) => q.toLowerCase() === "supervalu egg noodles",
      ),
    );
  });

  it("fuzzy-filters a minor STT slip to fillet steak", () => {
    const matches = filterCatalogMatchesByQuery("filled steak", [
      {
        productName: "SuperValu Signature Tastes Hereford Irish Fillet Steak (370 g)",
        department: "Beef Steaks",
        sku: "1347278000",
        currentPriceEur: 15.99,
        wasPriceEur: 18.99,
        discountLabel: "Rewards Price Only €15.99",
        isOnOffer: true,
        score: 0.95,
        quoteText: "fillet",
      },
      {
        productName: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        department: "Butcher",
        sku: "1019164002",
        currentPriceEur: 16.74,
        wasPriceEur: 24.99,
        discountLabel: "Save 33%",
        isOnOffer: true,
        score: 0.55,
        quoteText: "sirloin",
      },
    ]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /Fillet Steak/i);
  });

  it("filters SuperValu fish queries to fish-finger products only", () => {
    const matches = filterCatalogMatchesByQuery("SuperValu fish fingers", [
      {
        productName: "SuperValu Atlantic Crab Meat (140 g)",
        department: "Fish",
        sku: null,
        currentPriceEur: 3,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: false,
        score: 0.66,
        quoteText: "crab",
      },
      {
        productName: "Birds Eye Crispy Fish Fingers 8 Pack (224 g)",
        department: "Fish Fingers",
        sku: null,
        currentPriceEur: 2.5,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: true,
        score: 1,
        quoteText: "fingers",
      },
    ]);
    assert.equal(matches.length, 0);
  });

  it("formats own-brand fallback without denying the product exists", () => {
    const quote = formatOwnBrandFallbackQuote("fish fingers", [
      {
        productName: "Birds Eye Crispy Fish Fingers 8 Pack (224 g)",
        department: "Fish Fingers",
        sku: null,
        currentPriceEur: 2.5,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: true,
        score: 1,
        quoteText: "fingers",
      },
    ]);
    assert.match(quote, /don't see a SuperValu own-label match/i);
    assert.match(quote, /doesn't mean we never stock it/i);
    assert.match(quote, /Birds Eye/i);
  });

  const sirloinOffer = {
    productName: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
    department: "Butcher",
    sku: null,
    currentPriceEur: 16.74,
    wasPriceEur: null,
    discountLabel: "Only €16.74",
    isOnOffer: true,
    score: 1,
    quoteText: "At the butcher counter this week — sirloin steak",
  };

  it("keeps steak offers for natural caller phrasing", () => {
    for (const query of [
      "steaks",
      "steak",
      "steaks on offer this week",
      "is there any steaks on offer this week",
      "any steaks on offer",
      "meat counter steaks",
      "what offers in the meat counter this week",
      "hello just wondering any steaks on offer",
    ]) {
      const matches = filterCatalogMatchesByQuery(query, [sirloinOffer]);
      assert.equal(
        matches.length,
        1,
        `expected steak match for query: ${query}`,
      );
    }
  });

  const deliHamOffer = {
    productName: "SuperValu Traditional Cooked Ham (1 kg)",
    department: "Ham",
    sku: null,
    currentPriceEur: 22,
    wasPriceEur: null,
    discountLabel: null,
    isOnOffer: true,
    score: 1,
    quoteText: "deli ham",
  };

  const wineOffer = {
    productName: "Brancott Estate Marlborough Sauvignon Blanc (75 cl)",
    department: "Wine",
    sku: null,
    currentPriceEur: 12,
    wasPriceEur: null,
    discountLabel: null,
    isOnOffer: true,
    score: 1,
    quoteText: "wine",
  };

  it("keeps offers for natural phrasing across store sections", () => {
    assert.equal(
      filterCatalogMatchesByQuery("any wine on offer this week", [wineOffer]).length,
      1,
    );
    assert.equal(
      filterCatalogMatchesByQuery("what offers in the deli this week", [deliHamOffer]).length,
      1,
    );
    assert.equal(
      filterCatalogMatchesByQuery("off licence beer offers", [wineOffer]).length,
      1,
    );
    assert.equal(
      filterCatalogMatchesByQuery("dairy wall yogurt on offer", [
        {
          ...wineOffer,
          productName: "Activia Strawberry Yogurt 4 Pack (480 g)",
          quoteText: "yogurt",
        },
      ]).length,
      1,
    );
  });

  it("formats fulfilment miss quotes with alternate synced offers", () => {
    const quote = formatOfferFulfilmentMissQuote({
      query: "sirloin",
      requestedFulfilment: "counter",
      alternateMatches: [
        {
          quoteText:
            "In the pre-pack meat aisle this week. SuperValu Signature Tastes Wagyu Sirloin Steak. twenty percent off.",
        },
      ],
    });
    assert.match(quote, /No synced weekly offer for "sirloin" at the butcher counter/i);
    assert.match(quote, /pre-pack aisle/i);
    assert.match(quote, /Wagyu Sirloin/i);
    assert.doesNotMatch(quote, /never sell/i);
  });
});

describe("national product tool integration", () => {
  function database(rows: Record<string, unknown>[], rpcRows: Record<string, unknown>[] = []) {
    const calls: Record<string, unknown>[] = [];
    return {
      calls,
      rpc(_name: string, args: Record<string, unknown>) {
        calls.push(args);
        return { async abortSignal() { return { data: rpcRows, error: null }; } };
      },
      from(table: string) {
        assert.equal(table, "retail_weekly_offers", "offer browse must not fall back to regular-price catalogue");
        const equals: Array<[string, unknown]> = [];
        return {
          select() { return this; },
          eq(key: string, value: unknown) { equals.push([key, value]); return this; },
          order() { return this; },
          async range(from: number, to: number) {
            return { data: rows.filter((row) => equals.every(([key, value]) => row[key] === value)).slice(from, to + 1), error: null };
          },
        };
      },
    };
  }
  function row(name: string, label = "Only €4", fulfilment = "counter") {
    const week = currentSupervaluOfferWeek();
    return {
      id: name, retail_banner: "supervalu", is_national: true, product_name: name,
      department: "Meat", service_area: "butcher", fulfilment, offer_channel: fulfilment === "counter" ? "butcher_counter" : "prepack",
      current_price_eur: 4, was_price_eur: null, discount_label: label, search_text: name.toLowerCase(),
      offer_week_start: week.start, offer_week_end: week.end, synced_at: new Date().toISOString(),
    };
  }

  it("returns verified meat offers through the same search used by calls", async () => {
    const db = database([row("Counter Beef"), row("Prepack Chicken", "Only €4", "prepack"), { ...row("Local Pork"), is_national: false }]);
    const matches = await searchSupervaluCatalogLive("is there any meat offers in the meat counter this week", { supabase: db as never, retailBanner: "supervalu" });
    assert.deepEqual(matches.map((match) => match.productName), ["Counter Beef"]);
  });

  it("wires the exact multibuy RPC while keeping verified weekly fallback", async () => {
    const db = database([row("Bundle Beef", "3 for €10"), row("Other Beef", "2 for €5")]);
    const matches = await searchSupervaluCatalogLive("three for ten euro meat offers", { supabase: db as never, retailBanner: "supervalu" });
    assert.equal(db.calls[0]?.p_mechanic, "multibuy");
    assert.equal(db.calls[0]?.p_quantity, 3);
    assert.equal(db.calls[0]?.p_total_eur, 10);
    assert.equal(db.calls[0]?.p_service_area, "butcher");
    assert.deepEqual(matches.map((match) => match.productName), ["Bundle Beef"]);
  });

  it("never fills an absent named campaign with other offers", async () => {
    const db = database([row("Ordinary Beef")]);
    assert.deepEqual(await searchSupervaluCatalogLive("Super 7 offers", { supabase: db as never, retailBanner: "supervalu" }), []);
    assert.equal(db.calls[0]?.p_named_phrase, "super 7");
  });

  it("recognises general promotion wording as an offer browse", async () => {
    for (const query of ["promotions", "any deals", "weekly specials", "current offers"]) {
      assert.equal(inferCatalogSearchIntent(query), "offer");
      const matches = await searchSupervaluCatalogLive(query, { supabase: database([row("Current Beef")]) as never, retailBanner: "supervalu" });
      assert.equal(matches.length, 1, query);
    }
  });
});

it("quotes catalog bundle mechanics independently of their single-item price", () => {
  for (const currentPriceEur of [null, 4]) {
    const quote = formatCatalogStockQuote({ productName: "Breakfast Cereal", discountLabel: "BOGOF", isOnOffer: true, currentPriceEur, intent: "offer" });
    assert.match(quote, /buy one get one free/i);
    assert.doesNotMatch(quote, /not showing as on offer|on offer.*at four|zero euro/i);
    if (currentPriceEur == null) assert.doesNotMatch(quote, /single item price/i);
  }
});


it("stops a repeated gateway page while comparing prices", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requests += 1;
    assert.ok(init?.signal, "the entire gateway lookup must have a deadline");
    return Response.json({ items: Array.from({length: 100}, (_, i) => ({sku: `burger-${i}`, name: `Beef Burgers ${i}`, priceNumeric: 4, attributes: {altCategory: "Meat"}})) });
  });
  const matches = await searchSupervaluCatalogLive("cheapest burgers", {intent: "price"});
  assert.equal(requests, 2);
  assert.equal(matches.length, 100);
});
