import test from "node:test";
import assert from "node:assert/strict";
import { CALL_ANALYSIS_QUESTIONS, deriveCallAnalysisVerdict, groundCallAnalysis, parseCallAnalysisResult, type CallAnalysisCheck, type CallAnalysisInput } from "./call-analysis-simple";

const capture = { status: "captured", expectedEventCount: 4, persistedEventCount: 4, sequenceContinuous: true, hasCaller: true, hasAssistant: true };
const input: CallAnalysisInput = {
  transcript: "Caller: Where are you?\nAssistant: On Main Street.\nCaller: Great, thanks.\nAssistant: You're welcome.",
  diagnostics: { transcriptCapture: capture, events: [] }, context: {},
  call: { durationSeconds: 25, outcome: "answered", postCallStatus: "complete", postCallErrors: [], transferConnected: null, expectedTicket: false, hasLinkedTicket: false },
};
const checks = (): CallAnalysisCheck[] => CALL_ANALYSIS_QUESTIONS.map(q => ({
  id: q.id, answer: q.positiveYes ? "yes" : "no", reason: "Supported by the conversation.", evidence: [],
}));
const response = () => ({ summary: "Cara gave the location.", improvement: "No clear improvement from the verified transcript.", checks: checks() });

test("seven questions have the intended good and bad polarity", () => {
  const positive = deriveCallAnalysisVerdict(response());
  assert.equal(positive.verdict, "pass");
  const unresolved = response(); unresolved.checks[0].answer = "no";
  assert.equal(deriveCallAnalysisVerdict(unresolved).verdict, "fail");
  const frustrated = response(); frustrated.checks[1].answer = "yes";
  assert.equal(deriveCallAnalysisVerdict(frustrated).verdict, "fail");
});
test("the answer set must be complete, unique, and evidenced when negative", () => {
  assert.throws(() => parseCallAnalysisResult({ ...response(), checks: checks().slice(1) }), /incomplete/);
  const duplicate = checks(); duplicate[1].id = duplicate[0].id;
  assert.throws(() => parseCallAnalysisResult({ ...response(), checks: duplicate }), /duplicate/);
  const negative = checks(); negative[3].answer = "yes";
  assert.throws(() => parseCallAnalysisResult({ ...response(), checks: negative }), /require evidence/);
});
test("incomplete capture never shows a clean call", () => {
  const reviewed = groundCallAnalysis(parseCallAnalysisResult(response()), { ...input, diagnostics: { events: [] } });
  assert.equal(reviewed.verdict, "review");
  assert.equal(reviewed.checks.find(c => c.id === "resolved_request")?.answer, "unverified");
  assert.equal(reviewed.checks.find(c => c.id === "tool_calls_failed")?.answer, "no");
});
test("recorded tool failures override a model no answer", () => {
  const reviewed = groundCallAnalysis(parseCallAnalysisResult(response()), { ...input, diagnostics: { transcriptCapture: capture, events: [{ tag: "tool_failure", level: "error", message: "Lookup timed out" }] } });
  assert.equal(reviewed.verdict, "fail");
  assert.equal(reviewed.checks.find(c => c.id === "tool_calls_failed")?.answer, "yes");
});
test("a claimed problem without an exact saved excerpt is unverified", () => {
  const raw = response();
  raw.checks[1] = { ...raw.checks[1], answer: "yes", evidence: [{ source: "transcript", quote: "Caller yelled at Cara" }] };
  const reviewed = groundCallAnalysis(parseCallAnalysisResult(raw), input);
  assert.equal(reviewed.checks[1].answer, "unverified");
});
