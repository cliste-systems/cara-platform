import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboardActivityFeed } from "./dashboard-activity-feed";

const engineer = { id: "e", created_at: "2026-09-28T12:00:00Z", outcome: "answered", caller_number: "+353870000001" };
const calls = [
  { id: "c1", created_at: "2026-09-28T11:00:00Z", outcome: "answered", caller_number: "+353871234567" },
  { id: "c2", created_at: "2026-09-28T09:00:00Z", outcome: "answered", caller_number: "+353878765432" },
];
const ticket = { id: "t1", created_at: "2026-09-28T10:00:00Z", caller_number: "+353871234567" };

describe("engineer notices do not consume customer feed capacity", () => {
  it("retains the full customer limit plus one latest informational notice", () => {
    const rows = buildDashboardActivityFeed({
      calls: [...calls, engineer, { ...engineer, id: "older", created_at: "2026-09-28T08:00:00Z" }],
      tickets: [ticket], limit: 3, formatTime: () => "now",
    });
    assert.deepEqual(rows.map(row => row.id), ["e-call", "c1-call", "t1-ticket", "c2-call"]);
  });
  it("caps the customer rows independently while retaining chronological order", () => {
    const rows = buildDashboardActivityFeed({ calls: [...calls, engineer], tickets: [ticket], limit: 2, formatTime: () => "now" });
    assert.deepEqual(rows.map(row => row.id), ["e-call", "c1-call", "t1-ticket"]);
  });
  it("has a single notice and no customer rows when customer capacity is zero", () => {
    const rows = buildDashboardActivityFeed({ calls: [...calls, engineer], tickets: [ticket], limit: 0, formatTime: () => "now" });
    assert.deepEqual(rows.map(row => row.id), ["e-call"]);
  });
});
