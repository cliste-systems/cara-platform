import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseRetailPromotionQuery,
  shouldUseStructuredPromotionSearch,
  searchStructuredNationalPromotions,
} from "@/lib/retail-promotion-search";

describe("retail promotion query parsing", () => {
  it("parses the failed 3-for-10 produce call as a multibuy browse", () => {
    const parsed = parseRetailPromotionQuery(
      "what are the 3 for €10 offers in the fruit and veg?",
    );

    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.quantity, 3);
    assert.equal(parsed.totalEur, 10);
    assert.equal(parsed.serviceArea, "produce");
    assert.deepEqual(parsed.subjectTokens, []);
    assert.equal(shouldUseStructuredPromotionSearch(
      "what are the 3 for €10 offers in the fruit and veg?",
    ), true);
  });

  it("supports spoken-number multibuy wording", () => {
    const parsed = parseRetailPromotionQuery(
      "which berries are three for ten euro this week?",
    );

    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.quantity, 3);
    assert.equal(parsed.totalEur, 10);
    assert.deepEqual(parsed.subjectTokens, ["berries"]);
  });

  it("keeps Real Rewards as an independent promotion constraint", () => {
    const parsed = parseRetailPromotionQuery(
      "any Real Rewards offers on cereal?",
    );

    assert.equal(parsed.mechanic, "loyalty");
    assert.equal(parsed.loyaltyRequired, true);
    assert.deepEqual(parsed.subjectTokens, ["cereal"]);
  });

  it("captures explicit Rewards Price amounts with or without Only", () => {
    const withOnly = parseRetailPromotionQuery(
      "what is on Rewards Price Only €2.50?",
    );
    assert.equal(withOnly.mechanic, "fixed_price");
    assert.equal(withOnly.loyaltyRequired, true);
    assert.equal(withOnly.amountEur, 2.5);

    const withoutOnly = parseRetailPromotionQuery(
      "what has a Rewards Price of two euro fifty?",
    );
    assert.equal(withoutOnly.mechanic, "loyalty");
    assert.equal(withoutOnly.loyaltyRequired, true);
    assert.equal(withoutOnly.amountEur, 2.5);
  });

  it("supports Rewards multibuys without collapsing them to a unit price", () => {
    const parsed = parseRetailPromotionQuery(
      "what is on 3 for €5 with Rewards?",
    );

    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.loyaltyRequired, true);
    assert.equal(parsed.quantity, 3);
    assert.equal(parsed.totalEur, 5);
  });

  it("normalizes natural Irish promotion phrasing before matching", () => {
    const tenner = parseRetailPromotionQuery(
      "what fruit is three for a tenner?",
    );
    assert.equal(tenner.mechanic, "multibuy");
    assert.equal(tenner.quantity, 3);
    assert.equal(tenner.totalEur, 10);
    assert.equal(tenner.serviceArea, "produce");

    const fiver = parseRetailPromotionQuery("anything two for a fiver?");
    assert.equal(fiver.quantity, 2);
    assert.equal(fiver.totalEur, 5);

    const quid = parseRetailPromotionQuery("what is two for six quid?");
    assert.equal(quid.quantity, 2);
    assert.equal(quid.totalEur, 6);

    const cents = parseRetailPromotionQuery("anything save fifty cent?");
    assert.equal(cents.mechanic, "save_amount");
    assert.equal(cents.amountEur, 0.5);

    const percent = parseRetailPromotionQuery("anything save thirty three percent?");
    assert.equal(percent.mechanic, "save_percent");
    assert.equal(percent.percent, 33);
  });

  it("supports percentage, money-off, half-price, fixed-price and cents mechanics", () => {
    assert.equal(
      parseRetailPromotionQuery("what is half price this week?").mechanic,
      "half_price",
    );
    assert.equal(
      parseRetailPromotionQuery("anything save 20% in household?").percent,
      20,
    );
    assert.equal(
      parseRetailPromotionQuery("what has save €2 on it?").amountEur,
      2,
    );
    assert.equal(
      parseRetailPromotionQuery("anything save 50c?").amountEur,
      0.5,
    );
    assert.equal(
      parseRetailPromotionQuery("anything only 79c in fruit?").amountEur,
      0.79,
    );
    assert.equal(
      parseRetailPromotionQuery("anything only €3 in frozen?").amountEur,
      3,
    );
  });

  it("accepts retailer badges that omit the euro symbol in multibuy wording", () => {
    const parsed = parseRetailPromotionQuery("what is 2 for 2.70 on?");
    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.quantity, 2);
    assert.equal(parsed.totalEur, 2.7);
  });

  it("treats named campaigns as data lookups rather than invented answers", () => {
    const parsed = parseRetailPromotionQuery("what are the Super 7 offers?");
    assert.equal(parsed.mechanic, "named");
    assert.equal(parsed.namedPhrase, "super 7");
  });

  it("leaves ordinary product offer questions on the normal product path", () => {
    assert.equal(shouldUseStructuredPromotionSearch("is sirloin on offer?"), false);
  });
});

it("recognises non-price bundles without treating mechanic words as a product", () => {
  for (const query of ["BOGOF offers", "buy-one-get-one-free offers", "mix and match offers", "multibuy offers"]) {
    const parsed = parseRetailPromotionQuery(query);
    assert.equal(parsed.mechanic, "multibuy", query);
    assert.deepEqual(parsed.subjectTokens, [], query);
    assert.equal(parsed.amountEur, null, query);
  }
  const points = parseRetailPromotionQuery("Real Rewards points offers");
  assert.equal(points.mechanic, "named");
  assert.equal(points.namedPhrase, "points");
  assert.equal(points.amountEur, null);
});

it("recognises Super Fresh 5 and Super Stars aliases as a campaign distinct from Super 7", () => {
  for (const query of ["Super Fresh 5 offers", "SuperFresh5", "Super Fresh five", "Super Stars fruit and veg offers", "SuperStars produce offers"]) {
    const parsed = parseRetailPromotionQuery(query);
    assert.equal(parsed.mechanic, "named", query);
    assert.equal(parsed.namedPhrase, "super fresh 5", query);
    assert.deepEqual(parsed.subjectTokens, [], query);
  }
  assert.equal(parseRetailPromotionQuery("Super 7").namedPhrase, "super 7");
});

it("keeps fresh RPC campaign membership and full source offer conditions", async () => {
  const reference = new Date("2026-09-27T12:00:00Z");
  const makeRow = (name: string, description: string, campaign: string) => ({
    product_name: name, department: "Fruit", service_area: "produce", fulfilment: "prepack", sku: name,
    is_alcohol: false, promotion_type: "multibuy", loyalty_required: false,
    label: "3 for €10", description, offer_price_eur: null, regular_price_eur: null, display_price_eur: null,
    price_per_unit: null, source_store_count: 3, valid_from: "2026-09-24", valid_to: "2026-09-30",
    source_metadata: { source_observed_at: "2026-09-27T11:00:00Z", campaigns: [{ name: campaign, source_url: "https://supervalu.ie/super-stars-fruit-veg" }] },
  });
  const selected = makeRow("Selected Berries", "Selected 500g packs. Activate coupon before paying. Limit per product 4.", "Super Fresh 5");
  const other = { ...makeRow("Other Apples", "Super 7", "Super 7"), source_metadata: { source_observed_at: "2026-09-27T11:00:00Z", campaigns: [{ name: "Super 7", source_url: "https://example.test/super-7" }] } };
  const siblingWidget = makeRow("Other Widget Produce", "Selected produce on the same page", "Super Stars Fruit & Veg2");
  const client = { async rpc(_name: string, args: Record<string, unknown>) {
    assert.equal(args.p_named_phrase, "super fresh 5", "campaign selection must happen before the database result limit");
    return { data: [selected, other, siblingWidget], error: null };
  } };
  const matches = await searchStructuredNationalPromotions(client as never, { retailBanner: "supervalu", query: "Super Stars offers", reference });
  assert.deepEqual(matches.map((row) => row.productName), ["Selected Berries"]);
  assert.match(matches[0]?.quoteText ?? "", /three for ten euro/i);
  assert.match(matches[0]?.quoteText ?? "", /Selected 500g packs/);
  assert.match(matches[0]?.quoteText ?? "", /Activate coupon before paying/);
  assert.match(matches[0]?.quoteText ?? "", /Limit per product 4/);
});
