"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Copy, Inbox, MessageSquare, ScrollText, Search } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { CallerTextBackDialog } from "@/components/dashboard/caller-text-back-dialog";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  DetailActionButton,
  DetailPanelShell,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { buildCallsPageHref } from "@/lib/calls-page-href";
import {
  attentionRowAccent,
  resolveAttentionTag,
  resolveTicketAttentionLevel,
} from "@/lib/call-attention-level";
import { callerSmsEligibility } from "@/lib/caller-line-sms";
import {
  ENGINEER_TEST_CALL_BADGE_LABEL,
  ENGINEER_TEST_CALL_DETAIL_TITLE,
  ENGINEER_TEST_TICKET_BLOCK_MESSAGE,
} from "@/lib/engineer-test-call";
import { cn } from "@/lib/utils";

import { markTicketReopen, markTicketResolved } from "../../action-inbox/actions";
import {
  copyDetailsText,
  departmentInboxListMetaLine,
  departmentInboxListPrimaryLine,
  departmentListPreview,
  displayActionTicketSummary,
  hasKnownCallerName,
  inboxCallerMetaLine,
  isUnderReviewTicket,
  actionTicketUnderReviewCopy,
  matchesActionSearch,
  type ActionInboxItem,
  type ActionInboxMetrics,
} from "../../action-inbox/action-inbox-helpers";
import {
  parseDepartmentRequestSummary,
} from "@/lib/department-request-summary";
import { DepartmentRequestSummaryCard } from "@/components/dashboard/department-request-summary-card";

type StatusTab = "open" | "resolved";

type DepartmentInboxViewProps = {
  items: ActionInboxItem[];
  metrics: ActionInboxMetrics;
  initialSelectedTicketId?: string | null;
  className?: string;
};

export function DepartmentInboxView({
  items,
  metrics: _metrics,
  initialSelectedTicketId = null,
  className,
}: DepartmentInboxViewProps) {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusTab>(() => {
    if (
      initialSelectedTicketId &&
      items.some(
        (i) => i.id === initialSelectedTicketId && i.status === "open",
      )
    ) {
      return "open";
    }
    return items.some((i) => i.status === "open") ? "open" : "resolved";
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedTicketId,
  );
  const [copied, setCopied] = useState(false);

  const openCount = items.filter((i) => i.status === "open").length;
  const resolvedCount = items.filter((i) => i.status === "resolved").length;

  const tabItems = useMemo(
    () => items.filter((i) => i.status === statusTab),
    [items, statusTab],
  );

  const filtered = useMemo(() => {
    return tabItems.filter((i) => matchesActionSearch(i, search));
  }, [tabItems, search]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((i) => i.id === selectedId)) return selectedId;
    return filtered[0]?.id ?? null;
  }, [selectedId, filtered]);

  const selected = useMemo(
    () => filtered.find((i) => i.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const copyDetails = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(copyDetailsText(selected));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected]);

  const isOpenQueue = statusTab === "open";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      <div
        className="inline-flex w-full max-w-sm shrink-0 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-0.5"
        role="tablist"
        aria-label="Request status"
      >
        {(
          [
            { id: "open" as const, label: "To do", count: openCount },
            { id: "resolved" as const, label: "Done", count: resolvedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusTab === tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              "min-w-0 flex-1 rounded-md px-4 py-2.5 text-[14px] font-semibold transition-colors",
              statusTab === tab.id
                ? "bg-[#11181d] text-white shadow-sm"
                : "text-[#5b6b65] hover:bg-white hover:text-[#11181d]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 tabular-nums",
                statusTab === tab.id ? "text-white/80" : "text-slate-400",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <ListDetailLayout
          className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
          list={
            <div
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden max-xl:border-b max-xl:border-[#dfe7e2] xl:border-r",
                "border-[#dfe7e2] bg-[#fbfcfb] xl:border-r-[#dfe7e2]",
              )}
            >
              <div className="shrink-0 border-b border-inherit px-4 py-3 sm:px-5">
                <p className="text-[14px] font-semibold text-[#11181d]">
                  {isOpenQueue ? "Requests" : "Completed"}
                </p>
                <div className="relative mt-2">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or phone"
                    aria-label="Search requests"
                    className="h-10 w-full border-[#b9c8c1] bg-white py-1 pl-8 text-[14px] placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3",
                  filtered.length === 0 && "flex items-center justify-center",
                )}
              >
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={statusTab === "open" ? CheckCircle2 : Inbox}
                    title={statusTab === "open" ? "All clear" : "Nothing done yet"}
                    description={
                      statusTab === "open"
                        ? "New customer requests from Cara will show up here."
                        : "Completed requests appear here."
                    }
                    className="w-full py-10"
                  />
                ) : (
                  <ul className="space-y-2" role="listbox" aria-label="Department requests">
                    {filtered.map((row) => (
                      <DepartmentListRow
                        key={row.id}
                        row={row}
                        selected={row.id === resolvedSelectedId}
                        onSelect={() => setSelectedId(row.id)}
                        tinted={isOpenQueue}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          }
          detail={
            <DepartmentDetailPanel
              item={selected}
              copied={copied}
              onCopyDetails={copyDetails}
              onRefresh={() => router.refresh()}
            />
          }
        />
      </section>
    </div>
  );
}

function DepartmentListRow({
  row,
  selected,
  onSelect,
  tinted,
}: {
  row: ActionInboxItem;
  selected: boolean;
  onSelect: () => void;
  tinted: boolean;
}) {
  const preview = departmentListPreview(row);
  const engineerTestCall = row.engineerTestCall;
  const attentionLevel = resolveTicketAttentionLevel(row.category, row.status);
  const attention = engineerTestCall
    ? {
        rowAccentClass: "border-l-2 border-l-slate-200",
        selectedRowAccentClass: "border-l-2 border-l-slate-400",
      }
    : attentionRowAccent(attentionLevel, row.category);
  const attentionTag = engineerTestCall
    ? null
    : resolveAttentionTag({
        level: attentionLevel,
        category: row.category,
      });

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "w-full rounded-lg border px-3 py-3 text-left",
          selected
            ? cn(
                "border-[#353D42] bg-[#f6faf7] shadow-[0_1px_0_rgba(17,24,29,0.04)]",
                attention.selectedRowAccentClass,
              )
            : cn(
                tinted ? "border-[#cfd9d4] bg-white" : "border-[#dfe7e2] bg-white/90",
                attention.rowAccentClass,
              ),
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-[#0b1220]">
            {departmentInboxListPrimaryLine(row)}
          </p>
          {engineerTestCall ? (
            <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-700 uppercase">
              {ENGINEER_TEST_CALL_BADGE_LABEL}
            </span>
          ) : attentionTag ? (
            <span
              className={cn(
                "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                attentionTag.tagClassName,
              )}
            >
              {attentionTag.label}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-slate-600">
          {preview}
        </p>
        <p className="mt-1.5 text-[12px] text-slate-500 tabular-nums">
          {engineerTestCall ? (
            <>
              {departmentInboxListMetaLine(row)}
              <span className="text-slate-300"> · </span>
              {row.createdAtLabel}
            </>
          ) : (
            row.createdAtLabel
          )}
        </p>
      </button>
    </li>
  );
}

function DepartmentDetailPanel({
  item,
  copied,
  onCopyDetails,
  onRefresh,
}: {
  item: ActionInboxItem | null;
  copied: boolean;
  onCopyDetails: () => void;
  onRefresh: () => void;
}) {
  if (!item) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <EmptyState
            icon={Inbox}
            title="Pick a request"
            description="Select one from the list to see who to call and what they need."
            className="w-full py-10"
          />
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <DepartmentDetailContent
      key={item.id}
      item={item}
      copied={copied}
      onCopyDetails={onCopyDetails}
      onRefresh={onRefresh}
    />
  );
}

function DepartmentDetailContent({
  item,
  copied,
  onCopyDetails,
  onRefresh: _onRefresh,
}: {
  item: ActionInboxItem;
  copied: boolean;
  onCopyDetails: () => void;
  onRefresh: () => void;
}) {
  const hasPhone = item.callerNumber.trim().length > 0;
  const tel = hasPhone ? `tel:${item.callerNumber.replace(/[^\d+]/g, "")}` : null;
  const isOpen = item.status === "open";
  const engineerTestCall = item.engineerTestCall;
  const summaryText = displayActionTicketSummary(item.summary, undefined, {
    underReview: isUnderReviewTicket(item),
  });
  const requestSummary = parseDepartmentRequestSummary(item.summary);
  const attentionLevel = resolveTicketAttentionLevel(item.category, item.status);
  const attentionTag = resolveAttentionTag({
    level: attentionLevel,
    category: item.category,
  });
  const [textBackOpen, setTextBackOpen] = useState(false);
  const [textBackNotice, setTextBackNotice] = useState<string | null>(null);
  const callsHref = buildCallsPageHref({
    callLogId: item.callLogId,
    callCreatedAt: item.callLogCreatedAt ?? item.createdAt,
  });

  function onTextBackClick() {
    const eligibility = callerSmsEligibility(item.callerNumber);
    if (!eligibility.canText) {
      setTextBackNotice(eligibility.reason);
      setTextBackOpen(false);
      return;
    }
    setTextBackNotice(null);
    setTextBackOpen(true);
  }

  const [previousItemId, setPreviousItemId] = useState(item.id);
  if (previousItemId !== item.id) {
    setPreviousItemId(item.id);
    setTextBackNotice(null);
    setTextBackOpen(false);
  }

  if (engineerTestCall) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="shrink-0 border-b border-[#dfe7e2] bg-[#f6faf7] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-[#11181d]">
              {ENGINEER_TEST_CALL_DETAIL_TITLE}
            </h2>
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-[#6b7c75]">
              <span className="whitespace-nowrap tabular-nums">{item.createdAtLabel}</span>
              <StatusPill className="border-slate-200 bg-slate-50 text-slate-700">
                Not billed
              </StatusPill>
              <StatusPill className="border-slate-200 bg-slate-50 text-slate-700">
                {ENGINEER_TEST_CALL_BADGE_LABEL}
              </StatusPill>
            </div>
          </div>

          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-700">
            {ENGINEER_TEST_TICKET_BLOCK_MESSAGE}
          </p>

          {requestSummary ? (
            <DepartmentRequestSummaryCard
              summary={requestSummary}
              callerName={item.callerName}
              callerDisplay={item.callerDisplay}
              callerTel={tel}
              showCallerName={hasKnownCallerName(item)}
              className="border-slate-200 bg-white"
            />
          ) : (
            <p className="mt-4 text-[15px] leading-relaxed text-[#11181d]">{summaryText}</p>
          )}
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <DetailPanelShell surface="embedded">
      <div className="shrink-0 border-b border-[#dfe7e2] bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill variant={isOpen ? "brand" : "success"} dot>
            {isOpen ? "To do" : "Done"}
          </StatusPill>
          {isOpen && attentionTag ? (
            <StatusPill className={attentionTag.tagClassName}>
              {attentionTag.label}
            </StatusPill>
          ) : null}
          {isUnderReviewTicket(item) ? (
            <StatusPill variant="attention">Under review</StatusPill>
          ) : null}
          <span className="text-[12px] text-slate-500 tabular-nums">{item.createdAtLabel}</span>
        </div>

        {isUnderReviewTicket(item) ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-950">
            {actionTicketUnderReviewCopy()}
          </p>
        ) : null}

        {requestSummary ? (
          <DepartmentRequestSummaryCard
            summary={requestSummary}
            callerName={item.callerName}
            callerDisplay={item.callerDisplay}
            callerTel={tel}
            showCallerName={hasKnownCallerName(item)}
          />
        ) : (
          <>
            <p className="mt-4 text-[20px] font-semibold leading-snug tracking-tight text-[#0b1220] sm:text-[22px]">
              {summaryText}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[16px] font-semibold text-[#0b1220]">
                {hasKnownCallerName(item) ? item.callerName : "Unknown caller"}
              </span>
              {hasPhone ? (
                <a
                  href={tel!}
                  className="text-[18px] font-semibold tabular-nums text-[#353D42] underline-offset-2 hover:underline"
                >
                  {item.callerDisplay}
                </a>
              ) : (
                <span className="text-[15px] text-slate-500">No phone left</span>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <DetailActionButton href={callsHref} className="min-h-11 px-4">
            <ScrollText className="size-4" aria-hidden />
            Open in Calls
          </DetailActionButton>
          {isOpen ? (
            <form action={markTicketResolved}>
              <input type="hidden" name="ticketId" value={item.id} />
              <DetailActionButton type="submit" className="min-h-11 px-5 text-[14px] font-semibold">
                Mark done
              </DetailActionButton>
            </form>
          ) : null}
          {!isOpen ? (
            <form action={markTicketReopen}>
              <input type="hidden" name="ticketId" value={item.id} />
              <DetailActionButton type="submit" className="min-h-11 px-5 text-[14px] font-semibold">
                Reopen
              </DetailActionButton>
            </form>
          ) : null}
          {hasPhone ? (
            <DetailActionButton
              type="button"
              onClick={onTextBackClick}
              className="min-h-11 px-4"
            >
              <MessageSquare className="size-4" aria-hidden />
              Text back
            </DetailActionButton>
          ) : null}
          <DetailActionButton type="button" onClick={onCopyDetails} className="min-h-11 px-4">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </DetailActionButton>
        </div>

        {textBackNotice ? (
          <p
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-950"
            role="alert"
          >
            {textBackNotice}
          </p>
        ) : null}
      </div>

      {hasPhone ? (
        <CallerTextBackDialog
          open={textBackOpen}
          onOpenChange={setTextBackOpen}
          ticketId={item.id}
          callerName={item.callerName}
          callerDisplay={item.callerDisplay}
          callerNumber={item.callerNumber}
        />
      ) : null}
    </DetailPanelShell>
  );
}
