import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverVoiceEmail } from "./voice-email-delivery";

const id = "00000000-0000-4000-8000-000000000001";
const lease = "00000000-0000-4000-8000-000000000002";
const input = { organizationId: id, callSessionId: "test-room", to: "caller@example.test", subject: "Directions", text: "A business address" };

test("duplicate and budget denials never reach the provider", async () => {
  for (const status of ["duplicate", "limited", "invalid_session", "in_progress", "expired"]) {
    let sends = 0;
    const result = await deliverVoiceEmail(input, { claim: async () => ({ status }), send: async () => { sends++; return { ok: true }; }, finish: async () => assert.fail("No claim to finish") });
    assert.equal(sends, 0);
    assert.equal(result.ok, status === "duplicate");
  }
});
test("database failures and malformed reservations fail closed", async () => {
  for (const claim of [null, {}, { status: "claimed", id: "bad", lease_token: lease }]) {
    const result = await deliverVoiceEmail(input, { claim: async () => claim, send: async () => assert.fail("Unreserved email"), finish: async () => {} });
    assert.deepEqual(result, { ok: false, code: "delivery_unavailable", status: 503 });
  }
});
test("ambiguous sends retry with the same provider idempotency key", async () => {
  const keys: string[] = [];
  const states: string[] = [];
  const deps = {
    claim: async () => ({ status: "claimed", id, lease_token: lease }),
    send: async ({ idempotencyKey }: { idempotencyKey: string }) => { keys.push(idempotencyKey); if (keys.length === 1) throw new Error("Timeout after send"); return { ok: true }; },
    finish: async (_id: string, _lease: string, status: string) => { states.push(status); },
  };
  assert.equal((await deliverVoiceEmail(input, deps)).ok, false);
  assert.equal((await deliverVoiceEmail(input, deps)).ok, true);
  assert.deepEqual(keys, [`voice-email/${id}`, `voice-email/${id}`]);
  assert.deepEqual(states, ["failed", "sent"]);
});
test("recipient budget identity is normalized and the body is bound to the claim", async () => {
  const claims: { recipientHash: string; contentHash: string }[] = [];
  const deps = { claim: async (claim: { recipientHash: string; contentHash: string }) => { claims.push(claim); return { status: "duplicate" }; }, send: async () => ({ ok: true }), finish: async () => {} };
  await deliverVoiceEmail(input, deps);
  await deliverVoiceEmail({ ...input, to: " CALLER@EXAMPLE.TEST ", text: "Changed address" }, deps);
  assert.equal(claims[0].recipientHash, claims[1].recipientHash);
  assert.notEqual(claims[0].contentHash, claims[1].contentHash);
  assert.match(claims[0].recipientHash, /^[a-f0-9]{64}$/);
});
