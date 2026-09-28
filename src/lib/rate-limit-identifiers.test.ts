import assert from "node:assert/strict";
import test from "node:test";
import {
  actorRateLimitFingerprint, emailRateLimitFingerprint, rateLimitFingerprint, trustedClientIp,
} from "./rate-limit-identifiers";

test("User-Agent and spoofed client-IP headers cannot reset a network bucket", () => {
  const first = new Headers({ "x-forwarded-for": "192.0.2.1", "user-agent": "browser-one" });
  const second = new Headers(first);
  second.set("user-agent", "browser-two");
  second.set("cf-connecting-ip", "192.0.2.99");
  second.set("x-real-ip", "192.0.2.98");
  assert.equal(rateLimitFingerprint(first, "auth-ip"), rateLimitFingerprint(second, "auth-ip"));
  assert.equal(trustedClientIp(first, true), "192.0.2.1");
  assert.equal(trustedClientIp(second, true), "192.0.2.1");
});

test("only the configured ingress is trusted and malformed IP values share a bucket", () => {
  const headers = new Headers({ "x-forwarded-for": "192.0.2.1", "x-real-ip": "192.0.2.2" });
  assert.equal(trustedClientIp(headers, false), "unknown-network");
  headers.set("x-vercel-forwarded-for", "192.0.2.3");
  assert.equal(trustedClientIp(headers, true), "192.0.2.3");
  headers.set("x-vercel-forwarded-for", "192.0.2.3, 192.0.2.4");
  assert.equal(trustedClientIp(headers, true), "unknown-network");
});

test("email and verified actor buckets survive browser and network changes", () => {
  assert.equal(emailRateLimitFingerprint(" Alice@Example.invalid "), emailRateLimitFingerprint("alice@example.invalid"));
  assert.notEqual(emailRateLimitFingerprint("alice@example.invalid"), emailRateLimitFingerprint("bob@example.invalid"));
  assert.equal(actorRateLimitFingerprint("voice-preview:actor-a"), actorRateLimitFingerprint("voice-preview:actor-a"));
  assert.notEqual(actorRateLimitFingerprint("voice-preview:actor-a"), actorRateLimitFingerprint("voice-preview:actor-b"));
  assert.throws(() => actorRateLimitFingerprint(" "), /verified/);
});
