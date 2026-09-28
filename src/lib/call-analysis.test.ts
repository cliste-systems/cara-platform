import test from "node:test";
import assert from "node:assert/strict";
import { CALL_ANALYSIS_CHECKLIST, deriveCallAnalysisVerdict, groundCallAnalysis, parseCallAnalysisResult, type CallAnalysisInput, type CallAnalysisCheck, type CallAnalysisResult } from "./call-analysis";

const input: CallAnalysisInput = {
  transcript: "Assistant: Hello, this is Cara.\nCaller: Thanks, goodbye.",
  diagnostics: null, context: {},
  call: { durationSeconds: 10, outcome: "resolved", postCallStatus: "complete", postCallErrors: [], transferConnected: null, expectedTicket: false, hasLinkedTicket: false },
};
const check = (id: CallAnalysisCheck["id"], status: CallAnalysisCheck["status"] = "pass"): CallAnalysisCheck => ({ id, status, reason: "Supported by the conversation.", evidence: [{ source: "transcript", quote: "Thanks, goodbye." }], recommendation: null });
const result = (): CallAnalysisResult => deriveCallAnalysisVerdict({ summary: "The call was handled well.", checks: CALL_ANALYSIS_CHECKLIST.map(c => check(c.id)), recommendations: [] });

test("one failed check overrides every pass and unknown", () => {
  const r = result(); r.checks[0].status = "unverified"; r.checks[1].status = "fail";
  assert.equal(deriveCallAnalysisVerdict(r).verdict, "fail");
  assert.equal(deriveCallAnalysisVerdict(r).failedCount, 1);
});
test("unverified checks cannot earn an overall pass", () => {
  const r = result(); r.checks[2].status = "unverified";
  assert.equal(deriveCallAnalysisVerdict(r).verdict, "review");
});
test("not applicable is permitted without disguising missing evidence", () => {
  const r = result(); r.checks.find(c => c.id === "offers")!.status = "not_applicable";
  assert.equal(deriveCallAnalysisVerdict(r).verdict, "pass");
  assert.equal(groundCallAnalysis(r, input).verdict, "review");
});
test("complete checklist and unique IDs are mandatory", () => {
  const r = result();
  assert.throws(() => parseCallAnalysisResult({ ...r, checks: r.checks.slice(1) }), /incomplete/);
  assert.throws(() => parseCallAnalysisResult({ ...r, checks: [...r.checks.slice(1), r.checks[1]] }), /duplicate/);
});
test("provider verdict cannot override the computed result", () => {
  const r = result(); r.checks[0].status = "fail";
  assert.equal(parseCallAnalysisResult({ ...r, verdict: "pass" }).verdict, "fail");
});
test("unsupported failure evidence is unverified, not an invented incident", () => {
  const r = result(); r.checks.find(c => c.id === "call_ending")!.status = "fail";
  r.checks.find(c => c.id === "call_ending")!.evidence = [{ source: "transcript", quote: "I am hanging up because Cara is broken." }];
  assert.equal(groundCallAnalysis(r, input).checks.find(c => c.id === "call_ending")!.status, "unverified");
});
test("caller saying goodbye last is not automatically a failure", () => {
  assert.equal(groundCallAnalysis(result(), input).checks.find(c => c.id === "call_ending")!.status, "pass");
});
test("greeting and successful synthesis cannot certify audio quality", () => {
  const r = result(); r.checks.find(c => c.id === "audio")!.evidence = [{ source: "diagnostics", quote: '"greetingPlayed":true' }];
  assert.equal(groundCallAnalysis(r, { ...input, diagnostics: { greetingPlayed: true } }).checks.find(c => c.id === "audio")!.status, "unverified");
});
test("explicit audio measurement permits a supported audio pass", () => {
  const r = result(); r.checks.find(c => c.id === "audio")!.evidence = [{ source: "diagnostics", quote: '"measured":true' }];
  assert.equal(groundCallAnalysis(r, { ...input, diagnostics: { audioQuality: { measured: true, status: "clear" } } }).checks.find(c => c.id === "audio")!.status, "pass");
});
test("real tool errors fail the call even if the reviewer missed them", () => {
  const reviewed = groundCallAnalysis(result(), { ...input, diagnostics: { events: [{ level: "error", tag: "tool_failure", message: "Lookup timed out" }] } });
  assert.equal(reviewed.verdict, "fail");
  assert.equal(reviewed.checks.find(c => c.id === "tools")!.status, "fail");
});
test("missing required follow-up fails after processing, pending stays unverified", () => {
  const r = groundCallAnalysis(result(), { ...input, call: { ...input.call, expectedTicket: true } });
  assert.equal(r.checks.find(c => c.id === "follow_up")!.status, "fail");
  const pending = groundCallAnalysis(result(), { ...input, call: { ...input.call, expectedTicket: true, postCallStatus: "pending" } });
  assert.notEqual(pending.checks.find(c => c.id === "follow_up")!.status, "fail");
  assert.equal(pending.checks.find(c => c.id === "pipeline")!.status, "unverified");
});
test("empty raw transcript never receives a clean pass", () => {
  const r = groundCallAnalysis(result(), { ...input, transcript: "" });
  assert.equal(r.verdict, "review");
  assert.equal(r.checks.find(c => c.id === "transcript_complete")!.status, "unverified");
});
test("explicit incomplete capture overrides a green model result", () => {
  const r = groundCallAnalysis(result(), { ...input, diagnostics: { transcriptCapture: { status: "partial", expectedEventCount: 8, persistedEventCount: 6, sequenceContinuous: false, hasCaller: true, hasAssistant: true } } });
  assert.equal(r.verdict, "fail");
  assert.equal(r.checks.find(c => c.id === "transcript_complete")!.status, "fail");
});
test("malformed model output is an analysis error rather than a failed customer call", () => {
  assert.throws(() => parseCallAnalysisResult({ summary: "Fine", checks: null, recommendations: [] }));
  const r = result(); r.checks[0] = { ...r.checks[0], status: "fail", evidence: [] };
  assert.throws(() => parseCallAnalysisResult(r), /require evidence/);
});

test("a standalone pipeline incident fails even without an events array", () => {
  const r = groundCallAnalysis(result(), { ...input, diagnostics: { pipelineIncidents: [{ stage: "tts", error_message: "Synthesis failed" }] } });
  assert.equal(r.checks.find(c => c.id === "pipeline")!.status, "fail");
});
test("an unrelated diagnostic field cannot verify latency or tools", () => {
  const r = groundCallAnalysis(result(), { ...input, diagnostics: { greetingPlayed: true } });
  for (const id of ["responsiveness", "tools", "pipeline"]) assert.equal(r.checks.find(c => c.id === id)!.status, "unverified");
});
test("transcript completeness requires the capture journal, not just both speaker labels", () => {
  assert.equal(groundCallAnalysis(result(), { ...input, diagnostics: { transcriptCompleteness: { complete: true } } }).checks.find(c => c.id === "transcript_complete")!.status, "unverified");
  const capture = { status: "captured", expectedEventCount: 2, persistedEventCount: 2, sequenceContinuous: true, hasCaller: true, hasAssistant: true };
  assert.equal(groundCallAnalysis(result(), { ...input, diagnostics: { transcriptCapture: capture } }).checks.find(c => c.id === "transcript_complete")!.status, "pass");
});
