import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeIncomingCallEvent,
  shouldClearCallsIncomingPlaceholder,
  shouldShowCallsIncomingPlaceholder,
} from "./calls-incoming-placeholder";

describe("shouldShowCallsIncomingPlaceholder", () => {
  it("shows on today page 1 only", () => {
    const placeholder = {
      phase: "loading" as const,
      callerNumber: "+353861001001",
      callLogId: "abc",
      startedAt: "2026-09-15T12:00:00.000Z",
    };

    assert.equal(
      shouldShowCallsIncomingPlaceholder({
        viewingToday: true,
        page: 1,
        placeholder,
      }),
      true,
    );
    assert.equal(
      shouldShowCallsIncomingPlaceholder({
        viewingToday: false,
        page: 1,
        placeholder,
      }),
      false,
    );
    assert.equal(
      shouldShowCallsIncomingPlaceholder({
        viewingToday: true,
        page: 2,
        placeholder,
      }),
      false,
    );
  });
});

describe("shouldClearCallsIncomingPlaceholder", () => {
  it("clears when the call log id appears", () => {
    assert.equal(
      shouldClearCallsIncomingPlaceholder(
        {
          phase: "loading",
          callerNumber: null,
          callLogId: "call-1",
          startedAt: "2026-09-15T12:00:00.000Z",
        },
        [{ id: "call-1", createdAt: "2026-09-15T12:01:00.000Z" }],
      ),
      true,
    );
  });

  it("clears in-progress rows when a new call lands after start time", () => {
    assert.equal(
      shouldClearCallsIncomingPlaceholder(
        {
          phase: "in_progress",
          callerNumber: "+353861001001",
          callLogId: null,
          startedAt: "2026-09-15T12:00:00.000Z",
        },
        [{ id: "call-2", createdAt: "2026-09-15T12:00:30.000Z" }],
      ),
      true,
    );
  });
});

describe("mergeIncomingCallEvent", () => {
  it("upgrades in-progress to loading while keeping caller number", () => {
    assert.deepEqual(
      mergeIncomingCallEvent(
        {
          phase: "in_progress",
          callerNumber: "+353861001001",
          callLogId: null,
          startedAt: "2026-09-15T12:00:00.000Z",
        },
        {
          phase: "loading",
          callLogId: "call-1",
        },
      ),
      {
        phase: "loading",
        callerNumber: "+353861001001",
        callLogId: "call-1",
        usageRecordId: null,
        startedAt: "2026-09-15T12:00:00.000Z",
      },
    );
  });
});
