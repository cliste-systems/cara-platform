import assert from "node:assert/strict";
import test from "node:test";
import { userNeedsPassword, validateInvitePassword } from "./invite-onboarding";

test("only trusted app metadata controls the password gate", () => {
  assert.equal(userNeedsPassword({ app_metadata: { needs_password: true } }), true);
  assert.equal(userNeedsPassword({ app_metadata: { needs_password: false } }), false);
  const manipulated = { app_metadata: { needs_password: true }, user_metadata: { needs_password: false } };
  assert.equal(userNeedsPassword(manipulated), true);
  assert.equal(userNeedsPassword({ app_metadata: {} }), false);
});

test("password validation rejects short, mismatched and oversized input", () => {
  assert.ok(validateInvitePassword(null, null));
  assert.ok(validateInvitePassword("short", "short"));
  assert.ok(validateInvitePassword("a long memorable passphrase", "different"));
  assert.ok(validateInvitePassword("a".repeat(129), "a".repeat(129)));
  assert.equal(validateInvitePassword("long memorable phrase", "long memorable phrase"), null);
});
