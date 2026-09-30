import assert from "node:assert/strict";
import test from "node:test";
import { describeAuthCallbackError } from "./auth-error-message";

test("expired sessions explain how to sign in again instead of displaying the error code", () => {
  const message = describeAuthCallbackError("session_expired", undefined);
  assert.match(message ?? "", /Sign in again/);
  assert.match(message ?? "", /new invitation/);
  assert.doesNotMatch(message ?? "", /session_expired/);
});

test("expired staff setup preserves the supplied recovery message and handles malformed encoding", () => {
  const message = "Your invitation session has expired. Ask an owner for a new invitation.";
  assert.equal(describeAuthCallbackError("session_expired", encodeURIComponent(message)), message);
  assert.match(describeAuthCallbackError("session_expired", "%broken") ?? "", /Sign in again/);
});
