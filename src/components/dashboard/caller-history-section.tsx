"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchCallerHistoryInsight } from "@/app/(dashboard)/dashboard/call-history/actions";
import { DASHBOARD_SECONDARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildErasedCallerHistoryInsight,
  CALLER_HISTORY_FLAG_LABELS,
  type CallerHistoryInsight,
  type CallerHistoryRecentCall,
  type CallerHistorySecurityFlag,
} from "@/lib/caller-history-insight";
import {
  formatCallerDataErasedAt,
  type CallerDataErasureAudit,
} from "@/lib/caller-data-erasure";
import {
  CALL_HISTORY_STATUS_BADGE_CLASSES,
  type CallHistoryStatusTone,
} from "@/lib/call-history-status";
import {
  CALLER_SECURITY_LEVEL_LABELS,
  type CallerSecurityAssessment,
  type CallerSecurityLevel,
} from "@/lib/caller-security-level";
import { cn } from "@/lib/utils";
import privacyStyles from "./service-privacy-dialog.module.css";
import historyStyles from "./service-caller-history.module.css";

type CallerHistoryDialogProps = {
  serviceTheme?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callerNumber: string;
  currentCallId: string;
  phoneDisplay?: string;
  callerDataErased?: boolean;
  erasureAudit?: CallerDataErasureAudit | null;
  onSelectCall?: (callId: string, createdAt: string) => void;
};

function securityFlagVariant(flag: CallerHistorySecurityFlag): "attention" | "brand" | "success" {
  if (flag === "blocked" || flag === "open_complaints" || flag === "high_volume_today") {
    return "attention";
  }
  return "brand";
}

function securityLevelSurfaceClass(level: CallerSecurityLevel): string {
  switch (level) {
    case "high":
      return "border-red-200 bg-red-50/80";
    case "elevated":
      return "border-orange-200 bg-orange-50/70";
    case "watch":
      return "border-amber-200 bg-amber-50/70";
    default:
      return "border-emerald-200 bg-emerald-50/70";
  }
}

function securityLevelBadgeClass(level: CallerSecurityLevel): string {
  switch (level) {
    case "high":
      return "border-red-200 bg-white text-red-800";
    case "elevated":
      return "border-orange-200 bg-white text-orange-900";
    case "watch":
      return "border-amber-200 bg-white text-amber-950";
    default:
      return "border-emerald-200 bg-white text-emerald-800";
  }
}

function recentCallStatusBadgeClass(tone: CallHistoryStatusTone): string {
  return CALL_HISTORY_STATUS_BADGE_CLASSES[tone];
}

function RecentCallStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: CallHistoryStatusTone;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        recentCallStatusBadgeClass(tone),
      )}
    >
      {label}
    </span>
  );
}

function SecurityLevelSection({ security }: { security: CallerSecurityAssessment }) {
  const topReasons = security.reasons
    .slice()
    .sort((a, b) => {
      const order = { low: 0, watch: 1, elevated: 2, high: 3 };
      return order[b.level] - order[a.level];
    })
    .slice(0, 4);

  return (
    <section
      className={cn(
        "rounded-xl border px-4 py-3.5",
        securityLevelSurfaceClass(security.level),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
          Security level
        </p>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[12px] font-semibold",
            securityLevelBadgeClass(security.level),
          )}
        >
          {CALLER_SECURITY_LEVEL_LABELS[security.level]}
        </span>
      </div>

      {topReasons.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {topReasons.map((reason) => (
            <li
              key={reason.code}
              className="flex gap-2 text-[12px] leading-snug text-[#11181d]"
            >
              <span className="mt-[0.35rem] size-1.5 shrink-0 rounded-full bg-[#9da9a4]" />
              <span>{reason.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          No security concerns flagged for this caller yet.
        </p>
      )}

      {security.recommendation ? (
        <p className="mt-3 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
          {security.recommendation}
        </p>
      ) : null}
    </section>
  );
}

function CallerInsightPanel({
  insight,
}: {
  insight: Exclude<CallerHistoryInsight, { kind: "erased" }>;
}) {
  const flags = insight.kind === "anonymous" ? [] : insight.securityFlags;

  return (
    <div className="rounded-2xl border border-[#dfe7e2] bg-white">
      <div className="space-y-4 p-5 sm:p-6">
        <SecurityLevelSection security={insight.security} />

        <div className="border-t border-[#eef3f0] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
            Cara&apos;s read on this caller
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#11181d]">{insight.overview}</p>
          {flags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {flags.map((flag) => (
                <StatusPill key={flag} variant={securityFlagVariant(flag)}>
                  {CALLER_HISTORY_FLAG_LABELS[flag]}
                </StatusPill>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RecentCallCard({
  recent,
  currentCallId,
  onSelectCall,
}: {
  recent: CallerHistoryRecentCall;
  currentCallId: string;
  onSelectCall?: (callId: string, createdAt: string) => void;
}) {
  const isCurrent = recent.id === currentCallId;
  const body = recent.summary?.trim() || "No summary available for this call.";

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-slate-500">
          {recent.dateLabel}
          <span className="text-slate-300"> · </span>
          {recent.intentLabel}
          {isCurrent ? (
            <>
              <span className="text-slate-300"> · </span>
              This call
            </>
          ) : null}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#11181d]">{body}</p>
      </div>
      <RecentCallStatusBadge label={recent.statusLabel} tone={recent.statusTone} />
    </div>
  );

  if (isCurrent) {
    return (
      <div className="rounded-xl border border-[#353D42]/20 bg-[#f6faf7] px-3.5 py-3">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectCall?.(recent.id, recent.createdAt)}
      className="block w-full cursor-pointer rounded-xl border border-[#dfe7e2] bg-white px-3.5 py-3 text-left transition hover:border-[#9da9a4] hover:bg-[#fbfcfb]"
    >
      {content}
    </button>
  );
}

function PastCallsPanel({
  recentCalls,
  currentCallId,
  onSelectCall,
}: {
  recentCalls: CallerHistoryRecentCall[];
  currentCallId: string;
  onSelectCall?: (callId: string, createdAt: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#dfe7e2] bg-[#fbfcfb]">
      <div className="border-b border-[#eef3f0] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
          Past calls
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          {recentCalls.length} recent call{recentCalls.length === 1 ? "" : "s"} — tap to open
        </p>
      </div>
      <ul className="space-y-2 p-4 sm:p-5">
        {recentCalls.map((recent) => (
          <li key={recent.id}>
            <RecentCallCard
              recent={recent}
              currentCallId={currentCallId}
              onSelectCall={onSelectCall}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ErasedCallerHistoryPanel({
  insight,
}: {
  insight: Extract<CallerHistoryInsight, { kind: "erased" }>;
}) {
  const { audit } = insight;

  return (
    <div className="rounded-2xl border border-[#dfe7e2] bg-[#fbfcfb] px-5 py-5 sm:px-6">
      <p className="text-[14px] leading-relaxed text-[#11181d]">
        Caller data has been erased. Cara no longer keeps a profile, security read, or call
        summaries for this caller.
      </p>
      <dl className="mt-4 space-y-3 text-[13px] leading-relaxed text-[#11181d]">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
            Erased on
          </dt>
          <dd className="mt-0.5">
            {audit.erasedAt ? formatCallerDataErasedAt(audit.erasedAt) : "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
            Erased by
          </dt>
          <dd className="mt-0.5">{audit.erasedByLabel?.trim() || "Staff member"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
            Reason
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap">
            {audit.erasedReason?.trim() || "No reason recorded"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CallerHistoryBody({
  insight,
  currentCallId,
  onSelectCall,
}: {
  insight: CallerHistoryInsight;
  currentCallId: string;
  onSelectCall?: (callId: string, createdAt: string) => void;
}) {
  if (insight.kind === "erased") {
    return <ErasedCallerHistoryPanel insight={insight} />;
  }

  return (
    <div className="space-y-5 pb-1">
      <CallerInsightPanel insight={insight} />

      {insight.kind === "repeat" ? (
        <PastCallsPanel
          recentCalls={insight.recentCalls}
          currentCallId={currentCallId}
          onSelectCall={onSelectCall}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#dfe7e2] bg-[#fbfcfb] px-6 py-10 text-center">
          <p className="mx-auto max-w-sm text-[14px] leading-relaxed text-slate-600">
            Past calls will appear here once this number has called more than once.
          </p>
        </div>
      )}
    </div>
  );
}

export function CallerHistoryDialog({
  serviceTheme = false,
  open,
  onOpenChange,
  callerNumber,
  currentCallId,
  phoneDisplay,
  callerDataErased = false,
  erasureAudit = null,
  onSelectCall,
}: CallerHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<CallerHistoryInsight | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    if (callerDataErased) {
      setLoading(false);
      setInsight(buildErasedCallerHistoryInsight(erasureAudit));
      return;
    }

    setLoading(true);
    setInsight(null);

    void fetchCallerHistoryInsight({
      callerNumber,
      currentCallId,
    })
      .then((result) => {
        if (cancelled) return;
        setInsight(result);
      })
      .catch(() => { if (!cancelled) setInsight(null); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, callerNumber, currentCallId, callerDataErased, erasureAudit]);

  const securityLevel =
    insight && insight.kind !== "erased" ? insight.security.level : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName={serviceTheme ? privacyStyles.backdrop : undefined}
        className={cn(
          "top-[5vh] flex w-[calc(100%-2rem)] max-h-[min(82vh,760px)] translate-y-0 flex-col gap-0 overflow-hidden",
          "border border-slate-200 bg-white p-0 sm:max-w-3xl",
          serviceTheme && privacyStyles.popup,
          serviceTheme && historyStyles.popup,
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-slate-100 px-5 pb-4 pt-5 text-left sm:px-7 sm:pt-6">
          {serviceTheme && <div aria-hidden="true" className={historyStyles.art}/> }
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="text-[18px] font-semibold tracking-tight text-[#0b1220]">
                Caller history
              </DialogTitle>
              {phoneDisplay ? (
                <p className="mt-1 text-[14px] leading-relaxed text-slate-600">
                  <span className="font-semibold tabular-nums text-[#11181d]">{phoneDisplay}</span>
                </p>
              ) : null}
            </div>
            {securityLevel && !serviceTheme ? (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] font-semibold",
                  securityLevelBadgeClass(securityLevel),
                )}
              >
                {CALLER_SECURITY_LEVEL_LABELS[securityLevel]}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5 sm:px-7 sm:py-6">
          {loading ? (
            <div className="flex items-center gap-2 text-[14px] text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading caller history…
            </div>
          ) : insight ? (
            <CallerHistoryBody
              insight={insight}
              currentCallId={currentCallId}
              onSelectCall={onSelectCall}
            />
          ) : (
            <p className="text-[14px] text-slate-500">Caller history is unavailable. Close and reopen to try again.</p>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 flex-row justify-end rounded-none border-t border-slate-100 bg-[#fbfcfb] px-5 py-5 sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={DASHBOARD_SECONDARY_BUTTON_CLASS}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
