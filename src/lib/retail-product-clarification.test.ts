import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBroadProductClarificationHint,
  buildOfferFulfilmentClarificationHint,
  buildProductClarificationHint,
  filterOfferMatchesByExplicitFulfilment,
  isBroadProductQuery,
  resolveProductSearchResponse,
} from "./retail-product-clarification";

describe("retail product clarification", () => {
  it("returns multiple matching offers without asking for another brand clarification", () => {
    const response = resolveProductSearchResponse(
      "Kelloggs",
      [
        {
          product_name: "Kellogg's Corn Flakes (450 g)",
          department: "Cereals",
          service_area: "grocery",
          fulfilment: "prepack",
        },
        {
          product_name: "Kellogg's Rice Krispies (430 g)",
          department: "Family Cereals",
          service_area: "grocery",
          fulfilment: "prepack",
        },
      ],
      { intent: "offer" },
    );
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 2);
  });


  it("does not ask for a brand when the query is the department itself", () => {
    const response = resolveProductSearchResponse("cereals", [
      {
        product_name: "Kellogg's Corn Flakes (450 g)",
        department: "Cereals",
        service_area: "grocery",
        fulfilment: "prepack",
      },
      {
        product_name: "Weetabix 24 Pack (430 g)",
        department: "Cereals",
        service_area: "grocery",
        fulfilment: "prepack",
      },
    ]);
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 2);
  });


  it("treats single-word category queries as broad", () => {
    assert.equal(isBroadProductQuery("mushrooms"), true);
    assert.equal(isBroadProductQuery("weekly offers"), true);
    assert.equal(isBroadProductQuery("Carrolls crumbed ham"), false);
  });

  it("asks counter vs pre-pack before quoting mixed offer matches", () => {
    const hint = buildOfferFulfilmentClarificationHint([
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /fresh at the fish counter/i);
    assert.match(hint ?? "", /pre-pack packs in the fish aisle/i);
    assert.match(hint ?? "", /Do not quote any prices/i);
  });

  it("prefers fulfilment clarification over brand clarification", () => {
    const hint = buildProductClarificationHint("salmon on offer", [
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
      {
        product_name: "Keohane's Salmon Fillets (480 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /fresh at the/i);
    assert.match(hint ?? "", /pre-pack/i);
  });

  it("answers the explicitly requested meat counter directly and excludes prepack", () => {
    const response = resolveProductSearchResponse(
      "what's on offer in the meat counter this week",
      [
        {
          product_name: "Denny Luncheon Roll (90 g)",
          service_area: "butcher",
          fulfilment: "prepack",
        },
        {
          product_name: "SuperValu Fresh Irish Pork Steak (1 kg)",
          service_area: "butcher",
          fulfilment: "counter",
        },
      ],
    );
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.equal(response.matches[0]?.fulfilment, "counter");
  });

  it("narrows to counter only when fulfilment was chosen explicitly", () => {
    const matches = [
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
        quote_text: "At the fish counter this week — fifteen euro ninety nine per kilo",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
        quote_text: "In the pre-pack fish aisle this week — four euro forty nine",
      },
    ];
    const response = resolveProductSearchResponse(
      "salmon on offer",
      matches,
      { fulfilment: "counter" },
    );
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.equal(response.matches[0]?.fulfilment, "counter");
    assert.match(response.matches[0]?.quote_text ?? "", /per kilo/i);
  });

  it("narrows to counter matches when fulfilment is explicit", () => {
    const filtered = filterOfferMatchesByExplicitFulfilment(
      [
      {
        product_name: "Loose Side of Salmon (700 g)",
        fulfilment: "counter",
      },
      {
        product_name: "Keohane's Salmon Fillets (480 g)",
        fulfilment: "prepack",
      },
    ],
      "counter",
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.fulfilment, "counter");
  });

  it("builds a clarify-first hint for diverse mushroom matches", () => {
    const hint = buildBroadProductClarificationHint("mushrooms", [
      { productName: "SuperValu Chestnut Mushrooms (200 g)" },
      { productName: "SuperValu Irish Baby Button Mushrooms (150 g)" },
      { productName: "Merlini Dried Porcini Mushrooms (20 g)" },
      { productName: "SuperValu Breaded Garlic Mushrooms (320 g)" },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /clarifying question/i);
    assert.match(hint ?? "", /Chestnut|Button|Porcini/i);
    assert.doesNotMatch(hint ?? "", /€/);
  });

  it("does not clarify counter vs pre-pack across different service areas", () => {
    const hint = buildOfferFulfilmentClarificationHint([
      {
        product_name: "Horgans Sliced Corned Beef (120 g)",
        service_area: "deli",
        fulfilment: "prepack",
      },
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
      },
    ]);
    assert.equal(hint, null);
  });

  it("returns Horgans corned beef without blocking clarification", () => {
    const response = resolveProductSearchResponse("corned beef", [
      {
        product_name: "Horgans Sliced Corned Beef (120 g)",
        service_area: "deli",
        fulfilment: "prepack",
        quote_text: "At the deli counter this week — Horgans Sliced Corned Beef (120 g) is on offer this week at three euro",
      },
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
        quote_text: "At the butcher counter this week — sirloin",
      },
    ]);
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /Horgans/i);
  });

  it("keeps the intended fillet steak after a one-character STT slip", () => {
    const response = resolveProductSearchResponse("filled steak", [
      {
        product_name: "SuperValu Signature Tastes Hereford Irish Fillet Steak (370 g)",
        service_area: "butcher",
        fulfilment: "prepack",
        quote_text: "fillet",
      },
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
        quote_text: "sirloin",
      },
    ]);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /Fillet Steak/i);
  });

  it("does not clarify specific brand queries", () => {
    const hint = buildBroadProductClarificationHint("greenfarm turkey slices", [
      { productName: "Green Farm Delicatessen Roasted & Carved Turkey Slices (120 g)" },
      { productName: "Green Farm Roast Turkey Breast Slices (90 g)" },
    ]);
    assert.equal(hint, null);
  });

  it("keeps steak offer matches when broad clarification is needed", () => {
    const response = resolveProductSearchResponse("steaks", [
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
        quote_text: "At the butcher counter this week — sirloin steak",
      },
      {
        product_name: "SuperValu Signature Tastes Hereford Beef Irish Striploin Steak (450 g)",
        service_area: "butcher",
        fulfilment: "prepack",
        quote_text: "In the pre-pack meat aisle this week — striploin steak",
      },
      {
        product_name: "SuperValu Salt & Chilli Beef Quick Fry Steaks (380 g)",
        service_area: "butcher",
        fulfilment: "prepack",
        quote_text: "In the pre-pack meat aisle this week — quick fry steaks",
      },
    ]);
    assert.ok(response.clarificationHint);
    assert.equal(response.matches.length, 3);
    assert.match(response.matches[0]?.product_name ?? "", /Sirloin/i);
    assert.match(response.clarificationHint ?? "", /butcher counter/i);
    assert.match(response.clarificationHint ?? "", /pre-pack/i);
  });

  it("asks counter vs pre-pack for broad deli ham offers", () => {
    const response = resolveProductSearchResponse("ham on offer", [
      {
        product_name: "SuperValu Traditional Cooked Ham (1 kg)",
        service_area: "deli",
        fulfilment: "counter",
        quote_text: "At the deli counter this week — cooked ham per kilo",
      },
      {
        product_name: "Horgans Sliced Cooked Ham (120 g)",
        service_area: "deli",
        fulfilment: "prepack",
        quote_text: "In the chilled pre-pack deli this week — sliced ham",
      },
    ]);
    assert.ok(response.clarificationHint);
    assert.match(response.clarificationHint ?? "", /deli counter/i);
    assert.match(response.clarificationHint ?? "", /pre-pack/i);
    assert.equal(response.matches.length, 2);
  });

  it("asks counter vs pre-pack for broad fish offers", () => {
    const hint = buildOfferFulfilmentClarificationHint([
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /fish counter/i);
  });

  it("clarifies broad ambient grocery offers by product type", () => {
    const hint = buildBroadProductClarificationHint("biscuits", [
      { productName: "McVitie's Hobnobs Milk Chocolate Biscuits (262 g)" },
      { productName: "McVitie's Rich Tea Biscuits (300 g)" },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /clarifying question/i);
  });

  it("does not clarify unrelated butcher counter items for a sirloin query", () => {
    const response = resolveProductSearchResponse(
      "sirloin",
      [
        {
          product_name: "SuperValu Fresh Irish Pork Steak (1 kg)",
          service_area: "butcher",
          fulfilment: "counter",
        },
        {
          product_name: "SuperValu Fresh Irish Beef Eye of Round (1 kg)",
          service_area: "butcher",
          fulfilment: "counter",
        },
      ],
      { fulfilment: "counter" },
    );
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 0);
  });

  it("answers broad alcohol offer callers with current products", () => {
    const response = resolveProductSearchResponse(
      "alcohol",
      [
        { product_name: "Sparkling Offer A", department: "Champagne & Sparkling", service_area: "off_licence", fulfilment: "prepack" },
        { product_name: "Red Wine Offer B", department: "Red Wine", service_area: "off_licence", fulfilment: "prepack" },
        { product_name: "Lager Offer C", department: "Lager", service_area: "off_licence", fulfilment: "prepack" },
        { product_name: "Gin Offer D", department: "Gin", service_area: "off_licence", fulfilment: "prepack" },
      ],
      { intent: "offer" },
    );
    assert.equal(response.clarificationKind, null);
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 4);
  });

  it("answers department offers without mandatory refinement", () => {
    const response = resolveProductSearchResponse(
      "toiletries",
      [
        { product_name: "Shampoo Offer A", department: "Hair Care", service_area: "grocery", fulfilment: "prepack" },
        { product_name: "Deodorant Offer B", department: "Deodorant", service_area: "grocery", fulfilment: "prepack" },
        { product_name: "Shower Gel Offer C", department: "Bath & Shower", service_area: "grocery", fulfilment: "prepack" },
      ],
      { intent: "offer" },
    );
    assert.equal(response.clarificationKind, null);
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 3);
  });

  it("never invents counter-vs-prepack clarification for produce", () => {
    const hint = buildOfferFulfilmentClarificationHint([
      { product_name: "Loose Avocado", service_area: "produce", fulfilment: "counter" },
      { product_name: "Avocado 2 Pack", service_area: "produce", fulfilment: "prepack" },
    ]);
    assert.equal(hint, null);
  });

  it("asks one refinement for a broad price question with several real category matches", () => {
    const response = resolveProductSearchResponse(
      "avocado",
      [
        { product_name: "SuperValu Ripe Avocado", department: "Avocados", service_area: "produce", fulfilment: "prepack" },
        { product_name: "SuperValu Organic Avocados", department: "Avocados", service_area: "produce", fulfilment: "prepack" },
        { product_name: "Donnelly Fresh Avocado Net", department: "Avocados", service_area: "produce", fulfilment: "prepack" },
      ],
      { intent: "price" },
    );
    assert.equal(response.clarificationKind, "refinement");
    assert.ok(response.clarificationHint);
  });


  it("resolves an explicit cheapest price request without another clarification", () => {
    const response = resolveProductSearchResponse(
      "cheapest SuperValu avocado",
      [
        {
          product_name: "SuperValu Signature Tastes Mini Hass Avocados",
          department: "Avocados",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 2.59,
        },
        {
          product_name: "SuperValu Signature Tastes Ripe & Ready Avocado",
          department: "Avocados",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 0.99,
        },
      ],
      { intent: "price" },
    );
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /Ripe & Ready/i);
  });

  it("keeps own-brand modifiers from wiping out the actual product matches", () => {
    const response = resolveProductSearchResponse(
      "fresh SuperValu brand avocado",
      [
        { product_name: "SuperValu Signature Tastes Ripe & Ready Avocado", department: "Avocados", service_area: "produce", fulfilment: "prepack" },
        { product_name: "SuperValu Organic Avocados", department: "Organic", service_area: "produce", fulfilment: "prepack" },
        { product_name: "SuperValu Signature Tastes Mini Hass Avocados", department: "Avocados", service_area: "produce", fulfilment: "prepack" },
      ],
      { intent: "price" },
    );
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 3);
  });


  it("prefers fresh own-brand cheapest food matches over ingredient-form noise", () => {
    const response = resolveProductSearchResponse(
      "avocado fresh supervalu brand cheapest",
      [
        {
          product_name: "Garnier Ultimate Blends Avocado Oil",
          department: "Hair Care",
          service_area: "grocery",
          fulfilment: "prepack",
          current_price_eur: 4.99,
          score: 0.9,
        },
        {
          product_name: "Biona Organic Avocado Oil",
          department: "Oils",
          service_area: "grocery",
          fulfilment: "prepack",
          current_price_eur: 8.49,
          score: 0.9,
        },
        {
          product_name: "Freshzilla Smashed Hass Avocado",
          department: "Fresh Prepared Fruit & Veg",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 2.89,
          score: 0.85,
        },
        {
          product_name: "SuperValu Fresh Avocados",
          department: "Fresh Fruit & Vegetables",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 1.49,
          score: 0.82,
        },
        {
          product_name: "SuperValu Fresh Avocado Twin Pack",
          department: "Fresh Fruit & Vegetables",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 2.49,
          score: 0.82,
        },
      ],
      { intent: "price" },
    );

    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /SuperValu Fresh Avocados/i);
    assert.doesNotMatch(response.matches[0]?.product_name ?? "", /Oil|Smashed/i);
  });

  it("applies the same fresh/cheapest ranking to another category", () => {
    const response = resolveProductSearchResponse(
      "tomatoes fresh supervalu cheapest",
      [
        {
          product_name: "SuperValu Tomato & Basil Pasta Sauce",
          department: "Pasta Sauce",
          service_area: "grocery",
          fulfilment: "prepack",
          current_price_eur: 1.19,
          score: 0.92,
        },
        {
          product_name: "SuperValu Fresh Tomatoes",
          department: "Fresh Fruit & Vegetables",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 1.79,
          score: 0.82,
        },
        {
          product_name: "SuperValu Fresh Cherry Tomatoes",
          department: "Fresh Fruit & Vegetables",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 2.49,
          score: 0.82,
        },
      ],
      { intent: "price" },
    );

    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /Fresh Tomatoes/i);
    assert.doesNotMatch(response.matches[0]?.product_name ?? "", /Sauce/i);
  });

  it("does not ask butcher counter clarification for non-counter grocery noise", () => {
    const response = resolveProductSearchResponse(
      "avocado fresh supervalu brand cheapest",
      [
        {
          product_name: "SuperValu Fresh Avocados",
          department: "Fresh Fruit & Vegetables",
          service_area: "produce",
          fulfilment: "prepack",
          current_price_eur: 1.49,
        },
        {
          product_name: "SuperValu Fresh Irish Pork Steak",
          department: "Butcher",
          service_area: "butcher",
          fulfilment: "counter",
          current_price_eur: 6.69,
        },
      ],
      { intent: "price" },
    );

    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /Avocados/i);
  });

});

it("never substitutes prepack when an explicit counter has no matching offers", () => {
  const response = resolveProductSearchResponse("meat counter offers", [
    { product_name: "Prepack steak", service_area: "butcher", fulfilment: "prepack" },
  ], { intent: "offer", fulfilment: "counter" });
  assert.deepEqual(response.matches, []);
  assert.equal(response.clarificationHint, null);
});

it("answers broad meat offers with both labelled fulfilments", () => {
  const matches = [
    { product_name: "Counter steak", service_area: "butcher", fulfilment: "counter" },
    { product_name: "Prepack chicken", service_area: "butcher", fulfilment: "prepack" },
    { product_name: "Counter pork", service_area: "butcher", fulfilment: "counter" },
  ];
  const response = resolveProductSearchResponse("are there any meat offers", matches, { intent: "offer" });
  assert.equal(response.clarificationHint, null);
  assert.deepEqual(response.matches, matches);
});
