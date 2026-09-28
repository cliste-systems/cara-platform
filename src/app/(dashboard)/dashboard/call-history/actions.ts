"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inferCallIntent,
  mapCallLogToRow,
  normalizeCallOutcome,
  OUTCOME_LABELS,
} from "@/lib/call-history-types";
import {
  buildCallerHistoryInsight,
  buildErasedCallerHistoryInsight,
  type CallerHistoryInsight,
} from "@/lib/caller-history-insight";
import {
  ANONYMOUS_CALLER_E164,
  normalizeBlockedCallerE164,
} from "@/lib/blocked-callers";
import {
  ERASED_CALLER_E164,
  pickCallerDataErasureAudit,
} from "@/lib/caller-data-erasure";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { createCallRecordingSignedUrl } from "@/lib/call-recordings-server";
import { isEngineerTestCallRow, ENGINEER_TEST_CALL_CALLER_LABEL } from "@/lib/engineer-test-call";
import { customerCallFilters, customerTicketFilters } from "@/lib/dashboard-customer-data";
import { resolveCallLogIdForTicket } from "@/lib/resolve-ticket-call-log";
import type { PostCallStatus } from "@/lib/post-call-processing-types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CallHistoryDetailPayload = {
  transcriptVerbatim: string;
  transcriptReview: string | null;
} | null;

export type CallDetailDialogPayload = {
  id: string;
  dateTimeLabel: string;
  callerDisplay: string;
  callerName: string | null;
  durationLabel: string;
  durationSeconds: number;
  outcome: ReturnType<typeof normalizeCallOutcome>;
  outcomeLabel: string;
  intentLabel: string;
  aiSummary: string | null;
  transcriptVerbatim: string;
  transcriptReview: string | null;
  postCallStatus: PostCallStatus;
  hasRecording: boolean;
  engineerTestCall: boolean;
};

export type CallRecordingPlaybackResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

const CALLER_HISTORY_CALL_LIMIT = 30;

type CallerHistoryCallRow = {
  id: string;
  caller_name: string | null;
  outcome: string | null;
  ai_summary: string | null;
  duration_seconds: number | null;
  created_at: string;
  post_call_status: string | null;
  caller_data_erased_at: string | null;
};
type CallerHistoryTicketRow = { status: string; summary: string | null; department_slug: string | null };
type CallRecordingRow = {
  audio_storage_path: string | null;
  engineer_test_call: boolean;
  caller_number: string;
  room_name: string | null;
  is_test_call: boolean;
};
type CallDetailRow = {
  id: string;
  caller_number: string;
  caller_name: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  ai_summary: string | null;
  transcript: string | null;
  transcript_review: string | null;
  created_at: string;
  post_call_status: string | null;
  audio_storage_path: string | null;
  engineer_test_call: boolean;
  room_name: string | null;
  is_test_call: boolean;
};

export async function fetchCallerHistoryInsight(input: {
  callerNumber: string;
  currentCallId?: string;
}): Promise<CallerHistoryInsight> {
  const callerNumber = String(input.callerNumber ?? "").trim();
  if (!callerNumber || callerNumber === ANONYMOUS_CALLER_E164) {
    return buildCallerHistoryInsight({
      callerNumber: ANONYMOUS_CALLER_E164,
      calls: [],
      openTickets: [],
      isBlocked: false,
      abuseHitCount: 0,
    });
  }

  const callerE164 = normalizeBlockedCallerE164(callerNumber);
  if (!callerE164) {
    return buildCallerHistoryInsight({
      callerNumber: ANONYMOUS_CALLER_E164,
      calls: [],
      openTickets: [],
      isBlocked: false,
      abuseHitCount: 0,
    });
  }

  const { supabase, organizationId } = await requireDashboardSession();

  if (callerE164 === ERASED_CALLER_E164) {
    return loadErasedCallerHistoryInsight(supabase, organizationId, input.currentCallId);
  }

  // Explicit projection boundaries avoid recursively expanding Supabase result
  // inference across Promise.all. All caller/tenant/test filters remain server-side.
  const callColumns: string = "id, caller_name, outcome, ai_summary, duration_seconds, created_at, post_call_status, caller_data_erased_at";
  const ticketColumns: string = "status, summary, department_slug";
  const [{ data: callRows }, { data: ticketRows }, { data: blockedRow }, { data: abuseRow }] =
    await Promise.all([
      customerCallFilters(supabase.from("call_logs").select(callColumns))
        .filter("organization_id", "eq", organizationId)
        .filter("caller_number", "eq", callerE164)
        .order("created_at", { ascending: false }).limit(CALLER_HISTORY_CALL_LIMIT)
        .overrideTypes<CallerHistoryCallRow[], { merge: false }>(),
      customerTicketFilters(supabase.from("action_tickets").select(ticketColumns))
        .filter("organization_id", "eq", organizationId)
        .filter("caller_number", "eq", callerE164)
        .order("created_at", { ascending: false }).limit(CALLER_HISTORY_CALL_LIMIT)
        .overrideTypes<CallerHistoryTicketRow[], { merge: false }>(),
      supabase.from("blocked_callers").select("id")
        .eq("organization_id", organizationId).eq("caller_e164", callerE164).maybeSingle(),
      supabase.from("caller_abuse_signals").select("hit_count")
        .eq("organization_id", organizationId).eq("caller_number", callerE164).maybeSingle(),
    ]);

  return buildCallerHistoryInsight({
    callerNumber: callerE164,
    calls: (callRows ?? []).filter((row) => !row.caller_data_erased_at).map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at ?? ""),
      callerName: row.caller_name?.trim() || null,
      outcome: String(row.outcome ?? ""),
      aiSummary: row.ai_summary?.trim() || null,
      durationSeconds: Number(row.duration_seconds ?? 0),
      postCallStatus: (row.post_call_status as PostCallStatus) ?? "complete",
    })),
    openTickets: (ticketRows ?? []).map((row) => ({
      status: String(row.status ?? ""),
      summary: String(row.summary ?? ""),
      departmentSlug: row.department_slug?.trim() || null,
    })),
    isBlocked: Boolean(blockedRow),
    abuseHitCount: Number(abuseRow?.hit_count ?? 0),
  });
}

async function loadErasedCallerHistoryInsight(
  supabase: SupabaseClient,
  organizationId: string,
  currentCallId?: string,
): Promise<CallerHistoryInsight> {
  const callId = String(currentCallId ?? "").trim();
  if (!UUID_RE.test(callId)) return buildErasedCallerHistoryInsight(null);
  const { data } = await supabase.from("call_logs")
    .select("caller_data_erased_at, caller_data_erased_by_label, caller_data_erased_reason")
    .eq("id", callId).eq("organization_id", organizationId).maybeSingle();
  return buildErasedCallerHistoryInsight(pickCallerDataErasureAudit({
    callerDataErasedAt: data?.caller_data_erased_at ?? null,
    callerDataErasedByLabel: data?.caller_data_erased_by_label ?? null,
    callerDataErasedReason: data?.caller_data_erased_reason ?? null,
  }));
}

export async function fetchCallRecordingPlaybackUrl(callLogId: string): Promise<CallRecordingPlaybackResult> {
  const id = callLogId.trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Recording not available for this call." };
  const session = await requireDashboardSession();
  const supabase: SupabaseClient = session.supabase;
  const { organizationId } = session;
  const columns: string = "audio_storage_path, engineer_test_call, caller_number, room_name, is_test_call";
  const { data: rows, error } = await supabase.from("call_logs").select(columns)
    .filter("id", "eq", id).filter("organization_id", "eq", organizationId).limit(1)
    .overrideTypes<CallRecordingRow[], { merge: false }>();
  const data = rows?.[0];
  if (error || data?.is_test_call || isEngineerTestCallRow(data ?? {})) {
    return { ok: false, message: "Recording not available for this call." };
  }
  const storagePath = data?.audio_storage_path?.trim();
  if (!storagePath) return { ok: false, message: "Recording not available for this call." };
  const url = await createCallRecordingSignedUrl({ organizationId, callLogId: id, storagePath });
  return url ? { ok: true, url } : { ok: false, message: "Recording not available for this call." };
}

/** Loads transcript fields for one call (list queries omit these to reduce egress). */
export async function fetchCallHistoryDetail(callId: string): Promise<CallHistoryDetailPayload> {
  const detail = await loadCallDetailRow(callId);
  if (!detail) return null;
  if (detail.engineerTestCall) return { transcriptVerbatim: "", transcriptReview: null };
  return { transcriptVerbatim: detail.transcriptVerbatim, transcriptReview: detail.transcriptReview };
}

/** Full call detail for department/action inbox; resolves older ticket links. */
export async function fetchCallDetailForTicket(input: {
  ticketId: string;
  callLogId?: string | null;
}): Promise<CallDetailDialogPayload | null> {
  const ticketId = input.ticketId.trim();
  if (!UUID_RE.test(ticketId)) return null;
  const { supabase, organizationId } = await requireDashboardSession();
  const callLogId = (input.callLogId?.trim() && UUID_RE.test(input.callLogId.trim()) ? input.callLogId.trim() : null)
    ?? (await resolveCallLogIdForTicket(supabase, organizationId, ticketId));
  return callLogId ? loadCallDetailRow(callLogId) : null;
}

async function loadCallDetailRow(callId: string): Promise<CallDetailDialogPayload | null> {
  const id = callId.trim();
  if (!UUID_RE.test(id)) return null;
  const session = await requireDashboardSession();
  const supabase: SupabaseClient = session.supabase;
  const { organizationId } = session;
  const columns: string = "id, caller_number, caller_name, duration_seconds, outcome, ai_summary, transcript, transcript_review, created_at, post_call_status, audio_storage_path, engineer_test_call, room_name, is_test_call";
  // id is a primary key; an array projection avoids recursive nullable override
  // inference while retaining identical tenant-scoped zero-or-one-row semantics.
  const { data: rows, error } = await supabase.from("call_logs").select(columns)
    .filter("id", "eq", id).filter("organization_id", "eq", organizationId).limit(1)
    .overrideTypes<CallDetailRow[], { merge: false }>();
  const data = rows?.[0];
  if (error || !data || data.is_test_call) return null;
  const engineerTestCall = isEngineerTestCallRow(data);
  const mapped = mapCallLogToRow({
    id: String(data.id),
    caller_number: String(data.caller_number ?? ""),
    duration_seconds: Math.max(0, Number(data.duration_seconds ?? 0)),
    outcome: String(data.outcome ?? ""),
    transcript: engineerTestCall ? null : data.transcript ?? null,
    transcript_review: engineerTestCall ? null : data.transcript_review ?? null,
    ai_summary: engineerTestCall ? null : data.ai_summary ?? null,
    created_at: String(data.created_at ?? ""),
  });
  const outcome = normalizeCallOutcome(String(data.outcome ?? ""));
  const aiSummary = engineerTestCall ? null : data.ai_summary?.trim() || null;
  return {
    id: mapped.id,
    dateTimeLabel: mapped.dateTimeLabel,
    callerDisplay: engineerTestCall ? ENGINEER_TEST_CALL_CALLER_LABEL : mapped.callerDisplay || "Unknown number",
    callerName: engineerTestCall ? null : data.caller_name?.trim() || null,
    durationLabel: mapped.durationLabel || "—",
    durationSeconds: Math.max(0, Number(data.duration_seconds ?? 0)),
    outcome,
    outcomeLabel: OUTCOME_LABELS[outcome],
    intentLabel: mapped.intentLabel || inferCallIntent(aiSummary, outcome),
    aiSummary,
    transcriptVerbatim: mapped.transcriptVerbatim,
    transcriptReview: mapped.transcriptReview,
    postCallStatus: (data.post_call_status as PostCallStatus) ?? "complete",
    hasRecording: engineerTestCall ? false : Boolean(data.audio_storage_path?.trim()),
    engineerTestCall,
  };
}
