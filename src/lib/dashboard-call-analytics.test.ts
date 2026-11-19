import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboardCallAnalytics, buildWeightedCallOutcomes, chartAxis, durationChartAxis, durationLineSegments, formatCallDuration, formatChartCount, type AnalyticsRollup, type CallAnalyticsBucket } from "./dashboard-call-analytics";
const raw: AnalyticsRollup = { total: 0, measured: 0, average_seconds: null, longest_seconds: null, total_seconds: 0, hourly: [], daily: [] };
const now = new Date("2026-10-26T15:00:00Z");

describe("complete dashboard call analytics", () => {
  it("shows all 24 hours, including overnight activity and a single call", () => {
    const result = buildDashboardCallAnalytics({ ...raw, total: 1, hourly: [{ id: 23, calls: 1, measured: 1, average_seconds: 0 }] }, [{ outcome: "answered", count: 1 }], "today", "2026-10-26T00:00:00Z", now);
    assert.equal(result.buckets.length, 24);
    assert.equal(result.buckets[23].calls, 1);
    assert.equal(result.buckets[23].averageSeconds, 0);
    assert.equal(result.buckets[0].calls, 0);
    assert.equal(result.buckets[0].averageSeconds, null);
  });
  it("preserves full volumes rather than capping at the recent feed size", () => {
    const result = buildDashboardCallAnalytics({ ...raw, total: 250000, hourly: [{ id: 9, calls: 250000, measured: 250000, average_seconds: 158 }] }, [{ outcome: "answered", count: 250000 }], "today", "2026-10-26T00:00:00Z", now);
    assert.equal(result.total, 250000);
    assert.equal(result.buckets.reduce((sum, b) => sum + b.calls, 0), result.total);
    assert.equal(result.outcomes[0].count, 250000);
  });
  it("fills missing calendar days across the Dublin DST transition", () => {
    const result = buildDashboardCallAnalytics({ ...raw, daily: [{ day: "2026-10-25", calls: 12, measured: 9, average_seconds: 60 }] }, [], "7d", "2026-10-23T14:00:00Z", now);
    assert.deepEqual(result.buckets.map(b => b.id), ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
    assert.equal(result.buckets[2].calls, 12);
    assert.equal(result.buckets[0].averageSeconds, null);
  });
  it("uses Dublin's calendar day during summer time", () => {
    const result = buildDashboardCallAnalytics(raw, [], "7d", "2026-07-01T23:30:00Z", new Date("2026-07-03T00:30:00Z"));
    assert.deepEqual(result.buckets.map(b => b.id), ["2026-07-02", "2026-07-03"]);
  });
  it("handles no calls and no recorded durations without inventing a zero average", () => {
    const result = buildDashboardCallAnalytics(raw, [], "today", "2026-10-26T00:00:00Z", now);
    assert.equal(result.averageSeconds, null);
    assert.equal(result.measured, 0);
    assert.deepEqual(result.outcomes, []);
    assert.ok(result.buckets.every(b => b.averageSeconds === null));
  });
  it("rejects negative, missing and nonfinite durations while preserving valid zero", () => {
    const result = buildDashboardCallAnalytics({ ...raw, average_seconds: NaN, longest_seconds: -1, hourly: [{ id: 1, calls: -2, measured: Infinity, average_seconds: -5 }, { id: 2, calls: 1, measured: 1, average_seconds: 0 }] }, [], "today", "2026-10-26T00:00:00Z", now);
    assert.equal(result.averageSeconds, null);
    assert.equal(result.longestSeconds, null);
    assert.equal(result.buckets[1].calls, 0);
    assert.equal(result.buckets[1].measured, 0);
    assert.equal(result.buckets[1].averageSeconds, null);
    assert.equal(result.buckets[2].averageSeconds, 0);
  });
  it("allocates percentage rounding to exactly 100 and includes every outcome", () => {
    const result = buildWeightedCallOutcomes(["answered", "callback_requested", "failed"].map(outcome => ({ outcome, count: 1 })));
    assert.deepEqual(result.map(r => r.percent), [34, 33, 33]);
    assert.equal(result.reduce((sum, r) => sum + r.percent, 0), 100);
  });
  it("keeps unclassified calls honest and normalizes supported aliases", () => {
    const result = buildWeightedCallOutcomes([{ outcome: null, count: 5 }, { outcome: "custom status", count: 7 }, { outcome: "transfer", count: 2 }, { outcome: "answered", count: 1 }]);
    assert.equal(result.find(r => r.id === "unknown")?.count, 14);
    assert.equal(result.find(r => r.id === "answered")?.count, 1);
    assert.equal(result.find(r => r.id === "transferred"), undefined);
  });
  it("supports all outcome categories including rare failed, spam and blocked calls", () => {
    const ids = ["answered", "link_sent", "callback_requested", "action_created", "failed", "voicemail_or_no_speech", "spam_or_abuse", "blocked"];
    const result = buildWeightedCallOutcomes(ids.map(outcome => ({ outcome, count: 1 })));
    assert.equal(result.length, 8);
    assert.equal(result.reduce((sum, row) => sum + row.percent, 0), 100);
  });
  it("uses product labels without claiming transfers or voicemail features", () => {
    const result = buildWeightedCallOutcomes([
      { outcome: "answered", count: 5 }, { outcome: "action_created", count: 2 },
      { outcome: "voicemail_or_no_speech", count: 1 }, { outcome: "transferred", count: 1 },
    ]);
    assert.equal(result.find(r => r.id === "answered")?.label, "Handled by Cara");
    assert.equal(result.find(r => r.id === "action_created")?.label, "Follow-up logged");
    assert.equal(result.find(r => r.id === "voicemail_or_no_speech")?.label, "No conversation recorded");
    assert.equal(result.find(r => r.id === "unknown")?.count, 1);
    assert.ok(result.every(r => !/transferred|voicemail/i.test(r.label)));
  });
  it("does not connect duration gaps or lose a single measured point", () => {
    const buckets: CallAnalyticsBucket[] = [10, null, 0, 60].map((value, i) => ({ id: String(i), label: "", shortLabel: "", calls: 1, measured: value === null ? 0 : 1, averageSeconds: value }));
    const segments = durationLineSegments(buckets, 60);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].split(" ").length, 1);
    assert.equal(segments[1].split(" ").length, 2);
    assert.deepEqual(durationLineSegments([{ ...buckets[0], averageSeconds: 60 }], 60), ["50,0"]);
  });
  it("scales to zero, single, huge and fractional volumes without fractional count ticks", () => {
    for (const count of [0, 1, 9, 17, 99, 4000, 250000, 1e9]) {
      const axis = chartAxis(count);
      assert.ok(axis.max >= count);
      assert.ok(axis.ticks.length >= 2 && axis.ticks.length <= 6);
      assert.ok(axis.ticks.every(Number.isInteger));
      assert.ok(axis.ticks.every(Number.isFinite));
    }
    assert.equal(chartAxis(NaN).max, 4);
    assert.equal(chartAxis(-1).max, 4);
  });
  it("uses readable time increments for durations from seconds to multiple days", () => {
    for (const value of [0, 1, 9, 59, 158, 600, 10800, 86400, 900000]) {
      const axis = durationChartAxis(value);
      assert.ok(axis.max >= value);
      assert.ok(axis.ticks.length >= 2 && axis.ticks.length <= 6);
      assert.ok(axis.ticks.every(Number.isFinite));
    }
    assert.deepEqual(durationChartAxis(10800).ticks, [0, 3600, 7200, 10800]);
  });
  it("formats seconds, minute boundaries, hours and missing durations clearly", () => {
    assert.equal(formatCallDuration(null), "—");
    assert.equal(formatCallDuration(-1), "—");
    assert.equal(formatCallDuration(0), "0s");
    assert.equal(formatCallDuration(59.6), "1m 0s");
    assert.equal(formatCallDuration(158), "2m 38s");
    assert.equal(formatCallDuration(7205), "2h");
    assert.equal(formatCallDuration(7380), "2h 3m");
    assert.equal(formatChartCount(250000), "250K");
  });
});
