export type CallTestHealthStatus = "pass" | "degraded" | "fail";

export type CallTestDiagnosticEvent = {
  atMs: number;
  level: "info" | "warn" | "error";
  tag: string;
  message: string;
  data?: Record<string, unknown>;
};

export type CallTestLatencySnapshot = {
  greetingMs?: number;
  timeToFirstAudioMs?: number;
  replyMs?: number[];
  replyP50?: number;
  replyP95?: number;
  userSpeakingToThinkingMs?: number[];
};

export type CallTestTranscriptCompleteness = {
  complete: boolean;
  reasons: string[];
  callerLineCount: number;
  assistantLineCount: number;
};

export type CallTestPipelineIncident = {
  id: string;
  occurred_at: string;
  stage: string;
  error_message: string;
  model_label: string | null;
  retryable: boolean | null;
  sms_fallback_sent: boolean;
};

export type CallTestTranscriptQa = {
  acceptable: boolean;
  needsReview: boolean;
  agentWentSilent: boolean;
  callerUnanswered: boolean;
  wrongContextDetected: boolean;
  issues: string[];
  summary: string;
};

export type CallCloseDiagnosticsPayload = {
  latency: CallTestLatencySnapshot;
  pipeline?: Record<string, unknown>;
  sessionFlags?: Record<string, unknown>;
  events: CallTestDiagnosticEvent[];
  greetingPlayed: boolean;
  greetingSource?: "cached_pcm" | "live_tts" | null;
  disclosureConfirmed: boolean;
  deploy?: Record<string, string | undefined>;
  transcriptIssues?: string[];
  identifiers?: Record<string, unknown>;
  orgSnapshot?: Record<string, unknown>;
  configSnapshot?: Record<string, unknown>;
  recommendedChecks?: string[];
  toolLines?: string[];
  transcriptCompleteness?: CallTestTranscriptCompleteness;
  transcriptCapture?: {
    status: "captured" | "partial";
    expectedEventCount: number;
    persistedEventCount: number;
    sequenceContinuous: boolean;
    hasCaller: boolean;
    hasAssistant: boolean;
  };
  costEstimate?: Record<string, unknown> | null;
  pipelineIncidents?: CallTestPipelineIncident[];
  postprocessRan?: boolean;
  knowledgeGapCount?: number;
  greetingText?: string | null;
  supabaseDeepLink?: string;
  callLogId?: string;
  transcriptReview?: string | null;
  aiSummary?: string | null;
  capturedAtMs?: number;
  isTestCalledNumber?: boolean;
  transcriptQa?: CallTestTranscriptQa;
};

export type CallTestProfileRow = {
  id: string;
  name: string;
  description: string | null;
  voice_id: string | null;
  llm_model: string | null;
  stt_model: string | null;
  tts_model: string | null;
  llm_provider: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CallTestReportRow = {
  id: string;
  call_log_id: string;
  organization_id: string | null;
  test_profile_id: string | null;
  variant_label: string | null;
  called_number: string | null;
  caller_number: string | null;
  call_sid: string | null;
  room_name: string | null;
  health_status: CallTestHealthStatus;
  health_reason: string | null;
  latency: CallTestLatencySnapshot;
  pipeline_snapshot: Record<string, unknown>;
  diagnostics: CallCloseDiagnosticsPayload;
  error_count: number;
  greeting_played: boolean;
  disclosure_confirmed: boolean;
  duration_seconds: number;
  needs_review: boolean;
  created_at: string;
};

export type CallTestListItem = {
  id: string;
  callLogId: string;
  createdAt: string;
  timeLabel: string;
  variantLabel: string;
  healthStatus: CallTestHealthStatus;
  healthReason: string | null;
  greetingMs: number | null;
  replyP50: number | null;
  errorCount: number;
  durationSeconds: number;
  callerNumber: string;
  orgName: string;
  needsReview: boolean;
};

/** Public Hello Cara demo — website CTA + call-testing dashboard. */
export const TEST_LINE_E164 = "+353749389378";

/** Internal retail QA — Murphy's SuperValu mock; not the public demo line. */
export const INTERNAL_QA_LINE_E164 = "+353109307440";

export function isTestCalledNumber(
  calledNumber: string | null | undefined,
): boolean {
  const raw = calledNumber?.trim().replace(/\s/g, "") ?? "";
  if (!raw) return false;
  if (raw === TEST_LINE_E164) return true;
  const digits = raw.replace(/\D/g, "");
  return digits.endsWith("9378");
}
