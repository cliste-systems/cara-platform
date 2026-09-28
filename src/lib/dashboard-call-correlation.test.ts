import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerIncomingCallDetail } from "./dashboard-customer-events";
import { upsertIncomingCallPlaceholder, mergeIncomingCallEvent } from "./calls-incoming-placeholder";

describe("stable customer call identity", () => {
  const startedAt = "2026-09-28T10:00:00Z";
  const endedAt = "2026-09-28T10:01:45Z";
  const caller_number = "+353871234567";
  const usage = customerIncomingCallDetail({ id: "u", call_sid: "CA-real-call", caller_number, started_at: startedAt }, "usage")!;
  const call = customerIncomingCallDetail({ id: "c", call_sid: "CA-real-call", caller_number, created_at: endedAt }, "call_log")!;

  it("replaces a long call's Live card when the completed log arrives before usage ends", () => {
    const rows = upsertIncomingCallPlaceholder(upsertIncomingCallPlaceholder([], usage), call);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.phase, "loading");
    assert.equal(rows[0]?.usageRecordId, "u");
    assert.equal(rows[0]?.callLogId, "c");
    assert.equal(rows[0]?.callSid, "CA-real-call");
  });
  it("does not downgrade or duplicate Loading when usage arrives late", () => {
    const rows = upsertIncomingCallPlaceholder(upsertIncomingCallPlaceholder([], call), usage);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.phase, "loading");
    assert.equal(rows[0]?.startedAt, endedAt);
    assert.equal(rows[0]?.usageRecordId, "u");
  });
  it("keeps two identified calls from the same caller separate", () => {
    const rows = upsertIncomingCallPlaceholder(upsertIncomingCallPlaceholder([], usage), {
      ...usage, callSid: "CA-other-call", usageRecordId: "u2",
    });
    assert.equal(rows.length, 2);
  });
  it("does not reuse a previous call-log ID for a different call in the single-call cache", () => {
    const previous = mergeIncomingCallEvent(null, call);
    const next = mergeIncomingCallEvent(previous, { ...usage, callSid: "CA-other-call", usageRecordId: "u2" });
    assert.equal(next.callLogId, null);
    assert.equal(next.phase, "in_progress");
  });
});
