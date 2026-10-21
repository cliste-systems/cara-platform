import assert from "node:assert/strict";
import test from "node:test";
import { overviewProviderIsToday, overviewIssueMatches, overviewCallKind, overviewEvidenceLabel, overviewProcessingLabel } from "./admin-overview-model";

test("demo identity takes precedence over its internal engineer flag", () => {
  assert.equal(overviewCallKind({ caller_number: "+353870000001", room_name: "admin-demo-abc", engineer_test_call: true }), "Demo");
  assert.equal(overviewCallKind({ engineer_test_call: true, is_test_call: true }), "Engineer test");
  assert.equal(overviewCallKind({ verification_call: true }), "Verification");
  assert.equal(overviewCallKind({ is_test_call: true }), "Demo");
  assert.equal(overviewCallKind({}), "Customer");
});

test("missing processing evidence cannot be called complete", () => {
  assert.equal(overviewProcessingLabel(null, false), "Not assessed");
  assert.equal(overviewProcessingLabel("failed", false), "Processing failed");
  assert.equal(overviewProcessingLabel("partial", false), "Partially processed");
  assert.equal(overviewProcessingLabel("complete", true), "Live now");
});

test("zero recorded incidents does not certify missing or partial coverage", () => {
  assert.equal(overviewEvidenceLabel(0, 0, 3), "Evidence not available");
  assert.equal(overviewEvidenceLabel(0, 2, 3), "2 of 3 calls assessed");
  assert.equal(overviewEvidenceLabel(0, 3, 3), "No issues in assessed calls");
  assert.equal(overviewEvidenceLabel(2, 3, 3), "Recorded in today’s calls");
  assert.equal(overviewEvidenceLabel(0, 0, 0), "No completed calls today");
});

test("attention categories include quality issues beyond the primary reason", () => {
  const mixed = { callId: "call-1", href: "/admin/call-analysis/call-1", reasons: ["Processing overdue", "Failed quality review"] };
  assert.equal(overviewIssueMatches(mixed, "reviews"), true);
  assert.equal(overviewIssueMatches(mixed, "calls"), true);
  assert.equal(overviewIssueMatches(mixed, "support"), false);
  assert.equal(overviewIssueMatches({ ...mixed, reasons: ["Processing overdue"] }, "reviews"), false);
  const support = { callId: null, href: "/admin/support/ticket-1", reasons: ["Support ticket"] };
  assert.equal(overviewIssueMatches(support, "support"), true);
  assert.equal(overviewIssueMatches(support, "calls"), false);
  assert.equal(overviewIssueMatches(support, "all"), true);
});

test("Overview provider reports use inclusive Dublin midnight and exclusive next midnight", () => {
  const start = "2026-10-04T23:00:00Z", end = "2026-10-05T23:00:00Z";
  const checkedAt = "2026-10-04T23:20:00Z";
  assert.equal(overviewProviderIsToday({ reportedAt: "2026-10-04T22:59:59Z", checkedAt }, start, end), false);
  assert.equal(overviewProviderIsToday({ reportedAt: start, checkedAt }, start, end), true);
  assert.equal(overviewProviderIsToday({ reportedAt: end, checkedAt }, start, end), false);
  assert.equal(overviewProviderIsToday({ checkedAt }, start, end), true);
  assert.equal(overviewProviderIsToday({ reportedAt: "invalid", checkedAt }, start, end), false);
  assert.equal(overviewProviderIsToday({ checkedAt: "2026-10-04T22:59:59Z" }, start, end), false);
});
