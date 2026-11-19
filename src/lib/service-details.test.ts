import { test } from "node:test";
import assert from "node:assert/strict";
import { validateService, serviceDetails } from "./service-details";
import {
  formatServiceCatalogLine,
  catalogHasExtractedPrices,
  type ServiceCatalogItem,
} from "./service-catalog-format";
import { compileServiceCatalogKnowledgeLine } from "./service-policy-presets";
const service: ServiceCatalogItem = {
  id: "491f16bd-5716-4c23-9243-233078647bad",
  name: "Boiler service",
  category: null,
  price: 120,
  durationMinutes: 90,
  description: "Annual inspection",
  aiVoiceNotes: null,
  source: "manual",
  policyFlags: [],
  details: {
    priceMode: "fixed",
    durationMode: "estimate",
    status: "available",
    privateNotes: "PRIVATE-4821",
  },
};
test("fixed price, estimated duration and private notes stay distinct", () => {
  assert.equal(validateService(service), null);
  assert.equal(
    formatServiceCatalogLine(service),
    "Boiler service — about 1 hr 30 min — €120",
  );
  assert.ok(
    !compileServiceCatalogKnowledgeLine(service).includes("PRIVATE-4821"),
  );
});
test("unlisted and quote prices are not inferred as free or quoted", () => {
  for (const priceMode of ["unset", "quote"] as const) {
    const item = { ...service, details: { ...service.details!, priceMode } };
    assert.equal(catalogHasExtractedPrices([item]), false);
    assert.ok(!formatServiceCatalogLine(item).includes("€120"));
  }
  assert.match(
    formatServiceCatalogLine({
      ...service,
      price: 0,
      details: { priceMode: "free" },
    }),
    /Free/,
  );
});
test("validate price ranges, duration ranges and malformed records", () => {
  assert.match(
    validateService({
      ...service,
      details: { priceMode: "range", priceMax: 100 },
    })!,
    /upper price/,
  );
  assert.match(
    validateService({
      ...service,
      details: {
        priceMode: "fixed",
        durationMode: "range",
        durationMaxMinutes: 60,
      },
    })!,
    /upper duration/,
  );
  assert.ok(validateService({ ...service, id: "not-an-id" }));
  assert.ok(validateService({ ...service, durationMinutes: 1.5 }));
});
test("legacy service defaults and paused status are retained", () => {
  assert.equal(
    serviceDetails({ ...service, details: undefined }).priceMode,
    "from",
  );
  assert.match(
    formatServiceCatalogLine({
      ...service,
      details: { ...service.details!, status: "unavailable" },
    }),
    /Temporarily unavailable/,
  );
  assert.equal(
    catalogHasExtractedPrices([
      { ...service, details: { ...service.details!, status: "archived" } },
    ]),
    false,
  );
});
test("daily duration and daily pricing remain explicit", () => {
  const line = formatServiceCatalogLine({
    ...service,
    durationMinutes: 2880,
    details: {
      priceMode: "hourly",
      priceUnit: "day",
      durationMode: "estimate",
      durationUnit: "day",
    },
  });
  assert.match(line, /about 2 days/);
  assert.match(line, /€120 per day/);
});
