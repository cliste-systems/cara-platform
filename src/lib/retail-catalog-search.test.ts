import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchNationalRetailCatalog } from "./retail-catalog-search";

function makeSupabaseRows(rows: unknown[]) {
  return {
    from() {
      let needle = "";
      return {
        select() { return this; },
        eq() { return this; },
        gte() { return this; },
        order() { return this; },
        ilike(_column: string, pattern: string) {
          needle = pattern.replace(/%/g, "").toLowerCase();
          return this;
        },
        async range(from: number, to: number) {
          return {
            data: rows.filter((row) => String((row as { search_text?: string }).search_text ?? "").toLowerCase().includes(needle)).slice(from, to + 1),
            error: null,
          };
        },
      };
    },
  };
}

describe("retail catalog search", () => {
  it("uses product words, not the SuperValu brand token, to retrieve own-label matches", async () => {
    const supabase = makeSupabaseRows([
      {
        id: "tea",
        sku: "tea",
        product_name: "SuperValu Gold Blend Tea",
        brand: "SuperValu",
        department: "Tea",
        service_area: "grocery",
        fulfilment: "prepack",
        is_alcohol: false,
        search_text: "supervalu gold blend tea",
        national_store_count: 12,
        national_regular_price_eur: 2.5,
      },
      {
        id: "olive",
        sku: "1687244000",
        product_name: "SuperValu Olive Oil (1 L)",
        brand: "SuperValu",
        department: "Olive Oil",
        service_area: "grocery",
        fulfilment: "prepack",
        is_alcohol: false,
        search_text: "supervalu olive oil 1l olive oil",
        national_store_count: 24,
        national_regular_price_eur: 5.49,
      },
      {
        id: "daily",
        sku: "1522521000",
        product_name: "Daily Basics Olive Oil (750 ml)",
        brand: "Daily Basics",
        department: "Olive Oil",
        service_area: "grocery",
        fulfilment: "prepack",
        is_alcohol: false,
        search_text: "daily basics olive oil 750ml olive oil",
        national_store_count: 24,
        national_regular_price_eur: 4.09,
      },
    ]);

    const matches = await searchNationalRetailCatalog(supabase as never, {
      retailBanner: "supervalu",
      query: "SuperValu brand olive oil",
      intent: "stock",
    });

    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /^SuperValu Olive Oil/i);
  });

  it("ranks the product department above ingredient-use matches", async () => {
    const supabase = makeSupabaseRows([
      {
        id: "tuna",
        sku: "tuna",
        product_name: "Callipo Tuna In Olive Oil (170 g)",
        brand: "Callipo",
        department: "Premium Italian",
        service_area: "grocery",
        fulfilment: "prepack",
        is_alcohol: false,
        search_text: "callipo tuna in olive oil premium italian",
        national_store_count: 4,
        national_regular_price_eur: 4.79,
      },
      {
        id: "oil",
        sku: "1009355000",
        product_name: "Don Carlos Extra Virgin Olive Oil (500 ml)",
        brand: "Don Carlos",
        department: "Olive Oil",
        service_area: "grocery",
        fulfilment: "prepack",
        is_alcohol: false,
        search_text: "don carlos extra virgin olive oil olive oil",
        national_store_count: 18,
        national_regular_price_eur: 8.9,
      },
    ]);

    const matches = await searchNationalRetailCatalog(supabase as never, {
      retailBanner: "supervalu",
      query: "olive oil",
      intent: "stock",
    });

    assert.match(matches[0]?.productName ?? "", /Don Carlos Extra Virgin Olive Oil/i);
  });
});

it("searches beyond the first page before rejecting an own-label national product", async () => {
  const rows = Array.from({ length: 550 }, (_, index) => ({
    id: `oil-${index}`, sku: `oil-${index}`, product_name: `Other Olive Oil ${index}`,
    brand: "Other", department: "Olive Oil", service_area: "grocery", fulfilment: "prepack",
    is_alcohol: false, search_text: `other olive oil ${index}`, national_store_count: 4, national_regular_price_eur: 5,
  }));
  rows.push({ ...rows[0]!, id: "own", sku: "own", product_name: "SuperValu Olive Oil", brand: "SuperValu", search_text: "supervalu olive oil" });
  const matches = await searchNationalRetailCatalog(makeSupabaseRows(rows) as never, {
    retailBanner: "supervalu", query: "SuperValu olive oil", intent: "stock",
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.sku, "own");
});
