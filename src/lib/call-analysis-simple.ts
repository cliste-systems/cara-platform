import type { TechnicalCheck } from "./call-technical-health";

/** Plain-language conversation checks, with deterministic technical health. */
export const CALL_ANALYSIS_VERSION = "2026-09-30.1";
export const DEFAULT_CALL_ANALYSIS_MODEL = "gpt-6-sol";
export const getCallAnalysisModel = () => process.env.OPENAI_CALL_ANALYSIS_MODEL?.trim() || DEFAULT_CALL_ANALYSIS_MODEL;
export const CALL_ANALYSIS_QUESTIONS = [
  { id: "resolved_request", label: "Did Cara sort out what the caller rang for?", positiveYes: true },
  { id: "caller_frustrated", label: "Was the caller frustrated?", positiveYes: false },
  { id: "cara_asked_to_repeat", label: "Did Cara ask the caller to repeat themselves a lot?", positiveYes: false },
  { id: "tool_calls_failed", label: "Did any tool calls fail?", positiveYes: false },
  { id: "robotic_repetition", label: "Did Cara repeat the same words or phrases a lot?", positiveYes: false },
  { id: "caller_asked_to_repeat", label: "Did the caller ask Cara to repeat herself a lot?", positiveYes: false },
  { id: "clarification_missing", label: "Did Cara choose an answer before clarifying a broad request?", positiveYes: false },
  { id: "questions_mishandled", label: "Did Cara misunderstand, ignore or incorrectly answer a question?", positiveYes: false },
  { id: "products_mishandled", label: "Did Cara fail to handle a product question correctly?", positiveYes: false },
  { id: "offers_mishandled", label: "Did Cara miss or incorrectly explain an offer?", positiveYes: false },
  { id: "unsupported_claims", label: "Did Cara invent facts, stock, prices or promises?", positiveYes: false },
  { id: "actions_failed", label: "Did a required transfer, message or follow-up fail?", positiveYes: false },
  { id: "reported_audio_problem", label: "Did the caller report static, distortion or missing audio?", positiveYes: false },
  { id: "caller_left_early", label: "Did the caller end the call before Cara solved the issue?", positiveYes: false },
] as const;
export type CallAnalysisCheckId = (typeof CALL_ANALYSIS_QUESTIONS)[number]["id"];
export type CallAnalysisAnswer = "yes" | "no" | "unverified";
export type CallAnalysisVerdict = "pass" | "fail" | "review";
export type CallAnalysisEvidence = { source: "transcript" | "diagnostics" | "context"; quote: string };
export type CallAnalysisCheck = { id: CallAnalysisCheckId; answer: CallAnalysisAnswer; reason: string; evidence: CallAnalysisEvidence[] };
export type CallAnalysisResult = {
  summary: string; improvement: string; checks: CallAnalysisCheck[];
  verdict: CallAnalysisVerdict; failedCount: number; unverifiedCount: number;
  technicalChecks?: TechnicalCheck[];
  evidenceSnapshot?: { diagnostics: Record<string, unknown> | null; context: Record<string, unknown>; call: CallAnalysisInput["call"] };
};
export type CallAnalysisInput = {
  transcript: string; diagnostics: Record<string, unknown> | null; context: Record<string, unknown>;
  call: { durationSeconds: number; outcome: string; postCallStatus: string | null; postCallErrors: unknown;
    transferConnected: boolean | null; expectedTicket: boolean; hasLinkedTicket: boolean };
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function text(value: unknown, name: string, max = 1500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid analysis ${name}.`);
  return value.trim();
}
export function isNegativeAnswer(check: CallAnalysisCheck): boolean {
  const question = CALL_ANALYSIS_QUESTIONS.find(q => q.id === check.id);
  return check.answer !== "unverified" && (question?.positiveYes ? check.answer === "no" : check.answer === "yes");
}
export function deriveCallAnalysisVerdict(result: Pick<CallAnalysisResult, "summary" | "improvement" | "checks"> & { technicalChecks?: TechnicalCheck[] }): CallAnalysisResult {
  const failedCount = result.checks.filter(isNegativeAnswer).length + (result.technicalChecks?.filter(c => c.id !== "tools" && c.status === "fail").length ?? 0);
  const unverifiedCount = result.checks.filter(c => c.answer === "unverified").length + (result.technicalChecks?.filter(c => c.id !== "tools" && c.status === "unknown").length ?? 0);
  return { ...result, failedCount, unverifiedCount, verdict: failedCount ? "fail" : unverifiedCount ? "review" : "pass" };
}
export function parseCallAnalysisResult(value: unknown): CallAnalysisResult {
  if (!object(value) || !Array.isArray(value.checks) || value.checks.length !== CALL_ANALYSIS_QUESTIONS.length) throw new Error("Analysis questions are incomplete.");
  const seen = new Set<string>();
  const checks = value.checks.map((raw): CallAnalysisCheck => {
    if (!object(raw) || typeof raw.id !== "string" || !CALL_ANALYSIS_QUESTIONS.some(q => q.id === raw.id) || seen.has(raw.id)) throw new Error("Invalid or duplicate analysis question.");
    seen.add(raw.id);
    if (!["yes", "no", "unverified"].includes(String(raw.answer)) || !Array.isArray(raw.evidence) || raw.evidence.length > 4) throw new Error("Invalid analysis answer or evidence.");
    const evidence = raw.evidence.map((e): CallAnalysisEvidence => {
      if (!object(e) || !["transcript", "diagnostics", "context"].includes(String(e.source))) throw new Error("Invalid analysis evidence source.");
      return { source: e.source as CallAnalysisEvidence["source"], quote: text(e.quote, "quote") };
    });
    const check = { id: raw.id as CallAnalysisCheckId, answer: raw.answer as CallAnalysisAnswer, reason: text(raw.reason, "reason", 500), evidence };
    if (isNegativeAnswer(check) && !evidence.length) throw new Error("Negative analysis answers require evidence.");
    return check;
  });
  checks.sort((a, b) => CALL_ANALYSIS_QUESTIONS.findIndex(q => q.id === a.id) - CALL_ANALYSIS_QUESTIONS.findIndex(q => q.id === b.id));
  return deriveCallAnalysisVerdict({ summary: text(value.summary, "summary", 500), improvement: text(value.improvement, "improvement", 500), checks });
}
export function groundCallAnalysis(result: CallAnalysisResult, input: CallAnalysisInput): CallAnalysisResult {
  const checks = result.checks.map(c => ({ ...c, evidence: [...c.evidence] }));
  const diagnosticText = JSON.stringify(input.diagnostics ?? {});
  const contextText = JSON.stringify({ ...input.context, call: input.call });
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const replace = (id: CallAnalysisCheckId, answer: CallAnalysisAnswer, reason: string, evidence: CallAnalysisEvidence[] = []) =>
    Object.assign(checks.find(c => c.id === id)!, { answer, reason, evidence });
  for (const check of checks) {
    check.evidence = check.evidence.filter(e => {
      const haystack = e.source === "transcript" ? input.transcript : e.source === "diagnostics" ? diagnosticText : contextText;
      return normalize(haystack).includes(normalize(e.quote)) || normalize(haystack).includes(normalize(JSON.stringify(e.quote).slice(1, -1)));
    });
    if (isNegativeAnswer(check) && !check.evidence.length) replace(check.id, "unverified", "The stated problem has no matching excerpt in the saved evidence.");
  }
  const capture = object(input.diagnostics?.transcriptCapture) ? input.diagnostics.transcriptCapture : null;
  const captureComplete = capture?.status === "captured" && typeof capture.expectedEventCount === "number" &&
    capture.expectedEventCount > 0 && capture.expectedEventCount === capture.persistedEventCount &&
    capture.sequenceContinuous === true && capture.hasCaller === true && capture.hasAssistant === true && capture.readableConversationComplete !== false;
  const transcriptQuestions = CALL_ANALYSIS_QUESTIONS.filter(q => q.id !== "tool_calls_failed").map(q => q.id);
  if (!captureComplete || !input.transcript.trim()) for (const id of transcriptQuestions) {
    const check = checks.find(c => c.id === id)!;
    if (!isNegativeAnswer(check)) replace(id, "unverified", "The complete raw conversation has not been verified. Check the recording and transcript capture.");
  }
  const events = Array.isArray(input.diagnostics?.events) ? input.diagnostics.events : [];
  const toolErrors = events.filter(e => object(e) && e.level === "error" && /tool/i.test(String(e.tag)));
  if (toolErrors.length) replace("tool_calls_failed", "yes", "A tool error was recorded, even if a retry recovered.", [{ source: "diagnostics", quote: JSON.stringify(toolErrors[0]).slice(0, 1500) }]);
  else if (input.diagnostics?.toolEventCoverageComplete !== true) replace("tool_calls_failed", "unverified", "No tool diagnostics were captured for this call.");
  if (input.call.expectedTicket && !input.call.hasLinkedTicket && input.call.postCallStatus !== "pending")
    replace("resolved_request", "no", "A needed follow-up ticket was not saved.", [{ source: "context", quote: '"hasLinkedTicket":false' }]);
  const derived = deriveCallAnalysisVerdict({ ...result, checks });
  if (derived.verdict !== result.verdict) derived.summary = derived.verdict === "fail"
    ? "A confirmed issue needs attention. Open its answer to see the evidence."
    : "Some answers need a complete transcript or diagnostics before they can be confirmed.";
  return derived;
}
