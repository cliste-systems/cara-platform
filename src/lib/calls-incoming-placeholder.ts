import type { DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";
import { isEngineerTestCallerNumber } from "@/lib/engineer-test-call";

export type CallsIncomingPlaceholder = {
  phase: "in_progress" | "loading";
  callerNumber: string | null;
  callLogId: string | null;
  startedAt: string;
  usageRecordId?: string | null;
  callSid?: string | null;
};

export function incomingCallPlaceholderKey(
  placeholder: Pick<CallsIncomingPlaceholder, "callLogId" | "usageRecordId" | "startedAt" | "callSid">,
): string {
  if (placeholder.callSid) return `sid-${placeholder.callSid}`;
  if (placeholder.callLogId) return `call-${placeholder.callLogId}`;
  if (placeholder.usageRecordId) return `usage-${placeholder.usageRecordId}`;
  return `started-${placeholder.startedAt}`;
}

export function upsertIncomingCallPlaceholder(
  current: CallsIncomingPlaceholder[],
  detail: DashboardIncomingCallDetail,
): CallsIncomingPlaceholder[] {
  const customers = current.filter((row) => !isEngineerTestCallerNumber(row.callerNumber));
  if (isEngineerTestCallerNumber(detail.callerNumber)) return customers;
  const linked = (detail.callSid ? customers.find((row) => row.callSid === detail.callSid) : null)
    ?? (detail.callLogId ? customers.find((row) => row.callLogId === detail.callLogId) : null)
    ?? (detail.usageRecordId ? customers.find((row) => row.usageRecordId === detail.usageRecordId) : null)
    ?? (detail.startedAt && detail.callerNumber ? customers.find((row) => {
      if (row.callLogId || row.callerNumber !== detail.callerNumber) return false;
      // Never coalesce distinct identified calls, including repeat callers.
      if (row.callSid && detail.callSid && row.callSid !== detail.callSid) return false;
      if (row.usageRecordId && detail.usageRecordId && row.usageRecordId !== detail.usageRecordId) return false;
      return Math.abs(Date.parse(row.startedAt) - Date.parse(detail.startedAt!)) <= 5_000;
    }) : null);
  const map = new Map(customers.map((row) => [incomingCallPlaceholderKey(row), row]));
  if (linked) map.delete(incomingCallPlaceholderKey(linked));
  const merged = mergeIncomingCallEvent(linked ?? null, detail);
  map.set(incomingCallPlaceholderKey(merged), merged);
  return [...map.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function filterActiveIncomingCallPlaceholders(
  placeholders: CallsIncomingPlaceholder[],
  calls: ReadonlyArray<{ id: string; createdAt: string; engineerTestCall?: boolean }>,
): CallsIncomingPlaceholder[] {
  return placeholders.filter((row) => !shouldClearCallsIncomingPlaceholder(row, calls));
}

export function shouldShowCallsIncomingPlaceholder(options: {
  viewingToday: boolean;
  page: number;
  placeholder: CallsIncomingPlaceholder | null;
}): boolean {
  return options.placeholder != null && !isEngineerTestCallerNumber(options.placeholder.callerNumber)
    && options.viewingToday && options.page <= 1;
}

/** Only customer rows can complete a customer placeholder. */
export function shouldClearCallsIncomingPlaceholder(
  placeholder: CallsIncomingPlaceholder,
  calls: ReadonlyArray<{ id: string; createdAt: string; engineerTestCall?: boolean }>,
): boolean {
  if (isEngineerTestCallerNumber(placeholder.callerNumber)) return true;
  const customers = calls.filter((row) => !row.engineerTestCall);
  if (placeholder.callLogId) return customers.some((row) => row.id === placeholder.callLogId);
  const startedMs = Date.parse(placeholder.startedAt);
  if (!Number.isFinite(startedMs)) return true;
  return customers.some((row) => Date.parse(row.createdAt) >= startedMs - 5_000);
}

export function mergeIncomingCallEvent(
  current: CallsIncomingPlaceholder | null,
  event: DashboardIncomingCallDetail,
): CallsIncomingPlaceholder {
  const startedAt = event.startedAt ?? current?.startedAt ?? new Date().toISOString();
  const callSid = event.callSid ?? current?.callSid;
  const sameIdentifiedCall = Boolean(event.callSid && current?.callSid === event.callSid);
  const retainLoading = sameIdentifiedCall && current?.phase === "loading";
  if (event.phase === "loading" || retainLoading) {
    return {
      phase: "loading", callerNumber: event.callerNumber ?? current?.callerNumber ?? null,
      callLogId: event.callLogId ?? current?.callLogId ?? null,
      usageRecordId: current?.usageRecordId ?? event.usageRecordId ?? null,
      startedAt: retainLoading ? current!.startedAt : startedAt,
      ...(callSid ? { callSid } : {}),
    };
  }
  return {
    phase: "in_progress", callerNumber: event.callerNumber ?? current?.callerNumber ?? null,
    callLogId: sameIdentifiedCall || !event.callSid ? current?.callLogId ?? null : null,
    usageRecordId: event.usageRecordId ?? (sameIdentifiedCall || !event.callSid ? current?.usageRecordId : null) ?? null,
    startedAt, ...(callSid ? { callSid } : {}),
  };
}
