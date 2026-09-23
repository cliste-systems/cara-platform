import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billingDueStatus,
  buildPlatformSpendSummary,
  computeNextBillingDate,
  normalizeToMonthlyCents,
  sumDueThisMonth,
  type PlatformVendorCostRow,
} from "./platform-spend";

function row(
  partial: Partial<PlatformVendorCostRow> & Pick<PlatformVendorCostRow, "vendor_key" | "display_name">,
): PlatformVendorCostRow {
  return {
    id: partial.id ?? "1",
    vendor_key: partial.vendor_key,
    display_name: partial.display_name,
    amount_cents: partial.amount_cents ?? null,
    currency: partial.currency ?? "EUR",
    billing_cycle: partial.billing_cycle ?? "monthly",
    billing_day: partial.billing_day ?? null,
    next_billing_date: partial.next_billing_date ?? null,
    source: partial.source ?? "manual",
    api_provider: partial.api_provider ?? null,
    last_synced_at: partial.last_synced_at ?? null,
    last_synced_amount_cents: partial.last_synced_amount_cents ?? null,
    last_sync_error: partial.last_sync_error ?? null,
    dashboard_url: partial.dashboard_url ?? null,
    active: partial.active ?? true,
    notes: partial.notes ?? null,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: partial.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

describe("platform-spend", () => {
  it("computes next billing date in same month when day is ahead", () => {
    const from = new Date(Date.UTC(2026, 8, 10));
    assert.equal(computeNextBillingDate(15, from), "2026-09-15");
  });

  it("rolls next billing date to following month when day passed", () => {
    const from = new Date(Date.UTC(2026, 8, 20));
    assert.equal(computeNextBillingDate(15, from), "2026-10-15");
  });

  it("normalizes annual to monthly", () => {
    const annual = row({
      vendor_key: "x",
      display_name: "X",
      billing_cycle: "annual",
      amount_cents: 120_00,
    });
    assert.equal(normalizeToMonthlyCents(annual), 10_00);
  });

  it("uses synced amount for usage-based vendors", () => {
    const usage = row({
      vendor_key: "openrouter",
      display_name: "OpenRouter",
      billing_cycle: "usage",
      source: "api",
      last_synced_amount_cents: 4500,
    });
    assert.equal(normalizeToMonthlyCents(usage), 4500);
  });

  it("sums due this month", () => {
    const rows = [
      row({
        vendor_key: "a",
        display_name: "A",
        amount_cents: 2000,
        next_billing_date: "2026-09-12",
      }),
      row({
        vendor_key: "b",
        display_name: "B",
        amount_cents: 3000,
        next_billing_date: "2026-10-01",
      }),
    ];
    const ref = new Date(Date.UTC(2026, 8, 21));
    assert.equal(sumDueThisMonth(rows, ref), 2000);
  });

  it("builds summary totals", () => {
    const rows = [
      row({
        vendor_key: "cursor",
        display_name: "Cursor",
        amount_cents: 2000,
        billing_cycle: "monthly",
      }),
      row({
        vendor_key: "openrouter",
        display_name: "OpenRouter",
        billing_cycle: "usage",
        source: "api",
        last_synced_amount_cents: 1500,
      }),
    ];
    const summary = buildPlatformSpendSummary(rows, new Date(Date.UTC(2026, 8, 21)));
    assert.equal(summary.monthlyRunRateCents, 3500);
    assert.equal(summary.apiSyncedMtdCents, 1500);
    assert.equal(summary.totalEstimatedMonthlyCents, 3500);
  });

  it("flags overdue and due soon", () => {
    const ref = new Date(Date.UTC(2026, 8, 21));
    assert.equal(billingDueStatus("2026-09-10", ref), "overdue");
    assert.equal(billingDueStatus("2026-09-25", ref), "due_soon");
    assert.equal(billingDueStatus("2026-11-01", ref), "ok");
  });
});
