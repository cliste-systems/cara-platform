import {
  mergeIncomingCallEvent,
  shouldClearCallsIncomingPlaceholder,
  type CallsIncomingPlaceholder,
} from "@/lib/calls-incoming-placeholder";
import type { DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";
import { isEngineerTestCallerNumber } from "@/lib/engineer-test-call";

const STORAGE_PREFIX = "cliste:calls-incoming:";
function storageKey(organizationId: string): string { return `${STORAGE_PREFIX}${organizationId.trim()}`; }

export function readCallsIncomingPlaceholderSession(organizationId: string): CallsIncomingPlaceholder | null {
  if (typeof window === "undefined" || !organizationId.trim()) return null;
  try {
    const key = storageKey(organizationId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CallsIncomingPlaceholder;
    if ((parsed?.phase !== "in_progress" && parsed?.phase !== "loading") || !parsed.startedAt) return null;
    if (isEngineerTestCallerNumber(parsed.callerNumber) || !Number.isFinite(Date.parse(parsed.startedAt))) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function writeCallsIncomingPlaceholderSession(organizationId: string, placeholder: CallsIncomingPlaceholder | null): void {
  if (typeof window === "undefined" || !organizationId.trim()) return;
  try {
    const key = storageKey(organizationId);
    if (!placeholder || isEngineerTestCallerNumber(placeholder.callerNumber)) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(placeholder));
  } catch { /* Ignore unavailable storage. */ }
}

export function mergeCallsIncomingPlaceholderSession(
  organizationId: string, detail: DashboardIncomingCallDetail,
): CallsIncomingPlaceholder {
  const current = readCallsIncomingPlaceholderSession(organizationId);
  const next = mergeIncomingCallEvent(current, detail);
  // A rejected engineer event must not overwrite another customer's pending call.
  if (!isEngineerTestCallerNumber(detail.callerNumber)) writeCallsIncomingPlaceholderSession(organizationId, next);
  return next;
}

export function clearCallsIncomingPlaceholderSessionIfLoaded(
  organizationId: string,
  calls: ReadonlyArray<{ id: string; createdAt: string; engineerTestCall?: boolean }>,
): void {
  const saved = readCallsIncomingPlaceholderSession(organizationId);
  if (saved && shouldClearCallsIncomingPlaceholder(saved, calls)) writeCallsIncomingPlaceholderSession(organizationId, null);
}
