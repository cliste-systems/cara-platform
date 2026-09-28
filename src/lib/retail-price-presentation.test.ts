import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compactRetailOfferLabel,
  inferPromotionTypeFromLabel,
  resolveNationalRetailPrice,
  resolveStoredRetailPrice,
} from "./retail-price-presentation";

describe("retail price presentation", () => {
  it("shows current, previous and savings for a percentage offer", () => {
    const price = resolveNationalRetailPrice({
      regularPriceEur: 9.29,
      weeklyOffer: {
        current_price_eur: 7.43,
        was_price_eur: 9.29,
        discount_label: "Save 20%",
        price_per_unit: "€37.15/kg",
      },
    });

    assert.equal(price.currentPriceEur, 7.43);
    assert.equal(price.regularPriceEur, 9.29);
    assert.equal(price.savingsEur, 1.86);
    assert.equal(Math.round(price.savingsPercent ?? 0), 20);
    assert.equal(price.promotionType, "percentage");
    assert.equal(price.pricePerUnit, "€37.15/kg");
  });

  it("detects Real Rewards price mechanics", () => {
    const price = resolveNationalRetailPrice({
      regularPriceEur: 3.19,
      weeklyOffer: {
        current_price_eur: 2.5,
        was_price_eur: 3.19,
        discount_label: "Rewards Price Only €2.50",
        price_per_unit: null,
      },
    });

    assert.equal(price.loyaltyRequired, true);
    assert.equal(price.loyaltyProgram, "Real Rewards");
    assert.equal(price.promotionType, "loyalty");
  });

  it("renders multibuy totals without pretending the total is a unit price", () => {
    const price = resolveNationalRetailPrice({
      regularPriceEur: 1.75,
      weeklyOffer: {
        current_price_eur: 1.75,
        was_price_eur: null,
        discount_label: "2 FOR 3.00 MALTESERS REINDEER/M&MS CRISPY",
        price_per_unit: "€60.34/kg",
      },
    });

    assert.equal(price.isMultibuy, true);
    assert.equal(price.multibuyQuantity, 2);
    assert.equal(price.multibuyTotalEur, 3);
    assert.equal(price.multibuySavingEur, 0.5);
    assert.equal(
      compactRetailOfferLabel(price.offerLabel),
      "2 for €3.00",
    );
  });

  it("uses active loyalty promotion for store-specific pricing", () => {
    const price = resolveStoredRetailPrice(
      {
        regular_price_eur: 4,
        display_price_eur: 4,
        price_per_unit: "€8.00/kg",
        source_price_label: null,
        retail_promotions: [
          {
            promotion_type: "standard_offer",
            loyalty_required: false,
            loyalty_program: null,
            offer_price_eur: 3.5,
            regular_price_eur: 4,
            label: "Only €3.50",
            synced_at: "2026-09-22T10:00:00Z",
            valid_from: "2026-09-17",
            valid_to: "2026-09-23",
          },
          {
            promotion_type: "loyalty",
            loyalty_required: true,
            loyalty_program: "Real Rewards",
            offer_price_eur: 3,
            regular_price_eur: 4,
            label: "Rewards Price €3",
            synced_at: "2026-09-22T10:00:00Z",
            valid_from: "2026-09-17",
            valid_to: "2026-09-23",
          },
        ],
      },
      new Date("2026-09-22T12:00:00Z"),
    );

    assert.equal(price.currentPriceEur, 3);
    assert.equal(price.loyaltyRequired, true);
    assert.equal(price.loyaltyProgram, "Real Rewards");
  });

  it("recognises common offer labels", () => {
    assert.equal(inferPromotionTypeFromLabel("3 for €10"), "multibuy");
    assert.equal(inferPromotionTypeFromLabel("Half Price"), "half_price");
    assert.equal(inferPromotionTypeFromLabel("Save €2"), "money_off");
  });
});

it("removes an expired offer label and returns the regular price", () => {
  const price = resolveStoredRetailPrice({
    regular_price_eur: 6, display_price_eur: 4, price_per_unit: null,
    source_price_label: "Rewards Price Only €4",
    retail_promotions: [{ promotion_type: "loyalty", loyalty_required: true, loyalty_program: "Real Rewards", offer_price_eur: 4, regular_price_eur: 6, label: "Rewards Price Only €4", valid_from: "2026-09-17", valid_to: "2026-09-23" }],
  }, new Date("2026-09-23T23:00:00Z"));
  assert.equal(price.currentPriceEur, 6);
  assert.equal(price.isOnOffer, false);
  assert.equal(price.offerLabel, null);
  assert.equal(price.loyaltyRequired, false);
});

it("presents non-price bundle terms without manufacturing totals or savings", () => {
  for (const label of ["BOGOF", "Buy One Get One Free", "Mix & Match"]) {
    const price = resolveNationalRetailPrice({ regularPriceEur: null, weeklyOffer: { current_price_eur: null, was_price_eur: null, discount_label: label, price_per_unit: null } });
    assert.equal(price.isMultibuy, true, label);
    assert.equal(price.currentPriceEur, null);
    assert.equal(price.multibuyTotalEur, null);
    assert.equal(price.savingsEur, null);
    assert.equal(price.offerLabel, label);
  }
});
