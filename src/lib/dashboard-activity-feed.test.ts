import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDashboardActivityFeed, buildHomeLiveActivityFeed } from "./dashboard-activity-feed";
import { activityFeedCallerLabel } from "./dashboard-feed-time";
import { formatActivityFeedBadge } from "./dashboard-live-activity";

describe("activityFeedCallerLabel", () => {
  it("shows phone number instead of caller name", () => {
    assert.equal(activityFeedCallerLabel({ caller_name: "Mark", caller_number: "+353872715938" }), "+353 87 271 5938");
  });
});

describe("formatActivityFeedBadge", () => {
  it("classifies birthday cake orders", () => {
    assert.equal(formatActivityFeedBadge({ summary: "Stephen called to order a birthday cake for Sean with blue icing." }), "Order");
  });
  it("classifies complaints", () => {
    assert.equal(formatActivityFeedBadge({ summary: "Complaint — product return for chicken bought last week." }), "Complaint");
  });
  it("falls back to Call when there is no summary", () => {
    assert.equal(formatActivityFeedBadge({ outcome: "answered" }), "Call");
  });
});

describe("buildDashboardActivityFeed", () => {
  it("uses phone labels and request-type badges", () => {
    const rows = buildDashboardActivityFeed({
      calls: [],
      tickets: [{ id: "t1", created_at: "2026-09-17T12:00:00.000Z", caller_number: "+353872715938", summary: "Birthday cake order for Friday collection." }],
      formatTime: () => "1 hour ago",
    });
    assert.equal(rows[0]?.title, "+353 87 271 5938");
    assert.equal(rows[0]?.badge, "Order");
  });
});

describe("buildHomeLiveActivityFeed", () => {
  it("collapses engineer test calls to one informational row without a test counter", () => {
    const rows = buildHomeLiveActivityFeed({
      calls: [
        { id: "e1", created_at: "2026-09-20T17:12:00.000Z", outcome: "answered", caller_number: "+353870000001", engineer_test_call: true },
        { id: "e2", created_at: "2026-09-20T17:08:00.000Z", outcome: "answered", caller_number: "+353870000001", engineer_test_call: true },
        { id: "c1", created_at: "2026-09-20T16:00:00.000Z", outcome: "action_created", caller_number: "+353872715938", caller_name: "Brendan" },
      ],
      formatTime: () => "2 mins ago",
      limit: 10,
    });
    assert.equal(rows.filter((row) => row.title === "HelloCara Engineer").length, 1);
    assert.equal(rows[0]?.title, "HelloCara Engineer");
    assert.equal(rows[0]?.subtitle, "Test call · not billed");
    assert.equal(rows[1]?.title, "Brendan");
    assert.equal(rows[1]?.subtitle, "+353 87 271 5938");
  });
});
