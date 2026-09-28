import type { StatusVariant } from "@/components/dashboard/dashboard-surface";
import {
  ENGINEER_TEST_CALL_LIST_LABEL,
  ENGINEER_TEST_CALL_SUMMARY,
} from "@/lib/engineer-test-call";
import { resolveCallerDisplayName, isUnknownCallerLabel } from "@/lib/caller-identity";
import type { CallFollowUpLink } from "@/lib/call-history-follow-up";
import {
  normalizeCallOutcome,
  type CallOutcome,
} from "@/lib/call-history-types";
import { blockedCallDashboardSummary } from "@/lib/blocked-call-copy";
import { isCallerDataErased } from "@/lib/caller-data-erasure";
import type { PostCallStatus } from "@/lib/post-call-processing-types";
import { phoneQueryMatchesCaller } from "@/lib/caller-phone-search";
import { isPostCallAttentionStatus } from "@/lib/post-call-processing-types";
import { CALL_POST_PROCESSING_BANNER } from "@/lib/post-call-processing-types";
import { stripToolLinesFromTranscript } from "@/lib/transcript-display";
import {
  resolveCallDepartmentLink,
  type CallDepartmentLink,
} from "@/lib/call-department-link";
import type { ActionCategory } from "@/app/(dashboard)/dashboard/action-inbox/categories";
import {
  resolveCallHistoryNeedsAttention,
  type CallResolution,
  normalizeCallResolution,
} from "@/lib/call-history-status";
import {
  attentionRowAccent,
  resolveAttentionTag,
  type CallAttentionLevel,
} from "@/lib/call-attention-level";
export type CallFollowUp = CallFollowUpLink;

export type CallHistoryListItem = {
  id: string;
  createdAt: string;
  dateTimeLabel: string;
  callerId: string;
  callerDisplay: string;
  callerName: string | null;
  durationSeconds: number;
  durationLabel: string;
  outcome: CallOutcome;
  outcomeLabel: string;
  intentLabel: string;
  summaryPreview: string | null;
  transcriptVerbatim: string;
  transcriptReview: string | null;
  aiSummary: string | null;
  hasOpenAction: boolean;
  followUp: CallFollowUp | null;
  postCallStatus: PostCallStatus;
  hasRecording: boolean;
  departmentLink: CallDepartmentLink | null;
  attentionLevel: CallAttentionLevel;
  actionCategory: ActionCategory | null;
  callResolution: CallResolution | null;
  callerDataErasedAt: string | null;
  callerDataErasedByLabel: string | null;
  callerDataErasedReason: string | null;
  engineerTestCall: boolean;
  /** When multiple engineer tests are collapsed for one day. */
  engineerTestCallCount?: number;
};

export function callNeedsPostCallReviewBanner(item: CallHistoryListItem): boolean {
  if (item.engineerTestCall) return false;
  return isPostCallAttentionStatus(item.postCallStatus);
}

export { CALL_POST_PROCESSING_BANNER };

export function callDisplayName(
  item: Pick<CallHistoryListItem, "callerName" | "callerDisplay">,
): string {
  return resolveCallerDisplayName([item.callerName], item.callerDisplay);
}

/** Compact list label — name on top, number below. */
export function callListCallerLabel(
  item: Pick<
    CallHistoryListItem,
    "callerName" | "callerDisplay" | "callerDataErasedAt" | "engineerTestCall"
  >,
): { title: string; subtitle?: string } {
  if (item.engineerTestCall) {
    return { title: ENGINEER_TEST_CALL_LIST_LABEL };
  }
  if (isCallerDataErased(item)) return { title: "Caller data erased" };
  const name = callDisplayName(item);
  const phone = item.callerDisplay.trim() || "Unknown number";
  if (name === phone || isUnknownCallerLabel(name)) return { title: phone };
  return { title: name, subtitle: phone };
}

/** Compact list primary line — name and number on one scan line. */
export function callListPrimaryLine(
  item: Pick<
    CallHistoryListItem,
    "callerName" | "callerDisplay" | "callerDataErasedAt" | "engineerTestCall"
  >,
): string {
  if (item.engineerTestCall) {
    return ENGINEER_TEST_CALL_LIST_LABEL;
  }
  if (isCallerDataErased(item)) return "Caller data erased";
  return callListCallerLabel(item).title;
}

/** Time-only label for same-day call lists. */
export function callListTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function callListNeedsAttention(item: CallHistoryListItem): boolean {
  return item.attentionLevel !== "routine";
}

export function summaryForDisplay(
  item: CallHistoryListItem,
  options?: { businessName?: string },
): string | null {
  if (item.outcome === "blocked") {
    if (item.aiSummary?.trim()) return item.aiSummary.trim();
    return blockedCallDashboardSummary(options?.businessName ?? "");
  }
  if (item.aiSummary?.trim()) return item.aiSummary.trim();
  const review = staffTranscriptText(item.transcriptReview);
  if (review) return truncatePreview(review, 160);
  const verbatim = staffTranscriptText(item.transcriptVerbatim);
  if (verbatim && verbatim !== "No transcript on file.") {
    return truncatePreview(verbatim, 160);
  }
  return null;
}

/** Summary for call detail — includes blocklist fallback when webhook logged a bare answered row. */
export function callSummaryForDisplay(
  item: CallHistoryListItem,
  options: { businessName?: string; callerIsBlocked?: boolean },
): string | null {
  if (item.engineerTestCall) {
    return ENGINEER_TEST_CALL_SUMMARY;
  }
  if (isCallerDataErased(item)) {
    return "Personal data for this call has been removed.";
  }
  const summary = summaryForDisplay(item, options);
  if (summary) return summary;
  if (
    options.callerIsBlocked &&
    item.durationSeconds <= 2 &&
    !item.transcriptReview?.trim() &&
    !fullTranscriptForDisplay(item)
  ) {
    return blockedCallDashboardSummary(options.businessName ?? "");
  }
  return null;
}

/** Primary transcript for call detail — prefer full verbatim STT. */
export function primaryTranscriptForDisplay(
  item: CallHistoryListItem,
): string | null {
  const verbatim = fullTranscriptForDisplay(item);
  if (verbatim) return verbatim;
  const review = item.transcriptReview?.trim();
  if (review) return review;
  if (item.aiSummary?.trim()) return item.aiSummary.trim();
  return null;
}

/** Cleaned LLM-reviewed transcript when available. */
export function cleanedTranscriptForDisplay(
  item: CallHistoryListItem,
): string | null {
  return staffTranscriptText(item.transcriptReview);
}

/** Staff-facing transcript — prefers review/summary over raw verbatim STT. */
export function reviewTranscriptForDisplay(
  item: CallHistoryListItem,
): string | null {
  const review = staffTranscriptText(item.transcriptReview);
  if (review) return review;
  if (item.aiSummary?.trim()) return item.aiSummary.trim();
  return null;
}

/** Full verbatim STT text when still retained (up to 30 days). */
export function fullTranscriptForDisplay(item: CallHistoryListItem): string | null {
  const verbatim = staffTranscriptText(item.transcriptVerbatim);
  if (!verbatim || verbatim === "No transcript on file.") return null;
  return verbatim;
}

function staffTranscriptText(text: string | null | undefined): string | null {
  const stripped = stripToolLinesFromTranscript(text);
  return stripped || null;
}

export function hasFullTranscript(item: CallHistoryListItem): boolean {
  return fullTranscriptForDisplay(item) != null;
}

function truncatePreview(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export function whatHappenedNextLabel(
  outcome: CallOutcome,
  hasOpenAction: boolean,
): string {
  if (hasOpenAction) return "Needs attention";
  switch (outcome) {
    case "answered":
      return "Handled";
    case "link_sent":
      return "Info sent";
    case "action_created":
      return "Follow-up created";
    case "callback_requested":
      return "Callback requested";
    case "failed":
      return "Failed";
    case "voicemail_or_no_speech":
      return "Handled";
    case "spam_or_abuse":
      return "Handled";
    case "blocked":
      return "Blocked";
    default:
      return "Handled";
  }
}

/**
 * Outcome chip colour. Consistent with the Action Inbox: colour means
 * needs-attention, not category. Amber only for problems, grey for no-speech,
 * Cliste charcoal (`brand`) for everything routine — no green/blue rainbow.
 */
export function outcomeBadgeVariant(outcome: CallOutcome): StatusVariant {
  switch (outcome) {
    case "failed":
    case "spam_or_abuse":
    case "blocked":
      return "attention";
    case "voicemail_or_no_speech":
      return "neutral";
    case "answered":
    case "link_sent":
    case "callback_requested":
    case "action_created":
    default:
      return "brand";
  }
}

export function averageDurationSeconds(calls: CallHistoryListItem[]): number {
  if (calls.length === 0) return 0;
  const total = calls.reduce((acc, c) => acc + Math.max(0, c.durationSeconds), 0);
  return Math.round(total / calls.length);
}

export function formatAvgDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export type OutcomeFilterValue =
  | "all"
  | CallOutcome
  | "needs_attention";

export const OUTCOME_FILTER_OPTIONS: { value: OutcomeFilterValue; label: string }[] = [
  { value: "all", label: "All outcomes" },
  { value: "answered", label: "Answered" },
  { value: "link_sent", label: "Info sent" },
  { value: "action_created", label: "Enquiry captured" },
  { value: "callback_requested", label: "Callback requested" },
  { value: "failed", label: "Failed" },
  { value: "voicemail_or_no_speech", label: "No speech" },
  { value: "spam_or_abuse", label: "Spam or abuse" },
  { value: "blocked", label: "Blocked" },
  { value: "needs_attention", label: "Needs attention" },
];

export function matchesOutcomeFilter(
  item: CallHistoryListItem,
  filter: OutcomeFilterValue,
): boolean {
  if (filter === "all") return true;
  if (filter === "needs_attention") {
    return (
      !isCallerDataErased(item) &&
      resolveCallHistoryNeedsAttention({
        outcome: item.outcome,
        aiSummary: item.aiSummary,
        postCallStatus: item.postCallStatus,
        followUpSummary: item.followUp?.summary ?? null,
        hasOpenAction: item.hasOpenAction,
        callResolution: item.callResolution,
      })
    );
  }
  return item.outcome === filter;
}

export function matchesSearch(item: CallHistoryListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.engineerTestCall) return true;
  const hay = [
    ENGINEER_TEST_CALL_LIST_LABEL,
    "engineer test",
    item.callerName ?? "",
    item.callerDisplay,
    item.callerId,
    item.intentLabel,
    item.summaryPreview ?? "",
    item.aiSummary ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  if (phoneQueryMatchesCaller(q, item.callerId, item.callerDisplay)) {
    return true;
  }
  return false;
}

export type CallHistoryMetrics = {
  totalCalls: number;
  needsAttentionCount: number;
  avgDurationLabel: string;
};

export function buildCallHistoryMetrics(calls: CallHistoryListItem[]): CallHistoryMetrics {
  const needsAttentionCount = calls.filter(
    (c) =>
      !isCallerDataErased(c) &&
      resolveCallHistoryNeedsAttention({
        outcome: c.outcome,
        aiSummary: c.aiSummary,
        postCallStatus: c.postCallStatus,
        followUpSummary: c.followUp?.summary ?? null,
        hasOpenAction: c.hasOpenAction,
        callResolution: c.callResolution,
      }),
  ).length;
  return {
    totalCalls: calls.length,
    needsAttentionCount,
    avgDurationLabel: formatAvgDuration(averageDurationSeconds(calls)),
  };
}

export function callHistorySummarySegments(
  metrics: CallHistoryMetrics,
): { value: string; label: string }[] {
  return [
    { value: String(metrics.totalCalls), label: "total calls" },
    { value: String(metrics.needsAttentionCount), label: "need attention" },
    { value: metrics.avgDurationLabel, label: "avg. length" },
  ];
}

/** Prefer call-list data on page 1 when the full day fits on one page (live updates). */
export function resolveLiveCallHistoryMetrics({
  calls,
  serverMetrics,
  totalCount,
  page,
  pageSize,
}: {
  calls: CallHistoryListItem[];
  serverMetrics: CallHistoryMetrics;
  totalCount: number;
  page: number;
  pageSize: number;
}): CallHistoryMetrics {
  const pageCoversFullDay = page === 1 && totalCount <= pageSize;

  if (pageCoversFullDay && calls.length > 0) {
    const fromCalls = buildCallHistoryMetrics(calls);
    return {
      totalCalls: Math.max(totalCount, calls.length),
      needsAttentionCount: fromCalls.needsAttentionCount,
      avgDurationLabel: fromCalls.avgDurationLabel,
    };
  }

  return {
    ...serverMetrics,
    totalCalls: Math.max(totalCount, calls.length),
  };
}

/** Metrics from lightweight rows (no transcripts) plus day-scoped attention count. */
export function buildCallHistoryMetricsFromSummaryRows(
  rows: { outcome: string; duration_seconds: number }[],
  needsAttentionCount: number,
): CallHistoryMetrics {
  const stubItems: CallHistoryListItem[] = rows.map((row, i) => ({
    id: `summary-${i}`,
    createdAt: "",
    dateTimeLabel: "",
    callerId: "",
    callerDisplay: "",
    callerName: null,
    durationSeconds: Math.max(0, row.duration_seconds ?? 0),
    durationLabel: "",
    outcome: normalizeCallOutcome(row.outcome),
    outcomeLabel: "",
    intentLabel: "",
    summaryPreview: null,
    transcriptVerbatim: "",
    transcriptReview: null,
    aiSummary: null,
    hasOpenAction: false,
    followUp: null,
    postCallStatus: "complete",
    hasRecording: false,
    departmentLink: null,
    attentionLevel: "routine",
    actionCategory: null,
    callResolution: null,
    callerDataErasedAt: null,
    callerDataErasedByLabel: null,
    callerDataErasedReason: null,
    engineerTestCall: false,
  }));
  const base = buildCallHistoryMetrics(stubItems);
  return {
    ...base,
    totalCalls: rows.length,
    needsAttentionCount,
  };
}

/** One engineer-test row per day in the call list (keeps the latest test). */
export function collapseEngineerTestCallsForList(
  items: CallHistoryListItem[],
): { calls: CallHistoryListItem[]; hiddenEngineerTestCount: number } {
  const engineer = items.filter((item) => item.engineerTestCall);
  const rest = items.filter((item) => !item.engineerTestCall);
  if (engineer.length <= 1) {
    return { calls: items, hiddenEngineerTestCount: 0 };
  }

  const latest = engineer[0]!;
  const collapsed: CallHistoryListItem = {
    ...latest,
    engineerTestCallCount: engineer.length,
    summaryPreview:
      engineer.length > 1
        ? `${engineer.length} test calls today. Not billed — no recording or transcript.`
        : ENGINEER_TEST_CALL_SUMMARY,
    outcomeLabel: "Test",
    attentionLevel: "routine",
    hasOpenAction: false,
    followUp: null,
    departmentLink: null,
    actionCategory: null,
  };

  const calls = [collapsed, ...rest].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { calls, hiddenEngineerTestCount: engineer.length - 1 };
}
