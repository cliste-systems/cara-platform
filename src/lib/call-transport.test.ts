import assert from "node:assert/strict";
import test from "node:test";
import { parseTransportBatch } from "./call-transport";
import { buildCallTechnicalHealth } from "./call-technical-health";
const sample = (i: number, loss = 0) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, stream: "00000000-0000-4000-8000-000000000099", atMs: i * 1000, intervalMs: 1000, packetLossPercent: loss, jitterMs: 12, roundTripMs: 80, concealmentPercent: 0, averageJitterBufferMs: 20, connectionQuality: "good" });
const batch = { roomName: "admin-demo-00000000-0000-4000-8000-000000000001", samples: [sample(0)] };
test("transport allowlist strips arbitrary raw network data", () => {
  const result = parseTransportBatch({ ...batch, samples: [{ ...sample(0), ip: "127.0.0.1", rawReport: {} }] });
  assert.equal("ip" in result.samples[0], false);
  assert.equal("rawReport" in result.samples[0], false);
});
test("invalid telemetry is rejected", () => {
  for (const field of [{ jitterMs: -1 }, { packetLossPercent: 101 }, { intervalMs: 0 }, { id: "bad" }, { atMs: Infinity }]) assert.throws(() => parseTransportBatch({ ...batch, samples: [{ ...sample(0), ...field }] }));
  assert.throws(() => parseTransportBatch({ ...batch, roomName: "other-room" }));
});
test("sustained faults survive a recovered connection", () => {
  const samples = Array.from({ length: 12 }, (_, i) => sample(i, i < 3 ? 2 : 0));
  const health = buildCallTechnicalHealth(null, "complete", samples);
  assert.equal(health.find(check => check.id === "packet_loss")?.status, "fail");
  assert.equal(health.find(check => check.id === "jitter")?.status, "pass");
});
test("a single spike does not become sustained packet loss", () => {
  const health = buildCallTechnicalHealth(null, null, Array.from({ length: 5 }, (_, i) => sample(i, i === 2 ? 4 : 0)));
  assert.equal(health.find(check => check.id === "packet_loss")?.status, "pass");
});
test("short samples and incomplete retrieval cannot certify the network", () => {
  assert.equal(buildCallTechnicalHealth(null, null, [sample(0)]).find(check => check.id === "packet_loss")?.status, "unknown");
  assert.equal(buildCallTechnicalHealth(null, null, Array.from({ length: 5 }, (_, i) => sample(i)), false).find(check => check.id === "packet_loss")?.status, "unknown");
});
test("track changes cannot combine unrelated streams into a warning window", () => {
  const samples = Array.from({ length: 5 }, (_, i) => ({ ...sample(i, 2), stream: i < 2 ? "first" : "second" }));
  assert.equal(buildCallTechnicalHealth(null, null, samples).find(check => check.id === "packet_loss")?.status, "unknown");
});
test("recovered log values are visible without certifying partial coverage", () => {
  const recovered = Array.from({ length: 5 }, (_, i) => ({ ...sample(i), recoveredFrom: "next-development-log" }));
  const checks = buildCallTechnicalHealth(null, null, recovered);
  assert.equal(checks.find(check => check.id === "packet_loss")?.value, "0.0%");
  for (const id of ["packet_loss", "jitter", "rtt", "buffer", "concealment", "connection"]) {
    assert.equal(checks.find(check => check.id === id)?.status, "unknown");
  }
  assert.match(checks.find(check => check.id === "packet_loss")!.detail, /Coverage is partial/);
  const failed = buildCallTechnicalHealth(null, null, recovered.map(row => ({ ...row, packetLossPercent: 5 })));
  assert.equal(failed.find(check => check.id === "packet_loss")?.status, "fail");
});
