import "server-only";

import { CALL_MEDIA_RETENTION_MS } from "@/lib/call-media-retention";
import type { CallAnalysisResult } from "@/lib/call-analysis-simple";
import { CALL_ANALYSIS_VERSION } from "@/lib/call-analysis-simple";
import { requireAdminPermission } from "@/lib/admin-session";
import { ADMIN_SIM_CALLER_E164 } from "@/lib/admin-demo-call-lines";
import { ADMIN_DEMO_ROOM_PREFIX, isAdminDemoCallRow, isEngineerTestCallRow } from "@/lib/engineer-test-call";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadCallPipelineIncidents } from "@/lib/call-pipeline-incidents";

export const CALL_ANALYSIS_LIST_LIMIT = 200;
export const CALL_ANALYSIS_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrganizationJoin = { name: string } | { name: string }[] | null;

export type AnalysisSummary = Pick<CallAnalysisResult, "summary" | "failedCount" | "unverifiedCount">;

export type AnalysisRecord<Result extends AnalysisSummary = CallAnalysisResult> = {
  call_log_id: string;
  status: "pending" | "running" | "completed" | "error";
  verdict: "pass" | "fail" | "review" | null;
  result: Result | null;
  model: string | null;
  resolved_model: string | null;
  checklist_version: string | null;
  completed_at: string | null;
  next_attempt_at: string | null;
  error_message: string | null;
  source_transcript?: string | null;
  source_diagnostics?: unknown;
};

export type AnalysisCall<Result extends AnalysisSummary = AnalysisSummary> = {
  id: string;
  organization_id: string;
  organization_name: string;
  caller_number: string;
  caller_name: string | null;
  created_at: string;
  duration_seconds: number;
  outcome: string;
  is_test_call: boolean;
  engineer_test_call: boolean;
  analysis: AnalysisRecord<Result> | null;
};

export type AnalysisCallDetail = AnalysisCall<CallAnalysisResult> & {
  transcript: string | null;
  audio_storage_path: string | null;
  post_call_status: string | null;
  post_call_errors: unknown;
  transportSamples: unknown[];
  transportComplete: boolean;
  technicalDiagnostics: {
    pipelineIncidents: { id: string; occurred_at: string; stage: string }[];
    incidentListComplete: boolean;
  };
};

type CallRow = Omit<AnalysisCall, "organization_name" | "analysis"> & {
  organizations: OrganizationJoin;
  room_name: string | null;
  call_sid?: string | null;
};

const CALL_COLUMNS = "id, organization_id, caller_number, caller_name, created_at, duration_seconds, outcome, is_test_call, engineer_test_call, room_name, organizations(name)";
const ANALYSIS_COLUMNS = "call_log_id, status, verdict, model, resolved_model, checklist_version, completed_at, next_attempt_at, error_message";
const ANALYSIS_LIST_COLUMNS = `${ANALYSIS_COLUMNS}, summary:result->>summary, failed_count:result->failedCount, unverified_count:result->unverifiedCount`;
type AnalysisListRecord = Omit<AnalysisRecord, "result"> & {
  summary: string | null;
  failed_count: number | null;
  unverified_count: number | null;
};

function mapCall<Result extends AnalysisSummary>(row: CallRow, analysis: AnalysisRecord<Result> | null): AnalysisCall<Result> {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const { organizations: _organizations, room_name: _roomName, call_sid: _callSid, ...call } = row;
  return { ...call, organization_name: organization?.name || "Unknown customer", analysis };
}

export async function loadCallAnalysisList(): Promise<AnalysisCall[]> {
  await requireAdminPermission("calls");
  const admin = createAdminClient();
  const [ordinary, demos] = await Promise.all([
    admin.from("call_logs")
      .select(CALL_COLUMNS)
      .is("caller_data_erased_at", null)
      .neq("caller_number", "+000000000000")
      .not("engineer_test_call", "is", true)
      .neq("caller_number", ADMIN_SIM_CALLER_E164)
      .or(`room_name.is.null,room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*`)
      .gte("created_at", new Date(Date.now() - CALL_MEDIA_RETENTION_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(CALL_ANALYSIS_LIST_LIMIT),
    admin.from("call_logs")
      .select(CALL_COLUMNS)
      .is("caller_data_erased_at", null)
      .eq("caller_number", ADMIN_SIM_CALLER_E164)
      .like("room_name", `${ADMIN_DEMO_ROOM_PREFIX}%`)
      .gte("created_at", new Date(Date.now() - CALL_MEDIA_RETENTION_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(CALL_ANALYSIS_LIST_LIMIT),
  ]);
  if (ordinary.error || demos.error) throw new Error("Could not load calls for analysis.");
  const calls = ([...(ordinary.data ?? []), ...(demos.data ?? [])] as unknown as CallRow[])
    .filter((call) => !isEngineerTestCallRow(call) || isAdminDemoCallRow(call))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, CALL_ANALYSIS_LIST_LIMIT);
  if (!calls.length) return [];
  const { data: records, error: analysisError } = await admin.from("call_analysis")
    .select(ANALYSIS_LIST_COLUMNS)
    .in("call_log_id", calls.map((call) => call.id));
  if (analysisError) throw new Error("Could not load call analyses. Please try again.");
  const byId = new Map<string, AnalysisRecord<AnalysisSummary>>(
    ((records ?? []) as unknown as AnalysisListRecord[]).map(({ summary, failed_count, unverified_count, ...record }) => [
      record.call_log_id,
      {
        ...record,
        result: summary === null || record.checklist_version !== CALL_ANALYSIS_VERSION ? null : {
          summary,
          failedCount: failed_count ?? 0,
          unverifiedCount: unverified_count ?? 0,
        },
      },
    ]),
  );
  return calls.map((call) => mapCall(call, byId.get(call.id) ?? null));
}

export async function loadCallAnalysisDetail(id: string): Promise<AnalysisCallDetail | null> {
  await requireAdminPermission("calls");
  if (!CALL_ANALYSIS_ID_RE.test(id)) return null;
  const admin = createAdminClient();
  const [callResponse, analysisResponse] = await Promise.all([
    admin.from("call_logs")
      .select(`${CALL_COLUMNS}, call_sid, transcript, audio_storage_path, post_call_status, post_call_errors`)
      .eq("id", id).is("caller_data_erased_at", null).neq("caller_number", "+000000000000")
      .gte("created_at", new Date(Date.now() - CALL_MEDIA_RETENTION_MS).toISOString()).maybeSingle(),
    admin.from("call_analysis")
      .select(`${ANALYSIS_COLUMNS}, result, source_transcript, source_diagnostics`)
      .eq("call_log_id", id).maybeSingle(),
  ]);
  if (callResponse.error || analysisResponse.error) throw new Error("Could not load this call analysis.");
  if (!callResponse.data) return null;
  const row = callResponse.data as unknown as CallRow & Pick<AnalysisCallDetail, "transcript" | "audio_storage_path" | "post_call_status" | "post_call_errors">;
  // Administrators can inspect every retained call from Recent activity.
  const [transport, incidents] = await Promise.all([
    row.room_name ? admin.from("admin_call_transport_samples")
      .select("sample", { count: "exact" }).eq("room_name", row.room_name)
      .order("created_at", { ascending: true }).limit(1000) : Promise.resolve(null),
    loadCallPipelineIncidents(admin, row),
  ]);
  return {
    ...mapCall(row, analysisResponse.data as AnalysisRecord | null),
    transcript: row.transcript,
    audio_storage_path: row.audio_storage_path,
    post_call_status: row.post_call_status,
    post_call_errors: row.post_call_errors,
    transportSamples: transport?.data?.map(row => row.sample) ?? [],
    transportComplete: !transport?.error && (transport?.count ?? 0) <= 1000,
    // Refresh deterministic health independently of the completed AI review.
    technicalDiagnostics: {
      pipelineIncidents: incidents.data.map(({ id, occurred_at, stage }) => ({ id, occurred_at, stage })),
      incidentListComplete: incidents.complete,
    },
  };
}
