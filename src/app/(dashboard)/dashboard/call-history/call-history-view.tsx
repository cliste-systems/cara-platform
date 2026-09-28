"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Ban, Check, Copy, History, Inbox, Loader2, Phone, PhoneCall, Search, ShieldOff, Store, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { CallerDataEraseDialog } from "@/components/dashboard/caller-data-erase-dialog";

import { EmptyState } from "@/components/dashboard/empty-state";
import { CallAudioPlayer } from "@/components/dashboard/call-audio-player";
import { CallMediaRetentionNote } from "@/components/dashboard/call-media-retention-note";
import { CallerHistoryDialog } from "@/components/dashboard/caller-history-section";
import { StaffTranscriptView } from "@/components/dashboard/staff-transcript-view";
import {
  DetailActionButton,
  DetailPanelBody,
  DetailPanelFooter,
  DetailPanelShell,
  DetailSectionRow,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_LIVE_CALL_ROW_CLASS,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { buildCallsPageHref } from "@/lib/calls-page-href";
import {
  formatCallsPageDateParam,
  isCallsPageToday,
  parseCallsPageDateParam,
} from "@/lib/calls-page-date";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { incomingCallListLabel } from "@/lib/dashboard-feed-time";
import { RETAIL_DEPARTMENT_HOME_ICON_CHIP } from "@/lib/retail-department-home-icon";
import { cn } from "@/lib/utils";
import {
  ANONYMOUS_CALLER_E164,
  normalizeBlockedCallerE164,
} from "@/lib/blocked-callers";
import { shouldShowCallsIncomingPlaceholder } from "@/lib/calls-incoming-placeholder";
import type { CallsIncomingPlaceholder } from "@/lib/calls-incoming-placeholder";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { isUnknownCallerLabel } from "@/lib/caller-identity";
import {
  CALL_HISTORY_STATUS_BADGE_CLASSES,
  CALL_HISTORY_STATUS_ROW_ACCENT_CLASSES,
  resolveCallHistoryListStatus,
} from "@/lib/call-history-status";
import { dashboardFollowUpTicketHref } from "@/lib/dashboard-follow-up-hub";

import {
  addBlockedCaller,
  removeBlockedCallerByPhone,
} from "../settings/blocked-numbers-actions";
import { eraseCustomerData } from "../privacy/actions";
import { fetchCallHistoryDetail } from "./actions";
import { useDashboardVertical } from "../dashboard-vertical-context";
import {
  OUTCOME_FILTER_OPTIONS,
  callDisplayName,
  callListCallerLabel,
  callListTimeLabel,
  fullTranscriptForDisplay,
  matchesOutcomeFilter,
  matchesSearch,
  callSummaryForDisplay,
  CALL_POST_PROCESSING_BANNER,
  callNeedsPostCallReviewBanner,
  type CallHistoryListItem,
  type CallHistoryMetrics,
  type OutcomeFilterValue,
} from "./call-history-helpers";
import {
  ENGINEER_TEST_CALL_BADGE_LABEL,
  ENGINEER_TEST_CALL_DETAIL_TITLE,
  ENGINEER_TEST_CALL_ROW_SUBTITLE,
  ENGINEER_TEST_CALL_SUMMARY,
} from "@/lib/engineer-test-call";
import {
  formatCallerDataErasedAt,
  CALLER_DATA_ERASED_BADGE_CLASS,
  CALLER_DATA_ERASED_ROW_ACCENT,
  isCallerDataErased,
} from "@/lib/caller-data-erasure";
import {
  formatCallMediaRetentionExpiredMessage,
  isCallMediaRetentionExpired,
} from "@/lib/call-media-retention";
import { useCallsLiveUpdates } from "./use-calls-live-updates";

export type CallHistoryPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  selectedDate: string;
};

type CallHistoryViewProps = {
  calls: CallHistoryListItem[];
  metrics: CallHistoryMetrics;
  organizationId: string;
  initialSelectedCallId?: string | null;
  pagination?: CallHistoryPagination;
  blockedCallerE164s: string[];
  businessName?: string;
  className?: string;
};

function callsPageHref(
  pagination: CallHistoryPagination,
  page: number,
  callId?: string | null,
): string {
  const params = new URLSearchParams();
  const now = new Date();
  const selectedDate = parseCallsPageDateParam(pagination.selectedDate, now);
  if (!isCallsPageToday(selectedDate, now)) {
    params.set("date", formatCallsPageDateParam(selectedDate, now));
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  if (callId?.trim()) {
    params.set("call", callId.trim());
  }
  const qs = params.toString();
  return qs ? `${DASHBOARD_ROUTES.calls}?${qs}` : DASHBOARD_ROUTES.calls;
}

export function CallHistoryView({
  calls,
  metrics: _metrics,
  organizationId,
  initialSelectedCallId,
  pagination,
  blockedCallerE164s,
  businessName = "",
  className,
}: CallHistoryViewProps) {
  const router = useRouter();
  const { copy } = useDashboardVertical();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialSelectedCallId?.trim() || null,
  );
  const [copied, setCopied] = useState(false);
  const [detailById, setDetailById] = useState<
    Record<string, { transcriptVerbatim: string; transcriptReview: string | null }>
  >({});
  const blockedSet = useMemo(
    () => new Set(blockedCallerE164s),
    [blockedCallerE164s],
  );
  const viewingToday = isCallsPageToday(
    parseCallsPageDateParam(searchParams.get("date") ?? undefined),
  );
  const incomingPlaceholder = useCallsLiveUpdates({
    organizationId,
    calls,
    viewingToday,
    page: pagination?.page ?? 1,
  });
  const showIncomingPlaceholder = shouldShowCallsIncomingPlaceholder({
    viewingToday,
    page: pagination?.page ?? 1,
    placeholder: incomingPlaceholder,
  });

  const filtered = useMemo(() => {
    return calls.filter(
      (c) => matchesSearch(c, search) && matchesOutcomeFilter(c, outcomeFilter),
    );
  }, [calls, search, outcomeFilter]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((c) => c.id === selectedId)) {
      return selectedId;
    }
    const deep = initialSelectedCallId?.trim();
    if (deep && filtered.some((c) => c.id === deep)) return deep;
    return filtered[0]?.id ?? null;
  }, [selectedId, filtered, initialSelectedCallId]);

  const selectedBase = useMemo(
    () => filtered.find((c) => c.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const selected = useMemo(() => {
    if (!selectedBase) return null;
    const detail = detailById[selectedBase.id];
    if (!detail) return selectedBase;
    return {
      ...selectedBase,
      transcriptVerbatim: detail.transcriptVerbatim,
      transcriptReview: detail.transcriptReview,
    };
  }, [selectedBase, detailById]);

  const ensureDetailLoaded = useCallback((id: string, engineerTestCall?: boolean) => {
    if (engineerTestCall) return;
    void fetchCallHistoryDetail(id).then((detail) => {
      if (!detail) return;
      setDetailById((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: detail };
      });
    });
  }, []);

  useEffect(() => {
    const callFromUrl =
      searchParams.get("call")?.trim() || initialSelectedCallId?.trim() || null;
    if (callFromUrl) {
      setSelectedId(callFromUrl);
    }
  }, [searchParams, initialSelectedCallId]);

  useEffect(() => {
    if (resolvedSelectedId && selectedBase) {
      ensureDetailLoaded(resolvedSelectedId, selectedBase.engineerTestCall);
    }
  }, [resolvedSelectedId, selectedBase, ensureDetailLoaded]);

  const detailLoading = Boolean(
    selectedBase && !selectedBase.engineerTestCall && !detailById[selectedBase.id],
  );

  const copySummary = useCallback(async () => {
    if (!selected) return;
    const text = callSummaryForDisplay(selected, {
      businessName,
      callerIsBlocked:
        normalizeBlockedCallerE164(selected.callerId) != null &&
        blockedSet.has(normalizeBlockedCallerE164(selected.callerId)!),
    });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected, businessName, blockedSet]);

  return (
    <section
      className={cn(
        DASHBOARD_CARD_SURFACE,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <ListDetailLayout
        className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]"
        list={
          <div className="flex h-full min-h-0 flex-col overflow-hidden border-[#dfe7e2] bg-[#fbfcfb] max-xl:border-b max-xl:border-[#dfe7e2] xl:border-r xl:border-r-[#dfe7e2]">
            <div className="shrink-0 border-b border-inherit px-4 py-3 sm:px-5">
              <p className="text-[14px] font-semibold text-[#11181d]">Call log</p>
              <div className="mt-2 flex flex-col gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or number"
                    aria-label="Search calls"
                    className="h-10 w-full border-[#b9c8c1] bg-white py-1 pl-8 text-[14px] placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={outcomeFilter}
                  onChange={(e) =>
                    setOutcomeFilter(e.target.value as OutcomeFilterValue)
                  }
                  aria-label="Filter by outcome"
                  className={cn(DASHBOARD_SELECT_CLASS, "h-10 w-full shrink-0")}
                >
                  {OUTCOME_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3",
                filtered.length === 0 &&
                  !showIncomingPlaceholder &&
                  "flex items-center justify-center",
              )}
            >
              {filtered.length === 0 && !showIncomingPlaceholder ? (
                <EmptyState
                  icon={Phone}
                  title="No calls yet"
                  description={copy.calls.emptyDescription}
                  className="w-full py-10"
                />
              ) : (
                <ul className="space-y-1.5" role="listbox" aria-label="Calls">
                  {showIncomingPlaceholder && incomingPlaceholder ? (
                    <CallIncomingPlaceholderRow placeholder={incomingPlaceholder} />
                  ) : null}
                  {filtered.map((row) => (
                    <CallListRow
                      key={row.id}
                      row={row}
                      selected={row.id === resolvedSelectedId}
                      onSelect={() => {
                        setSelectedId(row.id);
                        ensureDetailLoaded(row.id);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
            {pagination && pagination.totalPages > 1 ? (
              <CallHistoryPaginationBar
                pagination={pagination}
                selectedCallId={resolvedSelectedId}
                dateFromUrl={searchParams.get("date")}
              />
            ) : null}
          </div>
        }
        detail={
          showIncomingPlaceholder && incomingPlaceholder && !selected ? (
            <CallIncomingDetailPlaceholder placeholder={incomingPlaceholder} />
          ) : (
            <CallDetailPanel
              call={selected}
              copied={copied}
              detailLoading={detailLoading}
              onCopySummary={copySummary}
              blockedSet={blockedSet}
              businessName={businessName}
              onRefresh={() => router.refresh()}
            />
          )
        }
      />
    </section>
  );
}

const CALL_LIST_SUBTITLE_CLASS =
  "mt-0.5 block truncate text-[11px] leading-snug text-slate-500";

function CallIncomingPlaceholderRow({
  placeholder,
}: {
  placeholder: CallsIncomingPlaceholder;
}) {
  const isLoading = placeholder.phase === "loading";
  const label = incomingCallListLabel(placeholder.callerNumber);

  return (
    <li aria-live="polite">
      <div
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
          DASHBOARD_HOME_LIVE_CALL_ROW_CLASS,
        )}
      >
        <span className={RETAIL_DEPARTMENT_HOME_ICON_CHIP} aria-hidden>
          <Phone className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug text-[#0b1220]">
            {label.title}
          </p>
          {label.subtitle ? (
            <p className={CALL_LIST_SUBTITLE_CLASS}>{label.subtitle}</p>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="size-3 animate-spin text-[#64748b]" aria-hidden />
          ) : (
            <span className="size-1.5 rounded-full bg-[#94a3b8]" aria-hidden />
          )}
          <span className="text-[11px] font-medium leading-none text-slate-500">
            {isLoading ? "Loading" : "Live"}
          </span>
        </span>
      </div>
    </li>
  );
}

function CallIncomingDetailPlaceholder({
  placeholder,
}: {
  placeholder: CallsIncomingPlaceholder;
}) {
  const isLoading = placeholder.phase === "loading";

  return (
    <DetailPanelShell surface="embedded">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-9 text-center">
        <Loader2 className="size-8 animate-spin text-[#353D42]" aria-hidden />
        <p className="mt-4 text-[15px] font-semibold text-[#11181d]">
          {isLoading ? "Loading call details" : "Call in progress"}
        </p>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
          {isLoading
            ? "A new call has come in and it's currently loading. The summary and transcript will appear here shortly."
            : "Cara is speaking with this caller now. The call log will update as soon as the call finishes."}
        </p>
        <p className="mt-4 text-[13px] font-medium text-[#353D42]">
          {incomingCallListLabel(placeholder.callerNumber).title}
        </p>
      </div>
    </DetailPanelShell>
  );
}

function CallListRow({
  row,
  selected,
  onSelect,
}: {
  row: CallHistoryListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = callListCallerLabel(row);
  const time = callListTimeLabel(row.createdAt);
  const engineerTestCall = row.engineerTestCall;
  const callerDataErased = isCallerDataErased(row);
  const callStatus = resolveCallHistoryListStatus({
    outcome: row.outcome,
    aiSummary: row.aiSummary,
    postCallStatus: row.postCallStatus,
    followUpSummary: row.followUp?.summary ?? null,
    hasOpenAction: row.hasOpenAction,
    callResolution: row.callResolution,
  });
  const statusAccent = engineerTestCall
    ? {
        rowAccentClass: "border-l-2 border-l-slate-200",
        selectedRowAccentClass: "border-l-2 border-l-slate-400",
      }
    : callerDataErased
      ? CALLER_DATA_ERASED_ROW_ACCENT
      : CALL_HISTORY_STATUS_ROW_ACCENT_CLASSES[callStatus.tone];

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left",
          selected
            ? cn(
                "border-[#353D42] bg-[#f6faf7] shadow-[0_1px_0_rgba(17,24,29,0.04)]",
                statusAccent.selectedRowAccentClass,
              )
            : cn("border-[#dfe7e2] bg-white", statusAccent.rowAccentClass),
        )}
      >
        <span className={RETAIL_DEPARTMENT_HOME_ICON_CHIP} aria-hidden>
          <Phone className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug text-[#0b1220]">
            {label.title}
          </p>
          {label.subtitle ? (
            <p className={CALL_LIST_SUBTITLE_CLASS}>{label.subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
          {time}
        </span>
      </button>
    </li>
  );
}

function CallHistoryPaginationBar({
  pagination,
  selectedCallId,
  dateFromUrl,
}: {
  pagination: CallHistoryPagination;
  selectedCallId: string | null;
  dateFromUrl: string | null;
}) {
  const now = new Date();
  const selectedDate =
    dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl)
      ? dateFromUrl
      : formatCallsPageDateParam(parseCallsPageDateParam(undefined, now), now);
  const paged: CallHistoryPagination = { ...pagination, selectedDate };
  const { page, totalPages, totalCount, pageSize } = paged;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#dfe7e2] bg-[#fbfcfb] px-4 py-2.5 sm:px-5">
      <p className="text-[12px] text-slate-500 tabular-nums">
        {from}–{to} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={callsPageHref(paged, page - 1, selectedCallId)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 px-2.5 py-1 text-[12px] text-slate-300">
            Previous
          </span>
        )}
        <span className="text-[12px] text-slate-500 tabular-nums">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={callsPageHref(paged, page + 1, selectedCallId)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 px-2.5 py-1 text-[12px] text-slate-300">
            Next
          </span>
        )}
      </div>
    </div>
  );
}

function CallDetailPanel({
  call,
  copied,
  detailLoading,
  onCopySummary,
  blockedSet,
  businessName,
  onRefresh,
}: {
  call: CallHistoryListItem | null;
  copied: boolean;
  detailLoading: boolean;
  onCopySummary: () => void;
  blockedSet: Set<string>;
  businessName: string;
  onRefresh: () => void;
}) {
  if (!call) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={PhoneCall}
            title="Select a call"
            description="Choose a call to review the summary and transcript."
            className="mx-6 w-full max-w-sm px-4 py-9"
          />
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <CallDetailPanelContent
      key={call.id}
      call={call}
      copied={copied}
      detailLoading={detailLoading}
      onCopySummary={onCopySummary}
      blockedSet={blockedSet}
      businessName={businessName}
      onRefresh={onRefresh}
    />
  );
}

function CallDetailPanelContent({
  call,
  copied,
  detailLoading,
  onCopySummary,
  blockedSet,
  businessName,
  onRefresh,
}: {
  call: CallHistoryListItem;
  copied: boolean;
  detailLoading: boolean;
  onCopySummary: () => void;
  blockedSet: Set<string>;
  businessName: string;
  onRefresh: () => void;
}) {
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [unblockConfirmOpen, setUnblockConfirmOpen] = useState(false);
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);
  const [callerHistoryOpen, setCallerHistoryOpen] = useState(false);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [eraseMsg, setEraseMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const openPastCall = useCallback((callId: string, createdAt: string) => {
    setCallerHistoryOpen(false);
    router.push(
      buildCallsPageHref({
        callLogId: callId,
        callCreatedAt: createdAt,
      }),
    );
  }, [router]);

  const callerE164 = normalizeBlockedCallerE164(call.callerId);
  const callerDataErased = isCallerDataErased(call);
  const engineerTestCall = call.engineerTestCall;
  const canManageBlock =
    !engineerTestCall &&
    callerE164 != null &&
    call.callerId.trim() !== ANONYMOUS_CALLER_E164 &&
    !callerDataErased;
  const canDeleteCallerData = canManageBlock;
  const isBlocked = callerE164 != null && blockedSet.has(callerE164);

  const summary = callSummaryForDisplay(call, {
    businessName,
    callerIsBlocked: isBlocked,
  });
  const rawTranscript = fullTranscriptForDisplay(call);
  const mediaRetentionExpired =
    !callerDataErased && isCallMediaRetentionExpired(call.createdAt);
  const mediaRetentionExpiredMessage = mediaRetentionExpired
    ? formatCallMediaRetentionExpiredMessage(call.createdAt)
    : null;
  const name = callDisplayName(call);
  const phone = call.callerDisplay.trim() || "Unknown number";
  const showCallerName =
    name !== phone && !isUnknownCallerLabel(name) && name.trim().length > 0;
  const callStatus = resolveCallHistoryListStatus({
    outcome: call.outcome,
    aiSummary: call.aiSummary,
    postCallStatus: call.postCallStatus,
    followUpSummary: call.followUp?.summary ?? null,
    hasOpenAction: call.hasOpenAction,
    callResolution: call.callResolution,
  });
  const { copy } = useDashboardVertical();
  const followUpHref = call.followUp
    ? (call.departmentLink?.href ??
        dashboardFollowUpTicketHref({
          verticalId: copy.vertical.id,
          ticketId: call.followUp.id,
          departmentSlug: call.departmentLink?.slug ?? null,
          summary: call.followUp.summary ?? call.aiSummary,
        }))
    : null;

  function onConfirmBlock() {
    if (!callerE164) return;
    setBlockMsg(null);
    startTransition(async () => {
      const result = await addBlockedCaller({ phone: callerE164 });
      setBlockConfirmOpen(false);
      if (!result.ok) {
        setBlockMsg(result.message);
        return;
      }
      setBlockMsg("Caller blocked.");
      onRefresh();
    });
  }

  function onConfirmUnblock() {
    if (!callerE164) return;
    setBlockMsg(null);
    startTransition(async () => {
      const result = await removeBlockedCallerByPhone({ phone: callerE164 });
      setUnblockConfirmOpen(false);
      if (!result.ok) {
        setBlockMsg(result.message);
        return;
      }
      setBlockMsg("Caller unblocked.");
      onRefresh();
    });
  }

  function onConfirmEraseCallerData(input: {
    reason: string;
    performedBy: string;
    confirm: string;
  }) {
    if (!callerE164) return;
    setEraseMsg(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("phone", callerE164);
      formData.set("performedBy", input.performedBy);
      formData.set("reason", input.reason);
      formData.set("confirm", input.confirm);
      const result = await eraseCustomerData(formData);
      setEraseConfirmOpen(false);
      if (!result.ok) {
        setEraseMsg(result.message);
        return;
      }
      const { affected } = result;
      setEraseMsg(
        `Caller data erased (${affected.call_logs_redacted} call${affected.call_logs_redacted === 1 ? "" : "s"}, ${affected.action_tickets_redacted} ticket${affected.action_tickets_redacted === 1 ? "" : "s"}).`,
      );
      onRefresh();
    });
  }

  return (
    <DetailPanelShell surface="embedded">
      <div className="shrink-0 border-b border-[#dfe7e2] bg-[#f6faf7] px-5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-tight text-[#11181d]">
              {callerDataErased
                ? "Caller data erased"
                : engineerTestCall
                  ? ENGINEER_TEST_CALL_DETAIL_TITLE
                  : phone}
            </h2>
            {showCallerName && !callerDataErased && !engineerTestCall ? (
              <p className="mt-0.5 text-[13px] text-[#5b6b65]">{name}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-[#6b7c75]">
            <span className="whitespace-nowrap">
              {call.dateTimeLabel}
              <span className="text-slate-300"> · </span>
              <span className="tabular-nums">{call.durationLabel}</span>
            </span>
            {callerDataErased ? (
              <StatusPill className={CALLER_DATA_ERASED_BADGE_CLASS}>Erased</StatusPill>
            ) : engineerTestCall ? (
              <StatusPill className="border-slate-200 bg-slate-50 text-slate-700">
                Not billed
              </StatusPill>
            ) : (
              <StatusPill className={CALL_HISTORY_STATUS_BADGE_CLASSES[callStatus.tone]}>
                {callStatus.label}
              </StatusPill>
            )}
            {callNeedsPostCallReviewBanner(call) ? (
              <StatusPill variant="attention">Processing issue</StatusPill>
            ) : null}
          </div>
        </div>
      </div>

      <DetailPanelBody className="space-y-0 px-0 py-0">
        {callNeedsPostCallReviewBanner(call) ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-[13px] leading-relaxed text-amber-950">
            {CALL_POST_PROCESSING_BANNER}
          </div>
        ) : null}

        <DetailSectionRow title={engineerTestCall ? "About this test" : "Summary"}>
          <p className="text-[14px] leading-relaxed text-[#11181d]">
            {summary ??
              (engineerTestCall
                ? ENGINEER_TEST_CALL_SUMMARY
                : callerDataErased
                  ? "Personal data for this call has been removed."
                  : "No summary available.")}
          </p>
        </DetailSectionRow>

        {!engineerTestCall && mediaRetentionExpiredMessage ? (
          <div className="border-b border-[#eef3f0] bg-slate-50 px-5 py-3 text-[13px] leading-relaxed text-slate-600">
            {mediaRetentionExpiredMessage}
          </div>
        ) : null}

        {callerDataErased ? (
          <DetailSectionRow title="Caller data">
            <dl className="space-y-2 text-[13px] leading-relaxed text-[#11181d]">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
                  Erased on
                </dt>
                <dd className="mt-0.5">
                  {call.callerDataErasedAt
                    ? formatCallerDataErasedAt(call.callerDataErasedAt)
                    : "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
                  Erased by
                </dt>
                <dd className="mt-0.5">
                  {call.callerDataErasedByLabel?.trim() || "Staff member"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
                  Reason
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">
                  {call.callerDataErasedReason?.trim() || "No reason recorded"}
                </dd>
              </div>
            </dl>
          </DetailSectionRow>
        ) : null}

        {!engineerTestCall ? (
        <DetailSectionRow title="Recording" contentClassName="mt-1.5">
          {callerDataErased ? (
            <p className="text-[13px] text-slate-500">
              Recording removed when caller data was erased.
            </p>
          ) : mediaRetentionExpired ? (
            <p className="text-[13px] text-slate-500">
              Recording no longer available — deleted after 30 days.
            </p>
          ) : (
            <CallAudioPlayer
              callLogId={call.id}
              createdAt={call.createdAt}
              callerNumber={call.callerId}
              callerName={call.callerName}
              hasRecording={call.hasRecording}
              embedded
            />
          )}
        </DetailSectionRow>
        ) : null}

        {!engineerTestCall ? (
        <DetailSectionRow title="Transcript">
          {callerDataErased ? (
            <p className="text-[13px] text-slate-500">
              Transcript removed when caller data was erased.
            </p>
          ) : mediaRetentionExpired ? (
            <p className="text-[13px] text-slate-500">
              Transcript no longer available — deleted after 30 days.
            </p>
          ) : detailLoading ? (
            <p className="text-[13px] text-slate-500">Loading transcript…</p>
          ) : rawTranscript ? (
            <StaffTranscriptView text={rawTranscript} />
          ) : (
            <p className="text-[13px] text-slate-500">No transcript available.</p>
          )}
        </DetailSectionRow>
        ) : null}
      </DetailPanelBody>

      {!engineerTestCall ? (
      <DetailPanelFooter>
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {canManageBlock ? (
              isBlocked ? (
                <DetailActionButton
                  type="button"
                  onClick={() => setUnblockConfirmOpen(true)}
                  disabled={pending}
                >
                  <ShieldOff className="size-3.5" aria-hidden />
                  Unblock
                </DetailActionButton>
              ) : (
                <DetailActionButton
                  type="button"
                  onClick={() => setBlockConfirmOpen(true)}
                  disabled={pending}
                >
                  <Ban className="size-3.5" aria-hidden />
                  Block this caller
                </DetailActionButton>
              )
            ) : null}
            <DetailActionButton onClick={onCopySummary} disabled={!summary}>
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy summary"}
            </DetailActionButton>
            {!callerDataErased ? (
              <DetailActionButton
                type="button"
                onClick={() => setCallerHistoryOpen(true)}
              >
                <History className="size-3.5" aria-hidden />
                Caller history
              </DetailActionButton>
            ) : null}
            {followUpHref && !callerDataErased ? (
              <DetailActionButton href={followUpHref}>
                {call.departmentLink ? (
                  <Store className="size-3.5" aria-hidden />
                ) : (
                  <Inbox className="size-3.5" aria-hidden />
                )}
                {call.departmentLink?.buttonLabel ?? "View follow-up"}
              </DetailActionButton>
            ) : null}
          </div>

          {!callerDataErased ? (
            <div className="flex shrink-0 items-center gap-3">
              {canDeleteCallerData ? (
                <DetailActionButton
                  type="button"
                  onClick={() => setEraseConfirmOpen(true)}
                  disabled={pending}
                  className="border-red-200 text-red-800 hover:border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete caller data
                </DetailActionButton>
              ) : null}
              {!mediaRetentionExpired ? (
                <CallMediaRetentionNote createdAt={call.createdAt} />
              ) : null}
            </div>
          ) : null}
        </div>
      </DetailPanelFooter>
      ) : null}

      {blockMsg ? (
        <p className="px-5 pb-3 text-[12px] text-slate-600">{blockMsg}</p>
      ) : null}
      {eraseMsg ? (
        <p className="px-5 pb-3 text-[12px] text-slate-600">{eraseMsg}</p>
      ) : null}

      <ConfirmDialog
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        title="Block this caller?"
        description="Future calls from this number will hear a short message and hang up before Cara answers. You can undo this in Settings."
        confirmLabel="Block caller"
        onConfirm={onConfirmBlock}
        pending={pending}
        destructive
      />
      <ConfirmDialog
        open={unblockConfirmOpen}
        onOpenChange={setUnblockConfirmOpen}
        title="Unblock this caller?"
        description="They will be able to reach Cara again on your line."
        confirmLabel="Unblock"
        onConfirm={onConfirmUnblock}
        pending={pending}
        destructive
      />
      <CallerDataEraseDialog
        open={eraseConfirmOpen}
        onOpenChange={setEraseConfirmOpen}
        phoneDisplay={phone}
        callerName={showCallerName ? name : null}
        pending={pending}
        onConfirm={onConfirmEraseCallerData}
      />
      <CallerHistoryDialog
        open={callerHistoryOpen}
        onOpenChange={setCallerHistoryOpen}
        callerNumber={call.callerId}
        currentCallId={call.id}
        phoneDisplay={callerDataErased ? "Caller data erased" : phone}
        callerDataErased={callerDataErased}
        erasureAudit={{
          callerDataErasedAt: call.callerDataErasedAt,
          callerDataErasedByLabel: call.callerDataErasedByLabel,
          callerDataErasedReason: call.callerDataErasedReason,
        }}
        onSelectCall={openPastCall}
      />
    </DetailPanelShell>
  );
}
