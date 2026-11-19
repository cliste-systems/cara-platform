import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CALL_MEDIA_RETENTION_MS,
  callMediaRetentionExpiresAt,
  callMediaRetentionRemainingMs,
  formatCallMediaRetentionCountdown,
  formatCallMediaRetentionExpiredMessage,
  formatCallMediaRetentionFooter,
  isCallMediaRetentionExpired,
} from "./call-media-retention";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("call-media-retention", () => {
  it("expires 30 days after call created_at", () => {
    const createdAt = "2026-08-16T12:00:00.000Z";
    const expiresAt = callMediaRetentionExpiresAt(createdAt);
    assert.ok(expiresAt);
    assert.equal(
      expiresAt!.getTime() - new Date(createdAt).getTime(),
      CALL_MEDIA_RETENTION_MS,
    );
  });

  it("formats day-based countdown", () => {
    const createdAt = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const text = formatCallMediaRetentionCountdown(createdAt, NOW);
    assert.equal(
      text,
      "Recording & transcript auto-delete on 25 Sept 2026 · 10 days left",
    );
  });

  it("formats compact footer label", () => {
    const createdAt = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const text = formatCallMediaRetentionFooter(createdAt, NOW);
    assert.equal(text, "Deletes 14 Oct 2026 · 29 days left");
  });

  it("formats hour-based countdown near expiry", () => {
    const createdAt = new Date(
      NOW.getTime() - CALL_MEDIA_RETENTION_MS + 5 * 60 * 60 * 1000,
    ).toISOString();
    const text = formatCallMediaRetentionCountdown(createdAt, NOW);
    assert.match(
      text ?? "",
      /^Recording & transcript auto-delete on 15 Sept 2026 · 5 hours left$/,
    );
  });

  it("returns null after retention cutoff", () => {
    const createdAt = new Date(NOW.getTime() - CALL_MEDIA_RETENTION_MS - 1).toISOString();
    assert.equal(callMediaRetentionRemainingMs(createdAt, NOW), -1);
    assert.equal(formatCallMediaRetentionCountdown(createdAt, NOW), null);
    assert.equal(formatCallMediaRetentionFooter(createdAt, NOW), null);
    assert.equal(isCallMediaRetentionExpired(createdAt, NOW), true);
  });

  it("describes expired media deletion", () => {
    const createdAt = "2026-08-01T12:00:00.000Z";
    assert.equal(
      formatCallMediaRetentionExpiredMessage(createdAt),
      "Recording and transcript access expired on 31 Aug 2026 (30-day retention).",
    );
  });
});
