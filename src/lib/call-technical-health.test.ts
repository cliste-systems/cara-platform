import assert from "node:assert/strict";
import test from "node:test";
import { buildCallTechnicalHealth } from "./call-technical-health";

test("missing telemetry never implies healthy audio", () => {
  const checks = buildCallTechnicalHealth(null, null);
  assert.ok(checks.every(check => check.status === "unknown"));
});
test("post-call completion cannot mark transport checks as passed", () => {
  const checks = buildCallTechnicalHealth({ events: [], latency: {} }, "complete");
  assert.equal(checks.find(check => check.id === "processing")?.status, "pass");
  assert.equal(checks.find(check => check.id === "packet_loss")?.status, "unknown");
  assert.equal(checks.find(check => check.id === "tools")?.status, "unknown");
});
test("measured failures remain failures after successful processing", () => {
  const checks = buildCallTechnicalHealth({ latency: { replyMs: [1000, 2500, 3000] }, events: [{ level: "error", tag: "tool_failure", message: "Lookup failed" }], pipelineIncidents: [{ error_message: "Audio output failed" }] }, "complete");
  assert.equal(checks.find(check => check.id === "response")?.value, "2.50 s");
  for (const id of ["response", "tools", "pipeline"]) assert.equal(checks.find(check => check.id === id)?.status, "fail");
});
test("inferred events and malformed timing values do not become measurements", () => {
  const checks = buildCallTechnicalHealth({ latency: { replyP50: -1, replyMs: [NaN, Infinity, -2, "500"] }, events: [{ level: "error", tag: "inferred_tool_failure", data: { source: "server_inferred" } }] }, null);
  assert.equal(checks.find(check => check.id === "response")?.status, "unknown");
  assert.equal(checks.find(check => check.id === "tools")?.status, "unknown");
});
test("complete capture requires matching counts and both speakers", () => {
  const valid = { status: "captured", expectedEventCount: 4, persistedEventCount: 4, sequenceContinuous: true, hasCaller: true, hasAssistant: true };
  assert.equal(buildCallTechnicalHealth({ transcriptCapture: valid }, null).find(check => check.id === "capture")?.status, "pass");
  assert.notEqual(buildCallTechnicalHealth({ transcriptCapture: { ...valid, persistedEventCount: 2 } }, null).find(check => check.id === "capture")?.status, "pass");
});
test("duplex audio timings produce the measured median with their capture source", () => {
  const latency = { replyMs: [500, 1300], replyTiming: { source: "caller_vad_to_worker_audio", captureComplete: true } };
  const check = buildCallTechnicalHealth({ latency }, "complete").find(check => check.id === "response")!;
  assert.equal(check.value, "0.90 s");
  assert.equal(check.status, "pass");
  assert.match(check.detail, /Caller speech ending/);
  const partial = buildCallTechnicalHealth({ latency: { ...latency, replyTiming: { ...latency.replyTiming, captureComplete: false } } }, "complete").find(check => check.id === "response")!;
  assert.equal(partial.value, "0.90 s");
  assert.equal(partial.status, "unknown");
});

test("measured static fails even when the transcript and network are healthy", () => {
  const check = buildCallTechnicalHealth({ audioQuality: { measured: true, status: "static" } }, "complete").find(c => c.id === "audio")!;
  assert.equal(check.status, "fail");
  assert.equal(buildCallTechnicalHealth({ audioQuality: { status: "clear" } }, "complete").find(c => c.id === "audio")?.status, "unknown");
});
