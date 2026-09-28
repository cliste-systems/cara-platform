import "server-only";

import { randomUUID } from "node:crypto";
import { CALL_ANALYSIS_VERSION, getCallAnalysisModel, type CallAnalysisInput, type CallAnalysisVerdict } from "@/lib/call-analysis-simple";
import { evaluateCallAnalysis } from "@/lib/call-analysis-openai";
import { redactCallText } from "@/lib/transcript-redaction";
import { isAdminDemoCallRow, isEngineerTestCallRow } from "@/lib/engineer-test-call";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadCallPipelineIncidents } from "@/lib/call-pipeline-incidents";

type AdminClient = ReturnType<typeof createAdminClient>;
const MAX_ATTEMPTS = 4;
const LEASE_MS = 3 * 60_000;
const POST_CALL_GRACE_MS = 5 * 60_000;
const RETENTION_MS = 30 * 24 * 60 * 60_000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Diagnostic payloads can contain tool arguments: apply the transcript redactor recursively. */
function redactEvidence(value: unknown): unknown {
  if (typeof value === "string") return redactCallText(value).text
    ?.replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, "[REDACTED-API-KEY]")
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]") ?? null;
  if (Array.isArray(value)) return value.map(redactEvidence);
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/api.?key|authorization|access.?token|secret|password|transcriptReview|transcript_review|transcriptQa|aiSummary|ai_summary/i.test(key))
    .map(([key, child]) => [key, redactEvidence(child)]));
}

function sanitizeDiagnostics(value: unknown): Record<string, unknown> | null {
  if (!object(value)) return null;
  // Exclude configuration blobs and derived test verdicts from primary evidence.
  const keys = ["latency", "pipeline", "sessionFlags", "events", "greetingPlayed", "greetingSource", "disclosureConfirmed", "deploy", "toolLines", "transcriptCompleteness", "pipelineIncidents", "postprocessRan", "knowledgeGapCount", "knowledgeGaps", "greetingText", "capturedAtMs", "audioQuality", "transcriptCapture"];
  return redactEvidence(Object.fromEntries(keys.filter(key => key in value).map(key => [key, value[key]]))) as Record<string, unknown>;
}

/** Durable and idempotent. Repeated callbacks enrich one row; they do not create duplicate reviews. */
export async function enqueueCallAnalysis(input: {
  admin?: AdminClient;
  callLogId: string;
  organizationId?: string;
  rawTranscript?: string | null;
  diagnostics?: unknown;
  force?: boolean;
}): Promise<{ queued: boolean }> {
  const admin = input.admin ?? createAdminClient();
  const { data, error } = await admin.rpc("enqueue_call_analysis", {
    p_call_log_id: input.callLogId,
    p_model: getCallAnalysisModel(),
    p_checklist_version: CALL_ANALYSIS_VERSION,
    p_source_transcript: input.rawTranscript == null ? null : redactCallText(input.rawTranscript).text,
    p_source_diagnostics: sanitizeDiagnostics(input.diagnostics),
    p_force: input.force === true,
  });
  if (error) throw new Error("Call analysis could not be queued. Please retry.");
  return { queued: data === true };
}

type QueueRow = {
  call_log_id: string;
  status: "pending" | "running" | "completed" | "error";
  source_transcript: string | null;
  source_diagnostics: Record<string, unknown> | null;
  input_fingerprint: string;
  attempts: number;
  lease_expires_at: string | null;
  next_attempt_at: string | null;
  updated_at: string;
};
type CallRow = {
  id: string; organization_id: string; caller_number: string; created_at: string;
  engineer_test_call: boolean | null;
  caller_data_erased_at: string | null; transcript: string | null;
  duration_seconds: number; outcome: string; post_call_status: string | null;
  post_call_errors: unknown; transfer_connected: boolean | null;
  post_call_expected_ticket: boolean; call_sid: string | null; room_name: string | null;
};

async function loadTranscriptCapture(admin: AdminClient, call: CallRow): Promise<Record<string, unknown> | null> {
  const { data: capture, error } = await admin.from("call_transcript_captures")
    .select("id,status,expected_events,persisted_events,completeness")
    .eq("call_log_id", call.id).eq("organization_id", call.organization_id)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { status: "unavailable", verificationError: "The persisted transcript capture could not be checked." };
  if (!capture) return null;
  const [first, last, callers, assistants] = await Promise.all([
    admin.from("call_transcript_events").select("seq", { count: "exact" }).eq("capture_id", capture.id).order("seq").limit(1),
    admin.from("call_transcript_events").select("seq").eq("capture_id", capture.id).order("seq", { ascending: false }).limit(1),
    admin.from("call_transcript_events").select("seq", { count: "exact", head: true }).eq("capture_id", capture.id).eq("speaker", "caller"),
    admin.from("call_transcript_events").select("seq", { count: "exact", head: true }).eq("capture_id", capture.id).eq("speaker", "assistant"),
  ]);
  if (first.error || last.error || callers.error || assistants.error) return { status: "unavailable", verificationError: "The persisted transcript sequence could not be checked." };
  const count = first.count ?? 0;
  const firstSeq = first.data?.[0]?.seq;
  const lastSeq = last.data?.[0]?.seq;
  return {
    status: capture.status,
    expectedEventCount: capture.expected_events,
    persistedEventCount: count,
    reportedPersistedEventCount: capture.persisted_events,
    // (capture_id,seq) is unique. Count plus endpoints proves no missing sequence.
    sequenceContinuous: count > 0 && firstSeq === 1 && lastSeq === count,
    hasCaller: (callers.count ?? 0) > 0,
    hasAssistant: (assistants.count ?? 0) > 0,
    completeness: capture.completeness,
    source: "persisted_transcript_journal",
  };
}

async function loadEvidence(admin: AdminClient, call: CallRow, queue: QueueRow): Promise<CallAnalysisInput> {
  const [organization, services, tickets, incidents, transcriptCapture, historicalReport] = await Promise.all([
    admin.from("organizations").select("name,niche,business_knowledge_summary,agent_faqs,agent_opening_hours,agent_services_departments,agent_services_not_offered,agent_business_rules,agent_cara_rules,agent_cara_conduct,agent_details_to_collect,agent_service_area,agent_extra_notes,agent_service_catalog_supplement,quote_prices_on_calls,cara_goal,offers_synced_at,catalog_synced_at").eq("id", call.organization_id).maybeSingle(),
    admin.from("services").select("name,category,price,duration_minutes").eq("organization_id", call.organization_id).order("name").limit(101),
    admin.from("action_tickets").select("id,status,delivery_status,summary,brief_summary,department_slug").eq("call_log_id", call.id).limit(50),
    // Only exact call identifiers; nearby unrelated incidents are not evidence.
    loadCallPipelineIncidents(admin, call),
    loadTranscriptCapture(admin, call),
    !queue.source_diagnostics || Object.keys(queue.source_diagnostics).length === 0
      ? admin.from("call_test_reports").select("diagnostics").eq("call_log_id", call.id).eq("organization_id", call.organization_id).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (organization.error || services.error || tickets.error || incidents.error) {
    throw new Error("Call evidence could not be loaded. Please retry analysis.");
  }
  const storedDiagnostics = sanitizeDiagnostics(queue.source_diagnostics);
  const diagnostics = storedDiagnostics && Object.keys(storedDiagnostics).length
    ? storedDiagnostics : sanitizeDiagnostics(historicalReport.data?.diagnostics) ?? {};
  if (historicalReport.data) {
    // Legacy reports synthesize outage guesses when worker telemetry is missing.
    // Those guesses and their transcript QA verdicts are not observed events.
    if (Array.isArray(diagnostics.events)) diagnostics.events = diagnostics.events.filter(event =>
      !object(event) || (!String(event.tag ?? "").startsWith("inferred_") && (!object(event.data) || event.data.source !== "server_inferred")));
    diagnostics.historicalReportNote = "Fallback from the original call test report. Derived transcript QA and server-inferred outage events are excluded. A default greeting flag does not prove whether audio played.";
  }
  if (historicalReport.error) diagnostics.historicalReportNote = "The historical call test report could not be loaded; that evidence is unavailable.";
  diagnostics.pipelineIncidents = redactEvidence(incidents.data);
  diagnostics.incidentListComplete = incidents.complete;
  if (transcriptCapture) diagnostics.transcriptCapture = redactEvidence(transcriptCapture);
  return {
    transcript: redactCallText(queue.source_transcript ?? call.transcript ?? "").text ?? "",
    diagnostics: Object.keys(diagnostics).length ? diagnostics : null,
    context: redactEvidence({
      businessKnowledgeBasis: "Current business settings at analysis time, NOT a historical snapshot. A difference from today's facts is not proof that a past answer was incorrect. Use tool results captured during the call for historical products and offers.",
      businessKnowledge: organization.data,
      currentServices: services.data ?? [],
      currentServicesComplete: (services.data?.length ?? 0) < 101,
      linkedTickets: tickets.data ?? [],
      linkedTicketsComplete: (tickets.data?.length ?? 0) < 50,
      historicalProductAndOfferEvidence: "Only captured tool lines/diagnostic tool results are call-time product and offer evidence. Current catalogue sync timestamps do not establish product availability or a historical offer.",
      callCreatedAt: call.created_at,
    }) as Record<string, unknown>,
    call: {
      durationSeconds: call.duration_seconds ?? 0,
      outcome: call.outcome ?? "unknown",
      postCallStatus: call.post_call_status,
      postCallErrors: redactEvidence(call.post_call_errors),
      transferConnected: call.transfer_connected,
      expectedTicket: call.post_call_expected_ticket === true,
      hasLinkedTicket: (tickets.data?.length ?? 0) > 0,
    },
  };
}

function safeAnalysisError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  // These prefixes are application-owned messages, not provider/database error bodies.
  if (/^(Call analysis is not configured:|OpenAI rejected the analysis API key\.|OpenAI is temporarily rate limited;|OpenAI credits are exhausted\.|OpenAI call analysis request failed \(HTTP \d{3}\)\.|OpenAI did not complete the full checklist\.|OpenAI could not review this call\.|OpenAI returned an unreadable checklist\.|Call evidence exceeds the analysis limit;|Call evidence could not be loaded\.)/.test(message)) return message.slice(0, 250);
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "Call analysis timed out. It will be retried automatically.";
  return "Call analysis could not complete a valid checklist. Please retry or review the call manually.";
}

export type CallAnalysisRunResult = { status: "completed" | "error" | "skipped" | "deferred"; verdict?: CallAnalysisVerdict };

/** Compare-and-set lease keeps concurrent webhook, cron and admin requests from duplicating work. */
export async function runCallAnalysis(callLogId: string, options: { admin?: AdminClient; force?: boolean } = {}): Promise<CallAnalysisRunResult> {
  const admin = options.admin ?? createAdminClient();
  if (options.force) await enqueueCallAnalysis({ admin, callLogId, force: true });
  const [queueResult, callResult] = await Promise.all([
    admin.from("call_analysis").select("call_log_id,status,source_transcript,source_diagnostics,input_fingerprint,attempts,lease_expires_at,next_attempt_at,updated_at").eq("call_log_id", callLogId).maybeSingle(),
    admin.from("call_logs").select("id,organization_id,caller_number,created_at,caller_data_erased_at,transcript,duration_seconds,outcome,post_call_status,post_call_errors,transfer_connected,post_call_expected_ticket,call_sid,room_name,engineer_test_call").eq("id", callLogId).maybeSingle(),
  ]);
  if (queueResult.error || callResult.error) throw new Error("Call evidence could not be loaded. Please retry analysis.");
  const row = queueResult.data as QueueRow | null;
  const call = callResult.data as CallRow | null;
  if (!row || !call) return { status: "skipped" };
  const now = Date.now();
  if ((isEngineerTestCallRow(call) && !isAdminDemoCallRow(call)) || call.caller_data_erased_at || call.caller_number === "+000000000000" || Date.parse(call.created_at) < now - RETENTION_MS) {
    const { error } = await admin.from("call_analysis").delete().eq("call_log_id", callLogId);
    if (error) throw new Error("Call analysis retention cleanup could not complete.");
    return { status: "skipped" };
  }
  if (row.status === "running" && row.attempts >= MAX_ATTEMPTS && Date.parse(row.lease_expires_at ?? "") <= now) {
    const { error } = await admin.from("call_analysis").update({ status: "error", error_message: "Call analysis exhausted its automatic retries. Please retry or review manually.", lease_token: null, lease_expires_at: null, next_attempt_at: null, updated_at: new Date().toISOString() }).eq("call_log_id", callLogId).eq("updated_at", row.updated_at);
    if (error) throw new Error("Call analysis retry status could not be saved.");
    return { status: "error" };
  }
  if (row.status === "completed" || row.attempts >= MAX_ATTEMPTS ||
      (row.status === "running" && Date.parse(row.lease_expires_at ?? "") > now) ||
      (row.next_attempt_at && Date.parse(row.next_attempt_at) > now)) return { status: "skipped" };
  if (call.post_call_status === "pending" && Date.parse(call.created_at) > now - POST_CALL_GRACE_MS) {
    await admin.from("call_analysis").update({ next_attempt_at: new Date(now + 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("call_log_id", callLogId).eq("updated_at", row.updated_at);
    return { status: "deferred" };
  }
  const leaseToken = randomUUID();
  const { data: claimed, error: claimError } = await admin.from("call_analysis").update({
    status: "running", attempts: row.attempts + 1, lease_token: leaseToken,
    lease_expires_at: new Date(now + LEASE_MS).toISOString(), next_attempt_at: null,
    error_message: null, updated_at: new Date().toISOString(),
  }).eq("call_log_id", callLogId).eq("updated_at", row.updated_at).select("call_log_id").maybeSingle();
  if (claimError) throw new Error("Call analysis could not start. Please retry.");
  if (!claimed) return { status: "skipped" };
  try {
    const input = await loadEvidence(admin, call, row);
    // The erasure trigger deletes the row even while a model request is running.
    // Re-check ownership after loading context, then only update this exact lease.
    const { data: stillOwned, error: ownershipError } = await admin.from("call_analysis").select("call_log_id").eq("call_log_id", callLogId).eq("lease_token", leaseToken).maybeSingle();
    if (ownershipError) throw new Error("Call evidence could not be loaded. Please retry analysis.");
    if (!stillOwned) return { status: "skipped" };
    const evaluated = await evaluateCallAnalysis(input);
    const { data: saved, error } = await admin.from("call_analysis").update({
      status: "completed", result: redactEvidence({ ...evaluated.result,
        evidenceSnapshot: { diagnostics: input.diagnostics, context: input.context, call: input.call },
      }), verdict: evaluated.result.verdict,
      model: getCallAnalysisModel(), resolved_model: evaluated.model, checklist_version: CALL_ANALYSIS_VERSION,
      usage: evaluated.usage, lease_token: null, lease_expires_at: null, next_attempt_at: null,
      error_message: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("call_log_id", callLogId).eq("lease_token", leaseToken).eq("input_fingerprint", row.input_fingerprint).select("call_log_id").maybeSingle();
    if (error) throw new Error("Call analysis result could not be saved.");
    return saved ? { status: "completed", verdict: evaluated.result.verdict } : { status: "skipped" };
  } catch (error) {
    const attempts = row.attempts + 1;
    const creditExhausted = error instanceof Error && error.message.startsWith("OpenAI credits are exhausted.");
    const { error: saveError } = await admin.from("call_analysis").update({
      status: "error", error_message: safeAnalysisError(error),
      lease_token: null, lease_expires_at: null,
      next_attempt_at: !creditExhausted && attempts < MAX_ATTEMPTS ? new Date(Date.now() + 60_000 * 2 ** (attempts - 1)).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("call_log_id", callLogId).eq("lease_token", leaseToken);
    if (saveError) throw new Error("Call analysis retry status could not be saved.");
    return { status: "error" };
  }
}

/** Process only existing queue rows, never automatically backfill historic calls. */
export async function processPendingCallAnalyses(options: { limit?: number; admin?: AdminClient } = {}) {
  const admin = options.admin ?? createAdminClient();
  const limit = Math.max(1, Math.min(options.limit ?? 3, 5));
  const now = new Date().toISOString();
  const { data, error } = await admin.from("call_analysis").select("call_log_id")
    .or(`and(status.in.(pending,error),attempts.lt.${MAX_ATTEMPTS},next_attempt_at.lte.${now}),and(status.eq.running,lease_expires_at.lte.${now})`)
    .order("created_at").limit(limit);
  if (error) throw new Error("The call analysis queue could not be loaded.");
  const results = await Promise.allSettled((data ?? []).map(row => runCallAnalysis(String(row.call_log_id), { admin })));
  return {
    processed: results.length,
    completed: results.filter(r => r.status === "fulfilled" && r.value.status === "completed").length,
    errors: results.filter(r => r.status === "rejected" || r.value.status === "error").length,
    deferred: results.filter(r => r.status === "fulfilled" && r.value.status === "deferred").length,
  };
}
