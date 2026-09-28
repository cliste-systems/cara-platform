import { redirect } from "next/navigation";

import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import {
  OUTCOME_LABELS,
  inferCallIntent,
  mapCallLogToRow,
  normalizeCallOutcome,
} from "@/lib/call-history-types";
import {
  CALL_HISTORY_OPEN_TICKET_LIMIT,
  CALL_HISTORY_PAGE_SIZE,
} from "@/lib/dashboard-list-limits";
import {
  callsPageDateForTimestamp,
  callsPageDateGreetingSubline,
  formatCallsPageDateParam,
  getCallsPageDayBoundsIso,
  parseCallsPageDateParam,
} from "@/lib/calls-page-date";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { normalizeBlockedCallerE164 } from "@/lib/blocked-callers";
import { buildCallsPageHref } from "@/lib/calls-page-href";
import {
  customerCallFilters,
  customerTicketFilters,
  ENGINEER_CALL_FILTER,
} from "@/lib/dashboard-customer-data";

import {
  ENGINEER_TEST_CALL_CALLER_LABEL,
  ENGINEER_TEST_CALL_SUMMARY,
  isEngineerTestCallRow,
} from "@/lib/engineer-test-call";
import { assignOpenTicketsToCalls } from "@/lib/call-history-follow-up";
import { resolveCallHistoryNeedsAttention, normalizeCallResolution } from "@/lib/call-history-status";
import { resolveCallDepartmentLink } from "@/lib/call-department-link";
import { resolveCallAttentionLevel } from "@/lib/call-attention-level";
import type { ActionCategory } from "../action-inbox/categories";
import { classifyActionCategory } from "../action-inbox/categories";

import {
  buildCallHistoryMetricsFromSummaryRows,
  collapseEngineerTestCallsForList,
  type CallFollowUp,
  type CallHistoryListItem,
  callSummaryForDisplay,
} from "./call-history-helpers";
import type { PostCallStatus } from "@/lib/post-call-processing-types";
import { CallHistoryPageContent } from "./call-history-page-content";
import { CallHistoryPageSections } from "./call-history-page-sections";

export const dynamic = "force-dynamic";

type CallHistoryPageProps = {
  searchParams?: Promise<{ call?: string; date?: string; range?: string; page?: string }>;
};

type CallLogListRow = {
  id: string;
  caller_number: string;
  caller_name?: string | null;
  duration_seconds: number;
  outcome: string;
  ai_summary: string | null;
  call_resolution?: string | null;
  created_at: string;
  post_call_status?: string | null;
  audio_storage_path?: string | null;
  caller_data_erased_at?: string | null;
  caller_data_erased_by_label?: string | null;
  caller_data_erased_reason?: string | null;
  engineer_test_call?: boolean | null;
  room_name?: string | null;
};

type CallLogMetricsRow = {
  outcome: string;
  duration_seconds: number;
};

type TicketDbRow = {
  id: string;
  caller_number: string;
  caller_name?: string | null;
  summary: string;
  status: string;
  created_at: string;
};

type CallLinkRow = {
  id: string;
  caller_number: string;
  created_at: string;
  outcome: string;
  ai_summary: string | null;
  call_resolution?: string | null;
  post_call_status?: string | null;
};

const CALL_LIST_COLUMNS =
  "id, caller_number, caller_name, duration_seconds, outcome, ai_summary, call_resolution, created_at, post_call_status, audio_storage_path, caller_data_erased_at, caller_data_erased_by_label, caller_data_erased_reason, engineer_test_call, room_name";

function parsePageParam(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function toListItem(
  row: CallLogListRow,
  followUpByCallId: Map<string, CallFollowUp>,
  businessName: string,
  blockedSet: Set<string>,
): CallHistoryListItem {
  const mapped = mapCallLogToRow({
    ...row,
    transcript: null,
    transcript_review: null,
  });
  const followUp = followUpByCallId.get(row.id) ?? null;
  const outcome = normalizeCallOutcome(row.outcome);
  const attentionLevel = resolveCallAttentionLevel({
    hasOpenAction: Boolean(followUp),
    postCallStatus: (row.post_call_status as PostCallStatus) ?? "complete",
    aiSummary: mapped.aiSummary,
    followUpSummary: followUp?.summary,
    outcome,
  });
  const summaryForCategory = followUp?.summary?.trim() || mapped.aiSummary?.trim() || "";
  const actionCategory: ActionCategory | null =
    attentionLevel !== "routine" && summaryForCategory
      ? classifyActionCategory(summaryForCategory)
      : null;
  const engineerTestCall = isEngineerTestCallRow(row);
  const item: CallHistoryListItem = {
    id: mapped.id,
    createdAt: row.created_at,
    dateTimeLabel: mapped.dateTimeLabel,
    callerId: mapped.callerId,
    callerDisplay: mapped.callerDisplay || "Unknown number",
    callerName: row.caller_name?.trim() || null,
    durationSeconds: Math.max(0, row.duration_seconds ?? 0),
    durationLabel: mapped.durationLabel || "—",
    outcome,
    outcomeLabel: OUTCOME_LABELS[outcome],
    intentLabel: mapped.intentLabel || inferCallIntent(mapped.aiSummary, outcome),
    summaryPreview: null,
    transcriptVerbatim: "",
    transcriptReview: null,
    aiSummary: mapped.aiSummary,
    hasOpenAction: Boolean(followUp),
    followUp,
    postCallStatus: (row.post_call_status as PostCallStatus) ?? "complete",
    hasRecording: Boolean(row.audio_storage_path?.trim()),
    departmentLink: resolveCallDepartmentLink({
      aiSummary: mapped.aiSummary,
      followUpSummary: followUp?.summary,
      followUpTicketId: followUp?.id,
    }),
    attentionLevel,
    actionCategory,
    callResolution: normalizeCallResolution(row.call_resolution),
    callerDataErasedAt: row.caller_data_erased_at ?? null,
    callerDataErasedByLabel: row.caller_data_erased_by_label ?? null,
    callerDataErasedReason: row.caller_data_erased_reason ?? null,
    engineerTestCall,
  };
  if (engineerTestCall) {
    item.callerDisplay = ENGINEER_TEST_CALL_CALLER_LABEL;
    item.callerName = null;
    item.aiSummary = null;
    item.hasRecording = false;
    item.attentionLevel = "routine";
    item.hasOpenAction = false;
    item.followUp = null;
    item.departmentLink = null;
    item.actionCategory = null;
    item.outcomeLabel = "Test";
    item.summaryPreview = ENGINEER_TEST_CALL_SUMMARY;
    return item;
  }
  item.summaryPreview = callSummaryForDisplay(item, {
    businessName,
    callerIsBlocked:
      normalizeBlockedCallerE164(mapped.callerId) != null &&
      blockedSet.has(normalizeBlockedCallerE164(mapped.callerId)!),
  });
  return item;
}

export default async function CallHistoryPage({ searchParams }: CallHistoryPageProps) {
  const sp = searchParams ? await searchParams : {};
  const now = new Date();
  const selectedDate = parseCallsPageDateParam(sp.date, now);
  const selectedDateParam = formatCallsPageDateParam(selectedDate, now);
  const greetingSubline = callsPageDateGreetingSubline(selectedDate, now);
  const initialSelectedCallId =
    typeof sp.call === "string" && sp.call.trim() ? sp.call.trim() : null;
  const requestedPage = parsePageParam(sp.page);
  const { supabase, organizationId } = await requireDashboardSession();

  let deepLinkedCreatedAt: string | null = null;
  if (initialSelectedCallId) {
    const { data: deepLinkedCall } = await supabase
      .from("call_logs")
      .select("created_at")
      .eq("id", initialSelectedCallId)
      .eq("organization_id", organizationId)
      .eq("is_test_call", false)
      .maybeSingle();
    deepLinkedCreatedAt = String(deepLinkedCall?.created_at ?? "").trim() || null;
  }

  if (sp.range && !sp.date) {
    redirect(buildCallsPageHref({
      callLogId: initialSelectedCallId,
      callCreatedAt: deepLinkedCreatedAt,
      page: requestedPage > 1 ? requestedPage : undefined,
    }));
  }
  if (initialSelectedCallId && deepLinkedCreatedAt && !sp.date) {
    const neededDate = callsPageDateForTimestamp(deepLinkedCreatedAt, now);
    if (neededDate !== selectedDateParam) {
      redirect(buildCallsPageHref({
        callLogId: initialSelectedCallId,
        callCreatedAt: deepLinkedCreatedAt,
        page: requestedPage > 1 ? requestedPage : undefined,
      }));
    }
  }

  const orgRow = await getCachedDashboardOrganizationRow();
  const businessName = String(orgRow?.name ?? "").trim();
  const { lowerInclusive, upperExclusive } = getCallsPageDayBoundsIso(selectedDate);

  function applyDayFilters<T extends {
    gte: (col: string, val: string) => T;
    lt: (col: string, val: string) => T;
  }>(query: T): T {
    return query.gte("created_at", lowerInclusive).lt("created_at", upperExclusive);
  }

  const listFrom = (requestedPage - 1) * CALL_HISTORY_PAGE_SIZE;
  const listTo = listFrom + CALL_HISTORY_PAGE_SIZE - 1;

  const [
    { count: totalCount, error: countError },
    { data: metricsData, error: metricsError },
    { data: pageData, error: listError },
    { data: linkRows, error: linksError },
    { data: ticketRows, error: ticketsError },
    { data: blockedRows },
    { data: engineerRows, error: engineerError },
  ] = await Promise.all([
    applyDayFilters(customerCallFilters(
      supabase.from("call_logs").select("id", { count: "exact", head: true }),
    ).eq("organization_id", organizationId)),
    applyDayFilters(customerCallFilters(
      supabase.from("call_logs").select("outcome, duration_seconds"),
    ).eq("organization_id", organizationId)),
    applyDayFilters(customerCallFilters(
      supabase.from("call_logs").select(CALL_LIST_COLUMNS),
    ).eq("organization_id", organizationId))
      .order("created_at", { ascending: false })
      .range(listFrom, listTo),
    applyDayFilters(customerCallFilters(
      supabase.from("call_logs").select(
        "id, caller_number, created_at, outcome, ai_summary, call_resolution, post_call_status",
      ),
    ).eq("organization_id", organizationId)),
    customerTicketFilters(supabase.from("action_tickets").select(
      "id, caller_number, caller_name, summary, status, created_at",
    ))
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(CALL_HISTORY_OPEN_TICKET_LIMIT),
    supabase.from("blocked_callers").select("caller_e164")
      .eq("organization_id", organizationId),
    // A separate informational row; it never occupies a customer page slot.
    applyDayFilters(supabase.from("call_logs").select(CALL_LIST_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("is_test_call", false)
      .or(ENGINEER_CALL_FILTER))
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const error = countError ?? metricsError ?? listError ?? linksError ?? ticketsError ?? engineerError;
  const tickets = (ticketRows ?? []) as TicketDbRow[];
  const followUpByCallId = assignOpenTicketsToCalls((linkRows ?? []) as CallLinkRow[], tickets);
  const needsAttentionToday = (linkRows ?? []).filter((row) => {
    const followUp = followUpByCallId.get(row.id) ?? null;
    return resolveCallHistoryNeedsAttention({
      outcome: normalizeCallOutcome(row.outcome),
      aiSummary: row.ai_summary,
      postCallStatus: (row.post_call_status as PostCallStatus) ?? "complete",
      followUpSummary: followUp?.summary ?? null,
      hasOpenAction: Boolean(followUp),
      callResolution: normalizeCallResolution(row.call_resolution),
    });
  }).length;

  // These totals are CUSTOMER totals, not the length of the visible mixed list.
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CALL_HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  if (!error && page !== requestedPage) {
    const params = new URLSearchParams({ date: selectedDateParam, page: String(page) });
    if (initialSelectedCallId) params.set("call", initialSelectedCallId);
    redirect(`/dashboard/calls?${params.toString()}`);
  }
  const metrics = buildCallHistoryMetricsFromSummaryRows(
    (metricsData ?? []) as CallLogMetricsRow[],
    needsAttentionToday,
  );
  metrics.totalCalls = total;

  const blockedCallerE164s = (blockedRows ?? []).map(
    (row) => String((row as { caller_e164: string }).caller_e164),
  );
  const blockedSet = new Set(blockedCallerE164s);
  const visibleRows = [
    ...((pageData ?? []) as CallLogListRow[]),
    ...(page === 1 ? ((engineerRows ?? []) as CallLogListRow[]) : []),
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  let calls = !error
    ? visibleRows.map((row) => toListItem(row, followUpByCallId, businessName, blockedSet))
    : [];

  if (initialSelectedCallId && !calls.some((call) => call.id === initialSelectedCallId)) {
    const { data: deepLinkedRow } = await supabase.from("call_logs")
      .select(CALL_LIST_COLUMNS)
      .eq("id", initialSelectedCallId)
      .eq("organization_id", organizationId)
      .eq("is_test_call", false)
      .maybeSingle();
    if (deepLinkedRow) {
      const deepLinkedCall = toListItem(
        deepLinkedRow as CallLogListRow, followUpByCallId, businessName, blockedSet,
      );
      calls = [
        deepLinkedCall,
        ...calls.filter((call) => call.id !== deepLinkedCall.id &&
          !(deepLinkedCall.engineerTestCall && call.engineerTestCall)),
      ];
    }
  }

  calls = collapseEngineerTestCallsForList(calls).calls;

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <CallHistoryPageSections animateKey={`${selectedDateParam}-${page}`}>
          {error ? (
            <p className="shrink-0 text-[13px] text-red-700">
              Could not load calls: {error.message}
            </p>
          ) : (
            <CallHistoryPageContent
              className="min-h-0 flex-1"
              greetingSubline={greetingSubline}
              metrics={metrics}
              calls={calls}
              organizationId={organizationId}
              initialSelectedCallId={initialSelectedCallId}
              blockedCallerE164s={blockedCallerE164s}
              businessName={businessName}
              pagination={{ page, pageSize: CALL_HISTORY_PAGE_SIZE, totalCount: total, totalPages, selectedDate: selectedDateParam }}
            />
          )}
        </CallHistoryPageSections>
      </div>
    </div>
  );
}
