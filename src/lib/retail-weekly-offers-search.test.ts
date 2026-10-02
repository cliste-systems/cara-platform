import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRetailWeeklyOffersPromptSection,
  assessSyncedOffersFreshness,
  formatWeeklyOfferQuote,
  inferWeeklyOfferFulfilmentFromQuery,
  inferWeeklyOfferServiceAreaFromQuery,
  inferWeeklyOffersListIntent,
  inferRewardsPricePointFromQuery,
  isRetailOfferWeekActive,
  loadRetailWeeklyOffersForBanner,
  isRetailOfferPriceSemanticallyValid,
  resolveWeeklyOfferSearchFilters,
  searchRetailWeeklyOffers,
  searchSyncedWeeklyOffersInRows,
  scoreSupervaluSearchText,
} from "./retail-weekly-offers-search";
import type { RetailWeeklyOfferRow } from "./supervalu-offers-types";
import {
  classifySupervaluOfferChannel,
  classifySupervaluOfferServiceArea,
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSupervaluGatewayProduct,
} from "./supervalu-offers-normalize";

function mockOfferRow(
  partial: Partial<RetailWeeklyOfferRow> & Pick<RetailWeeklyOfferRow, "id" | "product_name" | "search_text">,
): RetailWeeklyOfferRow {
  const activeWeek = currentSupervaluOfferWeek();
  return {
    organization_id: null,
    retail_banner: "supervalu",
    sync_batch_id: "batch",
    department: "Butcher",
    offer_channel: "butcher_counter",
    service_area: "butcher",
    fulfilment: "counter",
    current_price_eur: 0,
    was_price_eur: null,
    discount_label: null,
    price_per_unit: null,
    category_breadcrumb: null,
    sell_by: null,
    price_unit_type: null,
    is_alcohol: false,
    brand: null,
    sku: null,
    offer_week_start: activeWeek.start,
    offer_week_end: activeWeek.end,
    source_url: null,
    synced_at: new Date().toISOString(),
    ...partial,
  };
}

function mockSupabaseRows(rows: RetailWeeklyOfferRow[]) {
  const chain = {
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
    range: async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }),
    eq: () => chain,
    lte: () => chain,
    gte: () => chain,
  };
  return {
    from: () => ({
      select: () => ({
        eq: () => chain,
      }),
    }),
  };
}

describe("supervalu offers sync helpers", () => {
  it("detects promotional gateway products", () => {
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 5,
        wasPriceNumeric: 8,
        priceSource: "regular",
      }),
      true,
    );
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 5,
        priceSource: "tpr",
      }),
      true,
    );
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 16.74,
        wasPriceNumeric: 24.99,
        priceSource: "promotion",
        promotions: [{ name: "Save 33%" }],
      }),
      true,
    );
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 5,
        priceSource: "regular",
      }),
      false,
    );
  });

  it("normalizes butcher counter sirloin percentage promotions", () => {
    const offer = normalizeSupervaluGatewayProduct(
      {
        sku: "1019164002",
        name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        priceNumeric: 16.7433,
        wasPriceNumeric: 24.99,
        priceSource: "promotion",
        pricePerUnit: "€16.74/kg",
        sellBy: "Unit",
        unitOfPrice: { type: "kilogram" },
        promotions: [{ name: "Save 33%", description: "Save 33%" }],
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Meat & Poultry/Beef/Butcher/Beef Steaks",
          },
        ],
        attributes: { altCategory: "Beef Steaks" },
      },
      "Butcher",
    );
    assert.ok(offer);
    assert.equal(offer?.serviceArea, "butcher");
    assert.equal(offer?.fulfilment, "counter");
    assert.equal(offer?.currentPriceEur, 16.7433);
    assert.equal(offer?.wasPriceEur, 24.99);
    assert.equal(offer?.discountLabel, "Save 33%");
  });

  it("recovers fresh organic striploin as butcher prepack without pulling prepared grocery into butcher", () => {
    const steak = classifySupervaluOfferServiceArea({
      product: {
        name: "Good Herdsmen Organic Beef Striploin Steak (200 g)",
        priceNumeric: 7.43,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "/categories/prepack/organic-id-O411225",
          },
        ],
        attributes: { altCategory: "Organic" },
      },
      productName: "Good Herdsmen Organic Beef Striploin Steak (200 g)",
      department: "Organic",
      discountLabel: "Save 20%",
    });
    assert.equal(steak.serviceArea, "butcher");
    assert.equal(steak.fulfilment, "prepack");

    const gravy = classifySupervaluOfferServiceArea({
      product: {
        name: "Bisto Best Beef Gravy (230 g)",
        priceNumeric: 4,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb:
              "/categories/packet-sauces-stocks-herbs/gravy-stock-id-O301193",
          },
        ],
        attributes: { altCategory: "Gravy & Stock" },
      },
      productName: "Bisto Best Beef Gravy (230 g)",
      department: "Gravy & Stock",
    });
    assert.equal(gravy.serviceArea, "grocery");
    assert.equal(gravy.fulfilment, "prepack");

    const seasoning = classifySupervaluOfferServiceArea({
      product: {
        name: "Cape Herb Giant Steak & Chops Shaker (270 g)",
        priceNumeric: 5,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb:
              "/categories/packet-sauces-stocks-herbs/herbs-spices-id-O301195",
          },
        ],
        attributes: { altCategory: "Herbs & Spices" },
      },
      productName: "Cape Herb Giant Steak & Chops Shaker (270 g)",
      department: "Herbs & Spices",
    });
    assert.equal(seasoning.serviceArea, "grocery");
  });

  it("classifies fish counter and pre-pack fish separately", () => {
    const counter = classifySupervaluOfferServiceArea({
      product: {
        name: "Loose Side of Salmon (700 g)",
        priceNumeric: 15.99,
        wasPriceNumeric: 18.49,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Fish & Seafood/Fish Counter",
          },
        ],
        attributes: { altCategory: "Fish Counter" },
      },
      productName: "Loose Side of Salmon (700 g)",
      department: "Fish Counter",
    });
    assert.equal(counter.serviceArea, "fish");
    assert.equal(counter.fulfilment, "counter");

    const prepack = classifySupervaluOfferServiceArea({
      product: {
        name: "Keohane's Salmon Fillets (480 g)",
        priceNumeric: 9,
        wasPriceNumeric: 10.99,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Fish & Seafood/Prepack Fresh Fish",
          },
        ],
        attributes: { altCategory: "Prepack Fresh Fish" },
      },
      productName: "Keohane's Salmon Fillets (480 g)",
      department: "Prepack Fresh Fish",
    });
    assert.equal(prepack.serviceArea, "fish");
    assert.equal(prepack.fulfilment, "prepack");

    const frozen = classifySupervaluOfferServiceArea({
      product: {
        name: "Birds Eye Battered 2 Fish Fillets (200 g)",
        priceNumeric: 2.5,
        wasPriceNumeric: 4.99,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb:
              "Grocery/Frozen Foods/Frozen Fish & Seafood/Battered Fillets & Steaks",
          },
        ],
        attributes: { altCategory: "Battered Fillets & Steaks" },
      },
      productName: "Birds Eye Battered 2 Fish Fillets (200 g)",
      department: "Battered Fillets & Steaks",
    });
    assert.equal(frozen.serviceArea, "fish");
    assert.equal(frozen.fulfilment, "prepack");
  });

  it("classifies current everyday-yogurts catalogue paths as dairy", () => {
    const yogurt = classifySupervaluOfferServiceArea({
      product: {
        name: "SuperValu Natural Yogurt (500 g)",
        priceNumeric: 2.5,
        defaultCategory: [
          {
            categoryBreadcrumb:
              "/categories/everyday-yogurts/single-pots-id-O402280",
          },
        ],
        attributes: { altCategory: "Single Pots" },
      },
      productName: "SuperValu Natural Yogurt (500 g)",
      department: "Single Pots",
    });
    assert.equal(yogurt.serviceArea, "dairy");
    assert.equal(yogurt.fulfilment, "prepack");
  });

  it("classifies dairy wall products separately from generic grocery", () => {
    const dairy = classifySupervaluOfferServiceArea({
      product: {
        name: "SuperValu Whole Milk 2L",
        priceNumeric: 2.2,
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Milk, Yogurt, Butter & Eggs/Fresh Milk/Whole Milk",
          },
        ],
        attributes: { altCategory: "Whole Milk" },
      },
      productName: "SuperValu Whole Milk 2L",
      department: "Whole Milk",
    });
    assert.equal(dairy.serviceArea, "dairy");
    assert.equal(dairy.fulfilment, "prepack");
  });

  it("classifies grocery promos separately from meat", () => {
    assert.equal(
      classifySupervaluOfferChannel({
        productName: "Cadbury Dairy Milk (110 g)",
        department: "Chocolate Bars",
        discountLabel: "Only €2",
      }),
      "grocery",
    );
  });

  it("classifies Carroll's deli counter ham separately from pre-pack chilled ham", () => {
    const counter = classifySupervaluOfferServiceArea({
      product: {
        name: "Carroll's of Tullamore Crumbed Ham (1 kg)",
        priceNumeric: 24.99,
        wasPriceNumeric: 29.99,
        priceLabel: "Only €24.99",
        pricePerUnit: "€24.99/kg",
        sellBy: "Unit",
        unitOfPrice: { type: "kilogram" },
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Deli Counter/Cooked Meats/Ham",
          },
        ],
        attributes: { altCategory: "Ham" },
      },
      productName: "Carroll's of Tullamore Crumbed Ham (1 kg)",
      department: "Ham",
      discountLabel: "Only €24.99",
    });
    assert.equal(counter.serviceArea, "deli");
    assert.equal(counter.fulfilment, "counter");

    const prepack = classifySupervaluOfferServiceArea({
      product: {
        name: "Carrolls of Tullamore Wafer Thin Traditional Ham (200 g)",
        priceNumeric: 3.5,
        pricePerUnit: "€17.50/kg",
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Chilled Food/Sliced Cooked Meats/Ham",
          },
        ],
        attributes: { altCategory: "Ham" },
      },
      productName: "Carrolls of Tullamore Wafer Thin Traditional Ham (200 g)",
      department: "Ham",
    });
    assert.equal(prepack.serviceArea, "deli");
    assert.equal(prepack.fulfilment, "prepack");
  });

  it("classifies pre-pack quick fry separately from butcher counter", () => {
    assert.equal(
      classifySupervaluOfferChannel({
        productName: "SuperValu Salt & Chilli Beef Quick Fry Steak (280 g)",
        department: "Beef Steaks",
        discountLabel: "Only €4",
      }),
      "prepack",
    );
    assert.equal(
      classifySupervaluOfferChannel({
        productName: "Irish Striploin Steak",
        department: "Butcher",
        discountLabel: "3 for €10",
      }),
      "butcher_counter",
    );
  });

  it("infers service area from query when no explicit filter is set", () => {
    assert.equal(
      resolveWeeklyOfferSearchFilters("deli offers", { serviceArea: "deli", fulfilment: "counter" })
        .serviceArea,
      "deli",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("butcher counter", {}).serviceArea,
      "butcher",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("sirloin at the meat counter", {}).fulfilment,
      "counter",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("pre-pack rashers in the meat aisle", {}).fulfilment,
      "prepack",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("any steaks on offer this week", {}).fulfilment,
      null,
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("what alcohol is on offer", {}).serviceArea,
      "off_licence",
    );
  });

  it("normalizes gateway products into offer rows", () => {
    const offer = normalizeSupervaluGatewayProduct(
      {
        sku: "123",
        name: "Irish Striploin Steak",
        priceNumeric: 12.99,
        wasPriceNumeric: 16.99,
        priceLabel: "Only €12.99",
        pricePerUnit: "€12.99/kg",
        sellBy: "Unit",
        unitOfPrice: { type: "kilogram" },
        url: "https://shop.supervalu.ie/example",
        defaultCategory: [{ categoryBreadcrumb: "Grocery/Butcher/Beef Steaks" }],
        attributes: { altCategory: "Butcher" },
      },
      "Butcher",
    );
    assert.ok(offer);
    assert.equal(offer?.productName, "Irish Striploin Steak");
    assert.equal(offer?.serviceArea, "butcher");
    assert.equal(offer?.fulfilment, "counter");
    assert.equal(offer?.currentPriceEur, 12.99);
    assert.match(offer?.searchText ?? "", /striploin/);
  });

  it("formats deli counter ham quotes per kilo", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Carroll's Crumbed Ham",
      serviceArea: "deli",
      fulfilment: "counter",
      currentPriceEur: 24.99,
      wasPriceEur: 29.99,
      priceUnitType: "kilogram",
      sellBy: "Unit",
    });
    assert.match(quote, /deli counter/i);
    assert.match(quote, /seventeen percent off/i);
    assert.match(quote, /Now twenty four euro ninety nine per kilo/i);
    assert.match(quote, /Usually twenty nine euro ninety nine per kilo/i);
  });

  it("speaks Rewards multibuy terms without treating the single price as the offer price", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Kellogg's Rice Krispies Caramel & Chocolate Squares 4 Pack (36 g)",
      serviceArea: "grocery",
      fulfilment: "prepack",
      currentPriceEur: 2.99,
      wasPriceEur: null,
      discountLabel: "3 for €5 Rewards Price",
      pricePerUnit: "€20.76/kg",
    });

    assert.match(quote, /three for five euro with Real Rewards/i);
    assert.match(quote, /Single price two euro ninety nine each/i);
    assert.doesNotMatch(quote, /Now two euro ninety nine/i);
  });

  it("returns a synced Rewards multibuy for the exact product search", () => {
    const rows = [
      mockOfferRow({
        id: "rice-krispies-multibuy",
        product_name: "Kellogg's Rice Krispies Caramel & Chocolate Squares 4 Pack (36 g)",
        department: "Cereal Bars",
        service_area: "grocery",
        fulfilment: "prepack",
        offer_channel: "grocery",
        current_price_eur: 2.99,
        was_price_eur: null,
        discount_label: "3 for €5 Rewards Price",
        price_per_unit: "€20.76/kg",
        sku: "1023070000",
        search_text:
          "kelloggs rice krispies caramel chocolate squares 4 pack cereal bars 1023070000",
      }),
    ];

    const matches = searchSyncedWeeklyOffersInRows(
      rows,
      "Kellogg's Rice Krispies Caramel Chocolate Squares",
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.discountLabel, "3 for €5 Rewards Price");
    assert.match(matches[0]?.quoteText ?? "", /three for five euro with Real Rewards/i);
  });

  it("leads with percent off and uses Usually for was price", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Pork Loin Chops",
      serviceArea: "butcher",
      fulfilment: "counter",
      currentPriceEur: 6.75,
      wasPriceEur: 13.49,
      priceUnitType: "kilogram",
      sellBy: "Unit",
    });
    assert.match(quote, /fifty percent off/i);
    assert.match(quote, /Now six euro seventy five per kilo/i);
    assert.match(quote, /Usually thirteen euro forty nine per kilo/i);
    const percentIndex = quote.indexOf("percent off");
    const nowIndex = quote.indexOf("Now six");
    assert.ok(percentIndex >= 0 && nowIndex > percentIndex);
  });

  it("does not label packaged offers outside the butcher department as meat", () => {
    for (const serviceArea of ["dairy", "bakery", "produce", "grocery", "off_licence"] as const) {
      const quote = formatWeeklyOfferQuote({ productName: "Department product", offerChannel: "prepack", serviceArea, fulfilment: "prepack", currentPriceEur: 2 });
      assert.doesNotMatch(quote, /meat aisle|butcher counter/i, serviceArea);
      assert.match(quote, /two euro/i);
    }
    assert.doesNotMatch(formatWeeklyOfferQuote({ productName: "Packaged product", offerChannel: "prepack", currentPriceEur: 2 }), /meat aisle/i);
  });

  it("formats pre-pack offers in short clear sentences", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "SuperValu Signature Tastes Thick Cut Chops with Pepper Sauce (600 g)",
      serviceArea: "butcher",
      fulfilment: "prepack",
      currentPriceEur: 6,
      wasPriceEur: 7.69,
    });
    assert.match(quote, /pre-pack meat aisle/i);
    assert.doesNotMatch(quote, /\(600 g\)/);
    assert.match(quote, /Now six euro\./i);
    assert.match(quote, /Usually seven euro sixty nine\./i);
  });

  it("computes Thursday-start offer weeks in Dublin time", () => {
    const week = currentSupervaluOfferWeek(new Date("2026-09-10T12:00:00Z"));
    assert.equal(week.start, "2026-09-10");
    assert.equal(week.end, "2026-09-16");
  });

  it("drops expired offer weeks from active filter", () => {
    const row = mockOfferRow({
      id: "expired",
      product_name: "Irish Striploin Steak",
      search_text: "striploin",
      offer_week_start: "2026-09-10",
      offer_week_end: "2026-09-16",
    });
    assert.equal(
      isRetailOfferWeekActive(row, new Date("2026-09-20T12:00:00Z")),
      false,
    );
    assert.equal(
      isRetailOfferWeekActive(row, new Date("2026-09-16T12:00:00Z")),
      true,
    );
  });

  it("flags stale synced offers when week ended", () => {
    const freshness = assessSyncedOffersFreshness({
      syncedAt: "2026-09-13T13:01:42.811Z",
      offerWeekEnd: "2026-09-16",
      reference: new Date("2026-09-20T12:00:00Z"),
    });
    assert.equal(freshness.stale, true);
    assert.match(freshness.message ?? "", /out of date/i);
  });
});

describe("retail weekly offers search", () => {
  it("filters Rewards offer browsing by an exact numeric or spoken price point", () => {
    assert.equal(inferRewardsPricePointFromQuery("What's on Rewards Price for €2.50?"), 2.5);
    assert.equal(inferRewardsPricePointFromQuery("Real Rewards offers for two euro fifty"), 2.5);
    assert.equal(inferRewardsPricePointFromQuery("Anything with Rewards at two fifty?"), 2.5);
    assert.equal(inferWeeklyOffersListIntent("Anything with Rewards at two fifty?"), true);

    const rows = [
      mockOfferRow({
        id: "reward-250",
        product_name: "Aquafresh White Renew Toothpaste (75 ml)",
        department: "Dental Care",
        service_area: "grocery",
        fulfilment: "prepack",
        offer_channel: "grocery",
        current_price_eur: 2.5,
        was_price_eur: 5,
        discount_label: "Rewards Price Only €2.50",
        search_text: "aquafresh white renew toothpaste rewards price only 2.50",
      }),
      mockOfferRow({
        id: "reward-1100",
        product_name: "Two Tracks Sauvignon Blanc (750 ml)",
        department: "Wine",
        service_area: "off_licence",
        fulfilment: "prepack",
        offer_channel: "grocery",
        current_price_eur: 11,
        was_price_eur: 12,
        discount_label: "Rewards Price Only €11",
        is_alcohol: true,
        search_text: "two tracks sauvignon blanc rewards price only 11",
      }),
      mockOfferRow({
        id: "standard-250",
        product_name: "Ordinary €2.50 Deal",
        department: "Grocery",
        service_area: "grocery",
        fulfilment: "prepack",
        offer_channel: "grocery",
        current_price_eur: 2.5,
        was_price_eur: 3,
        discount_label: "Only €2.50",
        search_text: "ordinary deal only 2.50",
      }),
    ];

    for (const query of [
      "What's on Rewards Price for €2.50?",
      "What offers are €2.50 with Real Rewards?",
      "Anything with Rewards at two fifty?",
    ]) {
      const matches = searchSyncedWeeklyOffersInRows(rows, query);
      assert.deepEqual(matches.map((match) => match.productName), [
        "Aquafresh White Renew Toothpaste (75 ml)",
      ]);
      assert.equal(matches[0]?.currentPriceEur, 2.5);
      assert.match(matches[0]?.quoteText ?? "", /rewards price/i);
      assert.match(matches[0]?.quoteText ?? "", /two euro fifty/i);
    }
  });

  it("treats a real department query like cereals as a browse, not one ambiguous product", () => {
    const rows = [
      mockOfferRow({
        id: "cereal-1",
        product_name: "Kellogg's Corn Flakes (450 g)",
        department: "Cereals",
        category_breadcrumb: "/categories/breakfast-cereals/cereals-id-O303590",
        search_text: "kellogg's corn flakes cereals breakfast cereals",
      }),
      mockOfferRow({
        id: "cereal-2",
        product_name: "Weetabix 24 Pack (430 g)",
        department: "Cereals",
        category_breadcrumb: "/categories/breakfast-cereals/cereals-id-O303590",
        search_text: "weetabix cereals breakfast cereals",
      }),
      mockOfferRow({
        id: "other",
        product_name: "Tayto Cheese & Onion Crisps",
        department: "Crisps",
        category_breadcrumb: "/categories/snacks/crisps",
        search_text: "tayto crisps",
      }),
    ];
    const matches = searchSyncedWeeklyOffersInRows(rows, "cereals");
    assert.equal(matches.length, 2);
    assert.ok(matches.every((match) => /cereal/i.test(match.department)));
  });


  it("rejects Save euro rows when the saving amount is mistaken for the selling price", () => {
    assert.equal(
      isRetailOfferPriceSemanticallyValid(
        mockOfferRow({
          id: "bad-wagyu",
          product_name: "SuperValu Signature Tastes Wagyu Sirloin Steak (227 g)",
          search_text: "wagyu sirloin steak",
          current_price_eur: 2,
          was_price_eur: 7.99,
          discount_label: "Save €2",
        }),
      ),
      false,
    );
  });

  it("accepts Save euro rows only when price maths reconciles", () => {
    assert.equal(
      isRetailOfferPriceSemanticallyValid(
        mockOfferRow({
          id: "good-wagyu",
          product_name: "SuperValu Signature Tastes Wagyu Sirloin Steak (227 g)",
          search_text: "wagyu sirloin steak",
          current_price_eur: 7.99,
          was_price_eur: 9.99,
          discount_label: "Save €2",
        }),
      ),
      true,
    );
  });


  it("scores minor STT spelling slips against the intended product word", () => {
    const fillet = scoreSupervaluSearchText(
      "supervalu signature tastes hereford irish fillet steak",
      ["filled", "steak"],
      "Beef Steaks",
    );
    const striploin = scoreSupervaluSearchText(
      "supervalu signature tastes irish striploin steak",
      ["filled", "steak"],
      "Beef Steaks",
    );
    assert.ok(fillet > 0.85);
    assert.ok(fillet > striploin + 0.25);
  });


  const rows: RetailWeeklyOfferRow[] = [
    mockOfferRow({
      id: "1",
      product_name: "Irish Striploin Steak",
      department: "Butcher",
      offer_channel: "butcher_counter",
      service_area: "butcher",
      fulfilment: "counter",
      current_price_eur: 12.99,
      was_price_eur: 16.99,
      discount_label: "Only €12.99",
      price_per_unit: "€12.99/kg",
      sku: "123",
      search_text: "irish striploin steak butcher 123",
    }),
    mockOfferRow({
      id: "2",
      product_name: "Chicken Fillets",
      department: "Butcher",
      offer_channel: "butcher_counter",
      service_area: "butcher",
      fulfilment: "counter",
      current_price_eur: 5,
      sku: "456",
      search_text: "chicken fillets butcher 456",
    }),
  ];

  it("formats quote text without disclaimer", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Irish Striploin Steak",
      serviceArea: "butcher",
      fulfilment: "counter",
      currentPriceEur: 12.99,
      wasPriceEur: 16.99,
      discountLabel: "Only €12.99",
      priceUnitType: "kilogram",
    });
    assert.match(quote, /Irish Striploin Steak/);
    assert.match(quote, /twenty four percent off/i);
    assert.match(quote, /Now twelve euro ninety nine per kilo/i);
    assert.match(quote, /Usually sixteen euro ninety nine per kilo/i);
    assert.doesNotMatch(quote, /local shop may vary/i);
  });

  it("builds a compact prompt section", () => {
    const section = buildRetailWeeklyOffersPromptSection({
      offers: rows,
      syncedAt: "2026-09-10T06:00:00.000Z",
    });
    assert.ok(section);
    assert.match(section ?? "", /searchSuperValuProducts/);
    assert.match(section ?? "", /Striploin/);
  });

  it("filters butcher counter queries away from pre-pack rows", async () => {
    const mixedRows: RetailWeeklyOfferRow[] = [
      ...rows,
      mockOfferRow({
        id: "3",
        product_name: "SuperValu Quick Fry Steak (280 g)",
        department: "Beef Steaks",
        offer_channel: "prepack",
        service_area: "butcher",
        fulfilment: "prepack",
        search_text: "supervalu quick fry steak beef steaks",
      }),
    ];

    const counterMatches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "steak",
      { serviceArea: "butcher", fulfilment: "counter" },
    );
    assert.equal(counterMatches.length, 1);
    assert.equal(counterMatches[0]?.fulfilment, "counter");
  });

  it("keeps deli counter ham out of butcher counter filters", async () => {
    const mixedRows: RetailWeeklyOfferRow[] = [
      ...rows,
      mockOfferRow({
        id: "4",
        product_name: "Carroll's of Tullamore Crumbed Ham (1 kg)",
        department: "Ham",
        offer_channel: "butcher_counter",
        service_area: "deli",
        fulfilment: "counter",
        current_price_eur: 24.99,
        search_text: "carrolls crumbed ham deli counter",
      }),
    ];

    const butcherMatches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "steak",
      { serviceArea: "butcher", fulfilment: "counter" },
    );
    assert.ok(butcherMatches.every((match) => match.serviceArea === "butcher"));

    const deliMatches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "ham",
      { serviceArea: "deli", fulfilment: "counter" },
    );
    assert.equal(deliMatches.length, 1);
    assert.match(deliMatches[0]?.productName ?? "", /Carroll/i);
  });

  it("lists deli counter offers without returning grocery when area is set", async () => {
    const mixedRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "5",
        product_name: "Activia Gut Health Cereals 4 Pack (115 g)",
        department: "Active Health",
        offer_channel: "prepack",
        service_area: "grocery",
        fulfilment: "prepack",
        current_price_eur: 2.99,
        search_text: "activia gut health cereals",
      }),
      mockOfferRow({
        id: "6",
        product_name: "SuperValu Traditional Cooked Ham (1 kg)",
        department: "Ham",
        offer_channel: "butcher_counter",
        service_area: "deli",
        fulfilment: "counter",
        current_price_eur: 22,
        search_text: "traditional cooked ham deli counter",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "ham",
      { serviceArea: "deli", fulfilment: "counter" },
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /Ham/i);
  });

  it("lists butcher counter offers when caller chose counter after clarifying", async () => {
    const butcherRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "prepack-1",
        product_name: "Denny Luncheon Roll (90 g)",
        department: "Beef & Luncheon Meats",
        fulfilment: "prepack",
        offer_channel: "prepack",
        current_price_eur: 1,
        search_text: "denny luncheon roll prepack",
      }),
      mockOfferRow({
        id: "counter-1",
        product_name: "SuperValu Fresh Irish Pork Steak (1 kg)",
        department: "Pork",
        fulfilment: "counter",
        offer_channel: "butcher_counter",
        current_price_eur: 6.69,
        search_text: "supervalu fresh irish pork steak butcher counter",
      }),
      mockOfferRow({
        id: "counter-2",
        product_name: "SuperValu Fresh Irish Carvery Lamb Shoulder (1 kg)",
        department: "Lamb",
        fulfilment: "counter",
        offer_channel: "butcher_counter",
        current_price_eur: 9,
        search_text: "supervalu fresh irish carvery lamb shoulder butcher counter",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(butcherRows) as never,
      "supervalu",
      "what's on offer in the meat counter this week",
      { fulfilment: "counter" },
    );
    assert.equal(matches.length, 2);
    assert.ok(matches.every((match) => match.fulfilment === "counter"));
    assert.ok(
      matches.some((match) => /Pork Steak/i.test(match.productName)),
    );
    assert.ok(
      matches.every((match) => !/Denny Luncheon/i.test(match.productName)),
    );
  });

  it("infers fulfilment when the caller explicitly names the counter", () => {
    assert.equal(
      resolveWeeklyOfferSearchFilters("what's on offer in the meat counter this week")
        .fulfilment,
      "counter",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("meat counter steaks", { fulfilment: "counter" })
        .fulfilment,
      "counter",
    );
  });

  it("infers browse/list intent for general offer questions", () => {
    assert.equal(inferWeeklyOffersListIntent("best offers"), true);
    assert.equal(inferWeeklyOffersListIntent("what offers do you have apart from meat"), true);
    assert.equal(inferWeeklyOffersListIntent("milk bread crisps chocolate fruit"), true);
    assert.equal(inferWeeklyOffersListIntent("surprise me with your best one"), true);
    assert.equal(inferWeeklyOffersListIntent("deli offers"), true);
    assert.equal(inferWeeklyOffersListIntent("what alcohol is on offer"), true);
    assert.equal(inferWeeklyOffersListIntent("alcohol on offer"), true);
    assert.equal(inferWeeklyOffersListIntent("dairy on offer"), true);
    assert.equal(inferWeeklyOffersListIntent("ham"), false);
    assert.equal(inferWeeklyOffersListIntent("rashers"), false);
    assert.equal(
      inferWeeklyOffersListIntent("what offers in the meat counter this week"),
      true,
    );
    assert.equal(
      inferWeeklyOffersListIntent("what's on offer at the butcher counter"),
      true,
    );
    assert.equal(inferWeeklyOffersListIntent("what offers in the fruit and veg"), true);
    assert.equal(inferWeeklyOffersListIntent("any offers on the dairy wall"), true);
    assert.equal(inferWeeklyOffersListIntent("offers in the back store"), true);
    assert.equal(inferWeeklyOffersListIntent("fish offers this week"), true);
  });

  it("infers store section service areas from varied caller phrasing", () => {
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("dairy wall offers"), "dairy");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("back store specials"), "grocery");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("provisions on offer"), "grocery");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("fruit and veg offers"), "produce");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("off licence wine"), "off_licence");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("seafood counter salmon"), "fish");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("deli department ham"), "deli");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("meat department steaks"), "butcher");
  });

  it("only narrows fulfilment when the caller explicitly chose counter or pre-pack", () => {
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("deli offers"), null);
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("butcher offers"), null);
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("meat counter steaks"), "counter");
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("pre-pack ham"), "prepack");
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("fish aisle salmon"), "prepack");
  });

  it("samples off-licence offers for alcohol category questions", async () => {
    const alcoholRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "a1",
        product_name: "Corona Extra Lager Bottle (620 ml)",
        department: "Beer",
        service_area: "off_licence",
        fulfilment: "prepack",
        current_price_eur: 3.5,
        is_alcohol: true,
        search_text: "corona extra lager beer off licence",
      }),
      mockOfferRow({
        id: "a2",
        product_name: "Brancott Estate Marlborough Sauvignon Blanc (75 cl)",
        department: "Wine",
        service_area: "off_licence",
        fulfilment: "prepack",
        current_price_eur: 12,
        is_alcohol: true,
        search_text: "brancott estate marlborough sauvignon blanc wine",
      }),
      mockOfferRow({
        id: "a3",
        product_name: "Brew Dog Punk Alcohol Free IPA Cans 4 Pack (330 ml)",
        department: "Beer",
        service_area: "grocery",
        fulfilment: "prepack",
        current_price_eur: 8,
        is_alcohol: false,
        search_text: "brew dog punk alcohol free ipa beer",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(alcoholRows) as never,
      "supervalu",
      "what alcohol is on offer",
    );
    assert.ok(matches.length >= 2);
    assert.ok(matches.every((match) => match.serviceArea === "off_licence"));
    assert.ok(matches.every((match) => match.isAlcohol === true));
  });

  it("finds meat offers by product tokens", async () => {
    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(rows) as never,
      "supervalu",
      "steak",
    );
    assert.ok(matches.length >= 1);
    assert.match(matches[0]?.productName ?? "", /Striploin/i);
  });

  it("does not treat specific product offer questions as list intent", () => {
    assert.equal(inferWeeklyOffersListIntent("is striploin steak on offer"), false);
    assert.equal(inferWeeklyOffersListIntent("what offers in the meat counter this week"), true);
  });

  it("scores striploin queries highest", async () => {
    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(rows) as never,
      "supervalu",
      "is striploin steak on offer",
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.productName, "Irish Striploin Steak");
  });

  it("finds pre-pack steak offers and drops breadcrumb-only steak matches", async () => {
    const steakRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "10",
        product_name: "SuperValu Salt & Chilli Beef Quick Fry Steak (280 g)",
        department: "Beef Steaks",
        offer_channel: "prepack",
        service_area: "butcher",
        fulfilment: "prepack",
        current_price_eur: 4,
        search_text:
          "supervalu salt chilli beef quick fry steak 280 g beef steaks pre pack",
      }),
      mockOfferRow({
        id: "11",
        product_name: "Donegal Catch Chip Shop Battered Fish Goujons (400 g)",
        department: "Breaded Fillets & Steaks",
        offer_channel: "prepack",
        service_area: "butcher",
        fulfilment: "prepack",
        current_price_eur: 4.5,
        search_text:
          "donegal catch chip shop battered fish goujons breaded fillets steaks frozen fish",
      }),
    ];

    const counterOnly = await searchRetailWeeklyOffers(
      mockSupabaseRows(steakRows) as never,
      "supervalu",
      "steaks",
      { serviceArea: "butcher", fulfilment: "counter" },
    );
    assert.equal(counterOnly.length, 0);

    const butcherSteaks = await searchRetailWeeklyOffers(
      mockSupabaseRows(steakRows) as never,
      "supervalu",
      "steaks",
      { serviceArea: "butcher" },
    );
    assert.equal(butcherSteaks.length, 1);
    assert.match(butcherSteaks[0]?.productName ?? "", /Quick Fry Steak/i);
  });

  it("finds corned beef without pulling unrelated beef offers", async () => {
    const cornedRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "c1",
        product_name: "Horgans Sliced Corned Beef (120 g)",
        department: "Beef & Lucheon Meats",
        service_area: "deli",
        fulfilment: "prepack",
        current_price_eur: 3,
        search_text: "horgans sliced corned beef deli",
      }),
      mockOfferRow({
        id: "c2",
        product_name: "SuperValu Beef Meatballs Promo (770 g)",
        department: "Beef",
        service_area: "butcher",
        fulfilment: "prepack",
        current_price_eur: 4,
        search_text: "supervalu beef meatballs promo",
      }),
      mockOfferRow({
        id: "c3",
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        department: "Beef Steaks",
        service_area: "butcher",
        fulfilment: "counter",
        current_price_eur: 16.74,
        search_text: "supervalu fresh irish beef sirloin steak",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(cornedRows) as never,
      "supervalu",
      "corned beef",
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /Horgans Sliced Corned Beef/i);
    assert.match(matches[0]?.quoteText ?? "", /pre-pack deli/i);
  });
});

describe("complete current offer browse regressions", () => {
  const offer = (id: string, area: RetailWeeklyOfferRow["service_area"], fulfilment: RetailWeeklyOfferRow["fulfilment"], department: string = area) => mockOfferRow({
    id, product_name: id, service_area: area, fulfilment, department,
    current_price_eur: 4, search_text: `${id} ${department}`, discount_label: "Only €4",
  });

  it("answers the real meat counter phrasing and plain meat offers", () => {
    const rows = [offer("Counter beef", "butcher", "counter"), offer("Prepack chicken", "butcher", "prepack"), offer("Tea", "grocery", "prepack")];
    const broad = searchSyncedWeeklyOffersInRows(rows, "are there any meat offers");
    assert.deepEqual(new Set(broad.map((row) => row.productName)), new Set(["Counter beef", "Prepack chicken"]));
    const counter = searchSyncedWeeklyOffersInRows(rows, "is there any meat offers in the meat counter this week");
    assert.deepEqual(counter.map((row) => row.productName), ["Counter beef"]);
  });

  it("rejects future and expired dates at Dublin midnight boundaries", () => {
    const row = { offer_week_start: "2026-09-24", offer_week_end: "2026-09-30" };
    assert.equal(isRetailOfferWeekActive(row, new Date("2026-09-23T22:59:59Z")), false);
    assert.equal(isRetailOfferWeekActive(row, new Date("2026-09-23T23:00:00Z")), true);
    assert.equal(isRetailOfferWeekActive(row, new Date("2026-09-30T22:59:59Z")), true);
    assert.equal(isRetailOfferWeekActive(row, new Date("2026-09-30T23:00:00Z")), false);
  });

  it("includes all service areas even with many earlier bakery departments", () => {
    const rows = Array.from({ length: 30 }, (_, i) => offer(`Bread ${i}`, "bakery", "counter", `Bakery ${i}`));
    for (const area of ["butcher", "deli", "fish", "produce", "grocery", "dairy", "off_licence"] as const) rows.push(offer(area, area, "prepack"));
    const matches = searchSyncedWeeklyOffersInRows(rows, "weekly offers");
    assert.equal(new Set(matches.map((row) => row.serviceArea)).size, 8);
  });

  it("fills the result window when one meat fulfilment has fewer offers", () => {
    const rows = Array.from({ length: 20 }, (_, i) => offer(`Counter ${i}`, "butcher", "counter"));
    rows.push(offer("Prepack chicken", "butcher", "prepack"));
    const matches = searchSyncedWeeklyOffersInRows(rows, "meat offers");
    assert.equal(matches.length, 16);
    assert.ok(matches.some((row) => row.fulfilment === "prepack"));
  });

  it("keeps household and frozen browsing within their real category", () => {
    const rows = [offer("Tea", "grocery", "prepack", "Tea"), offer("Detergent", "grocery", "prepack", "Household"), offer("Frozen Pizza", "grocery", "prepack", "Frozen Foods")];
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "household offers").map((row) => row.productName), ["Detergent"]);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "frozen offers").map((row) => row.productName), ["Frozen Pizza"]);
  });

  it("keeps dairy and produce available when excluding meat", () => {
    const rows = [offer("Beef", "butcher", "counter"), offer("Milk", "dairy", "prepack"), offer("Apples", "produce", "prepack")];
    assert.deepEqual(new Set(searchSyncedWeeklyOffersInRows(rows, "offers apart from meat").map((row) => row.productName)), new Set(["Milk", "Apples"]));
  });

  it("does not substitute unrelated products in a requested multibuy or campaign", () => {
    const rows = [
      { ...offer("Strawberries", "produce", "prepack"), discount_label: "3 for €10" },
      { ...offer("Apples", "produce", "prepack"), discount_label: "2 for €5" },
      { ...offer("Carrots", "produce", "prepack"), discount_label: "Super 7 Only €4" },
    ];
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "three for ten euro").map((row) => row.productName), ["Strawberries"]);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "Super 7 offers").map((row) => row.productName), ["Carrots"]);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "3 for 12 offers"), []);
    assert.equal(searchSyncedWeeklyOffersInRows(rows, "multibuys").length, 2);
  });

  it("loads later departments after an invalid row in the first full database page", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => offer(`Product ${i}`, "grocery", "prepack"));
    rows[0]!.offer_week_end = "2020-01-01";
    rows[1000] = offer("Late meat offer", "butcher", "counter");
    const loaded = await loadRetailWeeklyOffersForBanner(mockSupabaseRows(rows) as never, "supervalu");
    assert.equal(loaded.length, 1000);
    assert.ok(loaded.some((row) => row.product_name === "Late meat offer"));
  });
});

it("keeps verified multibuys without inventing an individual price", async () => {
  const row = mockOfferRow({ id: "bundle", product_name: "Mixed Berries", search_text: "mixed berries", current_price_eur: null, discount_label: "3 for €10", service_area: "produce", fulfilment: "prepack" });
  assert.equal(isRetailOfferPriceSemanticallyValid(row), true);
  assert.equal(isRetailOfferPriceSemanticallyValid({ ...row, discount_label: "Only €10" }), false);
  const matches = await searchRetailWeeklyOffers(mockSupabaseRows([row]) as never, "supervalu", "three for ten euro");
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.currentPriceEur, null);
  assert.match(matches[0]?.quoteText ?? "", /three for ten euro/i);
  assert.doesNotMatch(matches[0]?.quoteText ?? "", /single price|zero|now null/i);
});

it("keeps section phrasing from becoming a required product name", () => {
  const rows = [
    mockOfferRow({ id: "milk", product_name: "Milk", search_text: "milk dairy", service_area: "dairy", fulfilment: "prepack", current_price_eur: 2 }),
    mockOfferRow({ id: "wine", product_name: "Wine", search_text: "wine", service_area: "off_licence", fulfilment: "prepack", is_alcohol: true, current_price_eur: 9 }),
    mockOfferRow({ id: "tea", product_name: "Tea", search_text: "tea grocery", service_area: "grocery", fulfilment: "prepack", current_price_eur: 3 }),
  ];
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "any offers on the dairy wall").map((row) => row.productName), ["Milk"]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "off licence offers").map((row) => row.productName), ["Wine"]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "offers in the back store").map((row) => row.productName), ["Tea"]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "frozen offers"), []);
});

describe("non-price promotion mechanics", () => {
  function promotion(id: string, label: string, current: number | null = null) {
    return mockOfferRow({ id, product_name: id, search_text: id.toLowerCase(), service_area: "grocery", fulfilment: "prepack", department: "Cereals", current_price_eur: current, discount_label: label });
  }

  it("retains BOGOF, buy-get-free, mix-and-match and generic multibuy with no agreed single price", async () => {
    for (const label of ["BOGOF", "Buy One Get One Free", "Buy 2 Get 1 Free", "Mix & Match", "Multibuy"]) {
      const row = promotion("Cereal", label);
      assert.equal(isRetailOfferPriceSemanticallyValid(row), true, label);
      const matches = await searchRetailWeeklyOffers(mockSupabaseRows([row]) as never, "supervalu", "cereal offers");
      assert.equal(matches.length, 1, label);
      assert.equal(matches[0]?.currentPriceEur, null);
      assert.doesNotMatch(matches[0]?.quoteText ?? "", /zero euro|single price|now null|now zero/i);
    }
    assert.equal(isRetailOfferPriceSemanticallyValid(promotion("Unverified", "Special offer")), false);
  });

  it("keeps a requested buy-one-get-one-free separate from other multibuys", () => {
    const rows = [promotion("Cereal A", "BOGOF"), promotion("Cereal B", "3 for €10"), promotion("Cereal C", "Buy 1 Get 1 Half Price")];
    const matches = searchSyncedWeeklyOffersInRows(rows, "buy-one-get-one-free offers");
    assert.deepEqual(matches.map((row) => row.productName), ["Cereal A"]);
    assert.match(matches[0]?.quoteText ?? "", /buy one get one free/i);
    assert.equal(searchSyncedWeeklyOffersInRows(rows, "multibuys").length, 3);
  });

  it("quotes exact mix-and-match terms while keeping ordinary bundles out of that query", () => {
    const rows = [promotion("Cereal A", "Mix & Match 3 for €10"), promotion("Cereal B", "2 for €5")];
    const matches = searchSyncedWeeklyOffersInRows(rows, "mix and match offers");
    assert.deepEqual(matches.map((row) => row.productName), ["Cereal A"]);
    assert.match(matches[0]?.quoteText ?? "", /mix and match:? three for ten euro/i);
  });

  it("preserves points as points, never interpreting their count as a euro price", () => {
    const rows = [promotion("Cereal A", "Earn 100 Extra Real Rewards Points", 4), promotion("Cereal B", "Rewards Price Only €3", 3)];
    assert.equal(inferRewardsPricePointFromQuery("100 Real Rewards points offers"), null);
    const matches = searchSyncedWeeklyOffersInRows(rows, "Real Rewards points offers");
    assert.deepEqual(matches.map((row) => row.productName), ["Cereal A"]);
    assert.match(matches[0]?.quoteText ?? "", /100 Extra Real Rewards Points/i);
    assert.match(matches[0]?.quoteText ?? "", /Now four euro/i);
    assert.doesNotMatch(matches[0]?.quoteText ?? "", /hundred euro|100 euro/i);
  });
});

it("matches the current produce campaign from source membership, never name or price guesses", () => {
  const row = (id: string, label: string, sourceUrl: string | null = null) => mockOfferRow({ id, product_name: id, search_text: id.toLowerCase(), service_area: "produce", fulfilment: "prepack", department: "Fresh Produce", current_price_eur: 1, discount_label: label, source_url: sourceUrl });
  const rows = [
    { ...row("Campaign Carrots", "Only €1", "https://supervalu.ie/super-stars-fruit-veg"), campaign_names: ["Super Fresh 5 F&V - WK39"] },
    row("Super Fresh 5 Unrelated Product Name", "Only €1"),
    row("Unrelated Cheap Produce", "Only €1"),
    row("Different Campaign", "Super 7 Only €1"),
  ];
  for (const query of ["Super Fresh five offers", "SuperFresh5", "Super Stars produce offers"]) {
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, query).map((match) => match.productName), ["Campaign Carrots"], query);
  }
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, "Super 7 offers").map((match) => match.productName), ["Different Campaign"]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows.slice(0, 3), "Super 7 offers"), []);
});

it("preserves pack, coupon and purchase-limit conditions when speaking a numeric multibuy", () => {
  const quote = formatWeeklyOfferQuote({ productName: "Selected Berries", serviceArea: "produce", fulfilment: "prepack", currentPriceEur: null,
    discountLabel: "3 for €10. Selected 500g packs. Activate coupon before paying. Limit per product 4.",
  });
  assert.match(quote, /three for ten euro/i);
  assert.match(quote, /Selected 500g packs/);
  assert.match(quote, /Activate coupon before paying/);
  assert.match(quote, /Limit per product 4/);
  assert.doesNotMatch(quote, /Single price|Now null|zero euro/i);
});

it("uses verified campaign membership independently of the actual product promotion price", () => {
  const member = mockOfferRow({ id: "member", product_name: "Selected Peppers", search_text: "selected peppers", department: "Produce", service_area: "produce", fulfilment: "prepack",
    campaign_names: ["Super Fresh 5"], current_price_eur: 2.5, discount_label: "Rewards Price Only €2.50. Activate coupon before paying.",
  });
  const lookalike = { ...member, id: "other", product_name: "Other Peppers", campaign_names: [] };
  const matches = searchSyncedWeeklyOffersInRows([member, lookalike], "Super Stars produce offers");
  assert.deepEqual(matches.map((match) => match.productName), ["Selected Peppers"]);
  assert.equal(matches[0]?.currentPriceEur, 2.5);
  assert.match(matches[0]?.quoteText ?? "", /two euro fifty/);
  assert.match(matches[0]?.quoteText ?? "", /Activate coupon before paying/);
  assert.deepEqual(searchSyncedWeeklyOffersInRows([member], "Super 7 offers"), []);
});

it("retains conditions following an Only price instead of discarding them as price repetition", () => {
  const quote = formatWeeklyOfferQuote({ productName: "Selected Apples", serviceArea: "produce", fulfilment: "prepack", currentPriceEur: 1.5, wasPriceEur: 2,
    discountLabel: "Only €1.50. Selected 500g packs. Activate coupon before paying.",
  });
  assert.match(quote, /Selected 500g packs/);
  assert.match(quote, /Activate coupon before paying/);
  assert.match(quote, /Now one euro fifty/);
});

it("does not treat a shared Super Stars page as Super Fresh 5 SKU eligibility", () => {
  const shared = mockOfferRow({ id: "other-widget", product_name: "Other Widget Produce", search_text: "other widget produce", department: "Produce", service_area: "produce", fulfilment: "prepack",
    current_price_eur: 1, discount_label: "Only €1", source_url: "https://supervalu.ie/super-stars-fruit-veg", campaign_names: ["Super Stars Fruit & Veg2"],
  });
  const verified = { ...shared, id: "fresh-five", product_name: "Fresh Five Carrots", campaign_names: ["Super Fresh 5 F&V - WK39"] };
  const pageOnly = { ...shared, id: "page-only", campaign_names: [] };
  const unverifiedLabel = { ...pageOnly, id: "unverified-label", discount_label: "Super Fresh 5 Only €1" };
  for (const query of ["Super Fresh 5", "Super Stars produce offers"]) {
    assert.deepEqual(searchSyncedWeeklyOffersInRows([shared, verified, pageOnly, unverifiedLabel], query).map((match) => match.productName), ["Fresh Five Carrots"]);
  }
  assert.deepEqual(searchSyncedWeeklyOffersInRows([shared, pageOnly], "Super Fresh 5"), []);
});

 it("keeps explicit each prices for counter products with comparison prices per kilogram", () => {
   const quote = formatWeeklyOfferQuote({ productName: "Marinated Pork Steak (600 g)", serviceArea: "butcher", fulfilment: "counter", currentPriceEur: 5, wasPriceEur: 8.49, sellBy: "each", priceUnitType: "each", pricePerUnit: "€8.33/kg" });
   assert.doesNotMatch(quote, /Now five euro per kilo/);
   assert.match(quote, /Now five euro\./);
 });

it("scopes dairy, baby and wine offer browses to their departments", () => {
  const rows = [
    ["wine", "Red Blend", "Australia", "Grocery/Wine, Beer & Spirits/Wine/Red Wine/Australia", "off_licence"],
    ["beer", "Lager", "Lager", "Grocery/Wine, Beer & Spirits/Beer/Lager", "off_licence"],
    ["baby", "Nappies", "Size 1", "Grocery/Baby/Nappies/Size 1", "grocery"],
    ["potato", "Baby Potatoes", "Butcher", "Grocery/Meat/Butcher", "butcher"],
    ["dairy", "Yogurt", "Yogurt", "Grocery/Dairy/Yogurt", "dairy"],
  ].map(([id, product_name, department, category_breadcrumb, service_area]) => mockOfferRow({id, product_name, department, category_breadcrumb, service_area: service_area as RetailWeeklyOfferRow["service_area"], fulfilment: "prepack", offer_channel: "grocery", is_alcohol: service_area === "off_licence", current_price_eur: 2, discount_label: "Only €2", search_text: product_name}));
  for (const department of ["wine", "baby", "dairy"]) {
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows, `${department} offers`).map(x => x.productName), [rows.find(x => x.id === department)!.product_name]);
  }
});

it("retrieves a specific offer rather than substituting ingredient departments or broad samples", () => {
  const names=["Kinetica Strawberry Protein Milkshake (330 ml)","Tayto Occassions Cheese & Onion (125 g)","Dreamies with Salmon Cat Treats (60 g)","Cadbury Dairy Milk Mint Crisp Chocolate Bar (54 g)"];
  const rows=names.map((name,index)=>mockOfferRow({id:String(index),product_name:name,search_text:name.toLowerCase(),department:"Grocery",service_area:"grocery",fulfilment:"prepack",current_price_eur:2.5,discount_label:"Rewards Price Only €2.50"}));
  for (const [index,name] of names.entries()) {
    assert.equal(inferWeeklyOfferServiceAreaFromQuery(name),null);
    for(const query of [`Any offers on ${name}?`,`${name} Rewards Price`]) {
      const matches=searchSyncedWeeklyOffersInRows(rows,query);
      assert.equal(matches[0]?.id,String(index),query);
      assert.equal(matches[0]?.discountLabel,"Rewards Price Only €2.50");
    }
  }
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,`Any offers on ${names[0]}?`,{serviceArea:"fish"}),[]);
});
it("recomputes Dublin offer dates when a reused reference date changes",()=>{
  const row={offer_week_start:"2026-10-01",offer_week_end:"2026-10-07"};
  const reference=new Date("2026-09-30T22:59:59Z");
  assert.equal(isRetailOfferWeekActive(row,reference),false);
  reference.setTime(Date.parse("2026-09-30T23:00:00Z"));
  assert.equal(isRetailOfferWeekActive(row,reference),true);
});

it("does not turn a product pack count into a Rewards price-only browse",()=>{
 assert.equal(inferRewardsPricePointFromQuery("Kinetica Strawberry Protein Milkshake (330 ml) Rewards Price"),null);
 assert.equal(inferRewardsPricePointFromQuery("Kinetica Strawberry Protein Milkshake (330 ml) Rewards Price Only €2.50"),null);
 assert.equal(inferRewardsPricePointFromQuery("Rewards Price for €2.50"),2.5);
});

describe('customer promotion questions and literal pack identities', () => {
  const make = (id: string, name: string, label: string) => mockOfferRow({id,product_name:name,search_text:`${name} ${label}`.toLowerCase(),department:'Food Cupboard',service_area:'grocery',fulfilment:'prepack',offer_channel:'grocery',discount_label:label,current_price_eur:4});
  it('retains the requested bottle size when punctuation or ampersands change', () => {
    const rows=[make('small','Heinz Tomato Ketchup 50% Less Sugar & Salt (400 ml)','2 for €6'),make('large','Heinz Tomato Ketchup 50% Less Sugar & Salt (800 ml)','Rewards Price')];
    for(const query of ['Heinz Tomato Ketchup 50% Less Sugar & Salt 800 ml','Heinz Tomato Ketchup 50% Less Sugar and Salt 800ml']) {
      assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,query).map(r=>r.id),['large']);
    }
  });
  it('checks either promotion type instead of requiring both words to match a product', () => {
    const rows=[make('prunes','Forest Feast Orchard Prunes (200 g)','Rewards Price'),make('bars','Kind Caramel Almond & Sea Salt Bar (40 g)','2 for €4')];
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,'Forest Feast Orchard Prunes 200 g multibuy or reduced price').map(r=>r.id),['prunes']);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,'Kind Caramel Almond & Sea Salt Bar 40g multibuy reduced price').map(r=>r.id),['bars']);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,'only multibuy Forest Feast Orchard Prunes 200g').map(r=>r.id),[]);
  });
  it('does not conflate decimal sizes or plus variants', () => {
    const rows=[make('decimal','Test Bottle (1.5 L)','Only €4'),make('whole','Test Bottle (15 L)','Only €4'),make('plus','Test Nappies Size 4+ (66 Piece)','Only €4'),make('normal','Test Nappies Size 4 (66 Piece)','Only €4')];
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,'Test Bottle 1.5L').map(r=>r.id),['decimal']);
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,'Test Nappies Size 4+ 66 Piece').map(r=>r.id),['plus']);
  });
});


describe("customer cooking and browse edge cases", () => {
  it("finds raw chicken for a barbecue without choosing cooked deli flavour names", () => {
    const rows = [
      mockOfferRow({product_name:"Carroll's Roast Smokey Barbeque Chicken Pieces (100 g)",department:"Poultry",category_breadcrumb:"Grocery/Chilled Food/Sliced Cooked Meats/Poultry",service_area:"deli",fulfilment:"prepack",current_price_eur:3.29,discount_label:"2 for €5.50",search_text:"carroll roast smokey barbeque chicken pieces"}),
      mockOfferRow({product_name:"SuperValu Fresh Irish Chicken Fillets (1 kg)",department:"Chicken",category_breadcrumb:"Grocery/Meat & Poultry/Chicken/Pre-pack",service_area:"butcher",fulfilment:"prepack",current_price_eur:9.99,discount_label:"Rewards Price Only €9.99",search_text:"supervalu fresh irish chicken fillets"}),
    ];
    assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"chicken for the barbecue, prepacked").map(x=>x.productName),["SuperValu Fresh Irish Chicken Fillets (1 kg)"]);
    assert.equal(searchSyncedWeeklyOffersInRows(rows,"Carroll's Roast Smokey Barbeque Chicken Pieces (100 g)")[0]?.productName,rows[0]!.product_name);
  });

  it("keeps cross-department presentation wording out of promotion product constraints", () => {
    const rows = [
      mockOfferRow({product_name:"Chicken burgers",current_price_eur:3.99,discount_label:"3 for €10",search_text:"chicken burgers"}),
      mockOfferRow({product_name:"Fruit packs",current_price_eur:4,discount_label:"3 for €10",search_text:"fruit packs",service_area:"produce"}),
    ];
    assert.equal(searchSyncedWeeklyOffersInRows(rows,"3 for 10 offers across different departments examples").length,2);
    assert.equal(searchSyncedWeeklyOffersInRows(rows,"multibuys across different departments examples").length,2);
  });

  it("serves date-checked offers during a transient refresh stall and refuses an old snapshot", async () => {
    const clock=Date.now;let now=clock();let reads=0;let fail=false;
    const row=mockOfferRow({product_name:"Live offer",current_price_eur:2,discount_label:"Only €2"});
    const client={supabaseUrl:"https://cache-regression.invalid",from:()=>{reads++;if(fail)throw Error("temporary outage");return mockSupabaseRows([row]).from();}};
    Date.now=()=>now;
    try {
      const [a,b]=await Promise.all([loadRetailWeeklyOffersForBanner(client as never,"supervalu"),loadRetailWeeklyOffersForBanner(client as never,"supervalu")]);
      assert.equal(reads,1);assert.equal(a.length,1);assert.equal(b.length,1);
      a.length=0;assert.equal((await loadRetailWeeklyOffersForBanner(client as never,"supervalu")).length,1);
      now+=60001;fail=true;
      assert.equal((await loadRetailWeeklyOffersForBanner(client as never,"supervalu"))[0]?.product_name,"Live offer");
      await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,2);
      now+=300001;await assert.rejects(loadRetailWeeklyOffersForBanner(client as never,"supervalu"),/temporary outage/);
      fail=false;assert.equal((await loadRetailWeeklyOffersForBanner(client as never,"supervalu")).length,1);
    } finally {Date.now=clock;}
  });
});


it("corrects stale per-kilo source rates for an unambiguous offer pack", () => {
  const quote=formatWeeklyOfferQuote({productName:"SuperValu Washed Rooster Potatoes Carry Pack (5 kg)",currentPriceEur:6.99,pricePerUnit:"€1.60/kg",fulfilment:"prepack",serviceArea:"produce",discountLabel:"Rewards Price Only €6.99"});
  assert.match(quote,/one euro forty per kilo/i);assert.doesNotMatch(quote,/one euro sixty per kilo/i);
  const counter=formatWeeklyOfferQuote({productName:"Ham (1 kg)",currentPriceEur:22,pricePerUnit:"€22/kg",fulfilment:"counter",serviceArea:"deli"});
  assert.match(counter,/twenty two euro per kilo/i);
  const multipack=formatWeeklyOfferQuote({productName:"Tuna 4 Pack (145 g)",currentPriceEur:4.5,pricePerUnit:"€7.76/kg",fulfilment:"prepack"});
  assert.match(multipack,/seven euro seventy six per kilo/i);
});


it("keeps the caller's nappy size across generic queries and never substitutes another size", () => {
  const rows=[
    mockOfferRow({product_name:"Pampers Premium Protection Essential Pack Size 2 (44 Piece)",category_breadcrumb:"Grocery/Baby/Baby Nappies & Pants/Size 2",service_area:"grocery",fulfilment:"prepack",department:"Size 2",current_price_eur:8,discount_label:"Rewards Price Only €8",search_text:"pampers premium protection baby nappies size 2"}),
    mockOfferRow({product_name:"Pampers Baby Dry Jumbo Pack Size 4+ (66 Piece)",category_breadcrumb:"Grocery/Baby/Baby Nappies & Pants/Size 4+",service_area:"grocery",fulfilment:"prepack",department:"Size 4+",current_price_eur:16.5,discount_label:"2 for €28",search_text:"pampers baby dry nappies size 4+"}),
  ];
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"baby nappies size 2").map(x=>x.productName),[rows[0]!.product_name]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"baby nappies size two").map(x=>x.productName),[rows[0]!.product_name]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"nappies size four plus").map(x=>x.productName),[rows[1]!.product_name]);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"nappies size 4+ offers").map(x=>x.productName),[rows[1]!.product_name]);
  assert.equal(searchSyncedWeeklyOffersInRows(rows,"nappies size 3 offers").length,0);
});


it("keeps a misspelled named product with multiple ingredients out of department browsing", () => {
  const rows=[mockOfferRow({product_name:"Charleville Spreadable Cheese with Ham (125 g)",current_price_eur:1.75,discount_label:"Rewards Price Only €1.75",search_text:"charleville spreadable cheese with ham 125g"}),mockOfferRow({product_name:"Unrelated cheese",current_price_eur:2,discount_label:"Only €2",search_text:"unrelated cheese"})];
  assert.equal(inferWeeklyOffersListIntent("Charlevile Spreadable Cheese with Ham 125 g"),false);
  assert.deepEqual(searchSyncedWeeklyOffersInRows(rows,"Charlevile Spreadable Cheese with Ham 125 g").map(x=>x.productName),[rows[0]!.product_name]);
});


it("conflicting advertised bundle weight does not confirm this pack qualifies",()=>{
  const quote=formatWeeklyOfferQuote({productName:"SuperValu Semi Sundried Tomatoes (120 g)",currentPriceEur:2.5,discountLabel:"3 for €6 Spanish Omelette Range 200g",fulfilment:"prepack"});
  assert.match(quote,/Eligibility for this exact pack is not verified/);
  assert.match(quote,/single price two euro fifty/);
});


it("loads every offer across overlapping pages without returning a partial catalogue", async () => {
  const rows = Array.from({length: 3394}, (_, i) => mockOfferRow({id: String(i), product_name: `Offer ${i}`, search_text: `offer ${i}`, current_price_eur: 2, discount_label: "Only €2"}));
  let active = 0, peak = 0;
  const db = {from() {
    const query = mockSupabaseRows(rows).from().select().eq();
    const range = query.range.bind(query);
    query.range = async (from: number, to: number) => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 15));
      try { return await range(from, to); } finally {active--;}
    };
    return {select: () => query};
  }};
  const loaded = await loadRetailWeeklyOffersForBanner(db as never, "supervalu");
  assert.equal(loaded.length, rows.length);
  assert.equal(new Set(loaded.map(row => row.id)).size, rows.length);
  assert.equal(loaded.at(-1)?.id, "3393");
  assert.ok(peak > 1 && peak <= 3);
  assert.equal(active, 0);
});


it("accepts both ends of a promotion's shared-unit weight range without accepting outside packs",()=>{
 for(const grams of [150,160,180]){
  const quote=formatWeeklyOfferQuote({productName:`Macroom Buffalo Buratta (${grams} g)`,currentPriceEur:4.75,discountLabel:'2 for €8 Macroom Buffalo Range 150-180g',fulfilment:'prepack'});
  assert.match(quote,/two for eight euro/i);
  assert.doesNotMatch(quote,/Eligibility for this exact pack is not verified/);
 }
 for(const grams of [149,181])assert.match(formatWeeklyOfferQuote({productName:`Macroom Buffalo Buratta (${grams} g)`,currentPriceEur:4.75,discountLabel:'2 for €8 Macroom Buffalo Range 150-180g',fulfilment:'prepack'}),/Eligibility for this exact pack is not verified/);
});
