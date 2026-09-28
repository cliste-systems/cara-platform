/** Shared, browser-safe quality review contract. Verdicts are calculated in code. */
export const CALL_ANALYSIS_VERSION = "2026-09-28.1";
export const DEFAULT_CALL_ANALYSIS_MODEL = "gpt-6-sol";
export function getCallAnalysisModel(): string {
  return process.env.OPENAI_CALL_ANALYSIS_MODEL?.trim() || DEFAULT_CALL_ANALYSIS_MODEL;
}

export const CALL_ANALYSIS_CHECKLIST = [
  { id: "transcript_complete", label: "Conversation captured", category: "Technical", description: "The raw transcript contains enough of both sides to review the call, without known capture gaps." },
  { id: "question_handling", label: "Questions understood and answered", category: "Conversation", description: "Cara addressed the actual request, clarified ambiguity, and answered every substantive question." },
  { id: "caller_frustration", label: "Caller frustration handled", category: "Conversation", description: "Cara noticed confusion or frustration, acknowledged it, and made a useful recovery." },
  { id: "conversation_flow", label: "Clear, natural conversation", category: "Conversation", description: "No loops, unnecessary repetition, ignored corrections, or confusing replies." },
  { id: "call_ending", label: "Call ended appropriately", category: "Conversation", description: "No unexplained cutoff or unresolved caller request at the end. A caller saying goodbye last is normal." },
  { id: "business_accuracy", label: "Business facts and rules correct", category: "Knowledge", description: "Answers match available business knowledge, opening hours, location and handling rules." },
  { id: "products", label: "Product questions handled", category: "Knowledge", description: "Product, availability and price claims are supported by the information returned to Cara." },
  { id: "offers", label: "Offers explained correctly", category: "Knowledge", description: "Promotions, dates, prices, quantities and loyalty conditions match the evidence available during the call." },
  { id: "honesty", label: "No invented facts or promises", category: "Knowledge", description: "Cara did not guess unknown facts, claim unsupported stock, or promise actions she did not complete." },
  { id: "tools", label: "Tools completed successfully", category: "Actions", description: "Requested lookups and actions completed without errors, timeouts or incorrect arguments." },
  { id: "handoff", label: "Transfers and escalation handled", category: "Actions", description: "Required human handoffs were attempted correctly and Cara described the actual outcome accurately." },
  { id: "follow_up", label: "Promised follow-up recorded", category: "Actions", description: "Required messages, bookings, tickets and callbacks exist, with the requested details." },
  { id: "privacy", label: "Privacy and business boundaries respected", category: "Conversation", description: "Cara respected the supplied disclosure and handling rules without requesting unnecessary sensitive data." },
  { id: "responsiveness", label: "No unexplained silence or delay", category: "Technical", description: "Timing evidence and conversation show no unanswered speech or excessive delays." },
  { id: "audio", label: "No reported audio problems", category: "Technical", description: "Review caller reports and explicit audio diagnostics for static, clipping, missing audio or distortion. Transcript alone cannot certify audio." },
  { id: "pipeline", label: "Voice and post-call processing healthy", category: "Technical", description: "No recorded speech recognition, model, speech synthesis or post-call processing failure." },
] as const;
export type CallAnalysisCheckId = (typeof CALL_ANALYSIS_CHECKLIST)[number]["id"];
export type CallAnalysisCheckStatus = "pass" | "fail" | "unverified" | "not_applicable";
export type CallAnalysisVerdict = "pass" | "fail" | "review";
export type CallAnalysisEvidence = { source: "transcript" | "diagnostics" | "context"; quote: string };
export type CallAnalysisCheck = {
  id: CallAnalysisCheckId;
  status: CallAnalysisCheckStatus;
  reason: string;
  evidence: CallAnalysisEvidence[];
  recommendation: string | null;
};
export type CallAnalysisResult = {
  summary: string;
  checks: CallAnalysisCheck[];
  recommendations: string[];
  verdict: CallAnalysisVerdict;
  failedCount: number;
  unverifiedCount: number;
  /** Redacted inputs retained for an admin to inspect the evidence behind a saved review. */
  evidenceSnapshot?: {
    diagnostics: Record<string, unknown> | null;
    context: Record<string, unknown>;
    call: CallAnalysisInput["call"];
  };
};
export type CallAnalysisInput = {
  transcript: string;
  diagnostics: Record<string, unknown> | null;
  context: Record<string, unknown>;
  call: {
    durationSeconds: number;
    outcome: string;
    postCallStatus: string | null;
    postCallErrors: unknown;
    transferConnected: boolean | null;
    expectedTicket: boolean;
    hasLinkedTicket: boolean;
  };
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function text(value: unknown, name: string, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid analysis ${name}.`);
  return value.trim();
}
const STATUSES = new Set(["pass", "fail", "unverified", "not_applicable"]);
const SOURCES = new Set(["transcript", "diagnostics", "context"]);

/** Validate semantic invariants even with strict JSON output; the model never sets the verdict. */
export function parseCallAnalysisResult(value: unknown): CallAnalysisResult {
  if (!object(value) || !Array.isArray(value.checks) || !Array.isArray(value.recommendations)) throw new Error("Invalid analysis response.");
  if (value.checks.length !== CALL_ANALYSIS_CHECKLIST.length) throw new Error("Analysis checklist is incomplete.");
  const seen = new Set<string>();
  const checks = value.checks.map((raw): CallAnalysisCheck => {
    if (!object(raw) || typeof raw.id !== "string" || !CALL_ANALYSIS_CHECKLIST.some(c => c.id === raw.id) || seen.has(raw.id)) throw new Error("Invalid or duplicate analysis check.");
    seen.add(raw.id);
    if (typeof raw.status !== "string" || !STATUSES.has(raw.status) || !Array.isArray(raw.evidence) || raw.evidence.length > 6) throw new Error("Invalid analysis check status or evidence.");
    const evidence = raw.evidence.map((e): CallAnalysisEvidence => {
      if (!object(e) || typeof e.source !== "string" || !SOURCES.has(e.source)) throw new Error("Invalid analysis evidence source.");
      return { source: e.source as CallAnalysisEvidence["source"], quote: text(e.quote, "quote", 1500) };
    });
    if (raw.status === "fail" && evidence.length === 0) throw new Error("Failed analysis checks require evidence.");
    return {
      id: raw.id as CallAnalysisCheckId,
      status: raw.status as CallAnalysisCheckStatus,
      reason: text(raw.reason, "reason"), evidence,
      recommendation: raw.recommendation === null ? null : text(raw.recommendation, "recommendation"),
    };
  });
  checks.sort((a, b) => CALL_ANALYSIS_CHECKLIST.findIndex(c => c.id === a.id) - CALL_ANALYSIS_CHECKLIST.findIndex(c => c.id === b.id));
  if (value.recommendations.length > 10) throw new Error("Too many analysis recommendations.");
  return deriveCallAnalysisVerdict({ summary: text(value.summary, "summary"), checks, recommendations: value.recommendations.map(r => text(r, "recommendation")) });
}

export function deriveCallAnalysisVerdict(result: Pick<CallAnalysisResult, "summary" | "checks" | "recommendations">): CallAnalysisResult {
  const failedCount = result.checks.filter(c => c.status === "fail").length;
  const unverifiedCount = result.checks.filter(c => c.status === "unverified").length;
  return { ...result, failedCount, unverifiedCount, verdict: failedCount ? "fail" : unverifiedCount ? "review" : "pass" };
}

/** Enforce evidence boundaries so absent diagnostics cannot silently turn green. */
export function groundCallAnalysis(result: CallAnalysisResult, input: CallAnalysisInput): CallAnalysisResult {
  const checks = result.checks.map(c => ({ ...c, evidence: [...c.evidence] }));
  const diagnosticText = JSON.stringify(input.diagnostics ?? {});
  const contextText = JSON.stringify({ ...input.context, call: input.call });
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const replace = (id: CallAnalysisCheckId, status: CallAnalysisCheckStatus, reason: string, evidence: CallAnalysisEvidence[] = [], recommendation: string | null = null) => {
    Object.assign(checks.find(c => c.id === id)!, { status, reason, evidence, recommendation });
  };
  for (const check of checks) {
    // Quotes are exact excerpts, never invented paraphrases or instructions from the call.
    check.evidence = check.evidence.filter(e => {
      const haystack = e.source === "transcript" ? input.transcript : e.source === "diagnostics" ? diagnosticText : contextText;
      return normalize(haystack).includes(normalize(e.quote)) || normalize(haystack).includes(normalize(JSON.stringify(e.quote).slice(1, -1)));
    });
    if ((check.status === "fail" || check.status === "pass") && check.evidence.length === 0) {
      replace(check.id, "unverified", "The reviewer did not provide a verifiable excerpt for this check.");
    }
  }
  const d = input.diagnostics;
  if (!input.transcript.trim()) {
    for (const c of checks) if (c.evidence.every(e => e.source === "transcript")) replace(c.id, "unverified", "No raw transcript was captured for this call.");
    replace("transcript_complete", "unverified", "No raw transcript was captured for this call.");
  }
  const capture = object(d?.transcriptCapture) ? d.transcriptCapture : null;
  const captureComplete = capture?.status === "captured" &&
    typeof capture.expectedEventCount === "number" && capture.expectedEventCount > 0 &&
    capture.expectedEventCount === capture.persistedEventCount &&
    capture.sequenceContinuous === true && capture.hasCaller === true && capture.hasAssistant === true;
  if (capture && (capture.status === "partial" || capture.sequenceContinuous === false ||
    (typeof capture.expectedEventCount === "number" && typeof capture.persistedEventCount === "number" && capture.expectedEventCount !== capture.persistedEventCount))) {
    replace("transcript_complete", "fail", "The transcript journal reported missing events or an incomplete capture.", [{ source: "diagnostics", quote: JSON.stringify(capture).slice(0, 1500) }], "Inspect the raw event sequence and the call recording before relying on this review.");
  } else if (!captureComplete && checks.find(c => c.id === "transcript_complete")!.status !== "fail") {
    replace("transcript_complete", "unverified", "The saved evidence does not confirm complete capture, matching event counts, continuous sequencing and both speakers.", [], "Verify the transcript journal and recording before treating this as a complete call review.");
  }
  const technicalCoverage: Record<"tools" | "responsiveness" | "pipeline", boolean> = {
    tools: !!d && (Array.isArray(d.toolLines) || Array.isArray(d.events)),
    responsiveness: !!d && object(d.latency) && Object.values(d.latency).some(v => typeof v === "number" || (Array.isArray(v) && v.length > 0)),
    pipeline: !!d && Array.isArray(d.events) && object(d.pipeline) && input.call.postCallStatus === "complete",
  };
  for (const id of ["tools", "responsiveness", "pipeline"] as const) {
    const c = checks.find(c => c.id === id)!;
    if (!technicalCoverage[id] && (c.status === "pass" || c.status === "not_applicable")) replace(id, "unverified", "The diagnostic evidence needed to verify this technical check was not captured.");
  }
  // Text reviews never certify a waveform. A named, explicit audio quality
  // measurement is required; a tag containing 'static' may describe a cache.
  const audio = checks.find(c => c.id === "audio")!;
  const quality = object(d?.audioQuality) ? d.audioQuality : null;
  const audioMeasuredClear = quality?.measured === true && ["pass", "clear", "good"].includes(String(quality.status));
  if ((audio.status === "pass" || audio.status === "not_applicable") && (!audioMeasuredClear || !audio.evidence.some(e => e.source === "diagnostics"))) {
    replace("audio", "unverified", "Audio quality was not measured. Static, clipping and distortion cannot be ruled out from a transcript.", [], "Listen to the call recording if audio quality is in doubt.");
  }
  if (input.call.postCallStatus === "failed" || input.call.postCallStatus === "partial") {
    replace("pipeline", "fail", "Post-call processing recorded a failure.", [{ source: "context", quote: `"postCallStatus":"${input.call.postCallStatus}"` }], "Review the recorded post-call errors and retry the failed operation.");
  }
  if (input.call.expectedTicket && !input.call.hasLinkedTicket && input.call.postCallStatus !== "pending") {
    replace("follow_up", "fail", "A follow-up ticket was required but no linked ticket was saved.", [{ source: "context", quote: '"hasLinkedTicket":false' }], "Recover the missing ticket and verify its caller details.");
  }
  if (input.call.postCallStatus === "pending") replace("pipeline", "unverified", "Post-call processing has not finished yet.");
  if (d && Array.isArray(d.events)) {
    const toolErrors = d.events.filter(e => object(e) && e.level === "error" && /tool/i.test(String(e.tag)));
    if (toolErrors.length) replace("tools", "fail", "A tool error was recorded during this call, even if a later retry recovered.", [{ source: "diagnostics", quote: JSON.stringify(toolErrors[0]).slice(0, 1500) }], "Inspect the failed tool and its arguments; verify whether recovery completed the caller's request.");
  }
  const pipelineErrors = d && Array.isArray(d.pipelineIncidents) ? d.pipelineIncidents : [];
  if (pipelineErrors.length) replace("pipeline", "fail", "A voice pipeline incident was recorded for this call.", [{ source: "diagnostics", quote: JSON.stringify(pipelineErrors[0]).slice(0, 1500) }], "Inspect the failing speech, model or synthesis stage.");
  const derived = deriveCallAnalysisVerdict({ ...result, checks });
  if (derived.verdict !== result.verdict) derived.summary = derived.verdict === "fail" ? "This call failed one or more checklist checks. Review the evidence and suggested fixes below." : "Some checks could not be verified from the available evidence. Review the unchecked items below.";
  return derived;
}
