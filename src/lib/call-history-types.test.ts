import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeCallOutcome } from "./call-history-types";

describe("normalizeCallOutcome blocked", () => {
  it("maps blocked canonical values", () => {
    assert.equal(normalizeCallOutcome("blocked"), "blocked");
    assert.equal(normalizeCallOutcome("caller_blocked"), "blocked");
    assert.equal(normalizeCallOutcome("Rejected by blocklist"), "blocked");
  });
});

describe("normalizeCallOutcome transferred", () => {
  it("maps transfer canonical values", () => {
    assert.equal(normalizeCallOutcome("transferred"), "transferred");
    assert.equal(normalizeCallOutcome("transfer"), "transferred");
    assert.equal(normalizeCallOutcome("Caller was forwarded to deli"), "transferred");
  });

  it("does not fold transferred into answered", () => {
    assert.notEqual(normalizeCallOutcome("transferred"), "answered");
    assert.notEqual(normalizeCallOutcome("transfer"), "answered");
  });
});

it("explicit speech and connection failures remain failures", () => {
  for (const outcome of ["stt_failure", "tts_failure", "speech_failure", "connection_failed", "dispatch_failed", " STT_FAILURE "]) {
    assert.equal(normalizeCallOutcome(outcome), "failed", outcome);
  }
  assert.equal(normalizeCallOutcome("answered"), "answered");
});
