import { isAdminDemoCallRow, isEngineerTestCallRow } from "./engineer-test-call";

export type OverviewCallKind = "Customer" | "Demo" | "Engineer test" | "Verification";

export function overviewCallKind(call: {
  caller_number?: string | null;
  room_name?: string | null;
  engineer_test_call?: boolean | null;
  is_test_call?: boolean | null;
  verification_call?: boolean | null;
}): OverviewCallKind {
  if (isAdminDemoCallRow(call)) return "Demo";
  if (isEngineerTestCallRow(call)) return "Engineer test";
  if (call.verification_call) return "Verification";
  return call.is_test_call ? "Demo" : "Customer";
}

export function overviewProcessingLabel(status: string | null, active: boolean): string {
  if (active) return "Live now";
  switch (status) {
    case "complete": return "Processed";
    case "partial": return "Partially processed";
    case "failed": return "Processing failed";
    case "pending": return "Processing";
    default: return "Not assessed";
  }
}

export function overviewEvidenceLabel(count: number, assessed: number, total: number): string {
  if (!total) return "No completed calls today";
  if (!assessed) return "Evidence not available";
  if (assessed < total) return `${assessed} of ${total} calls assessed`;
  return count ? "Recorded in today’s calls" : "No issues in assessed calls";
}

export type OverviewIssueFilter = "all" | "calls" | "reviews" | "support" | "customers";

export function overviewIssueMatches(issue: { callId: string | null; href: string; reasons: string[] }, filter: OverviewIssueFilter): boolean {
  if (filter === "calls") return issue.callId !== null;
  if (filter === "reviews") return issue.callId !== null && issue.reasons.some(reason => /quality review/i.test(reason));
  if (filter === "customers") return issue.href.startsWith("/admin/customers/");
  if (filter === "support") return issue.href.startsWith("/admin/support/");
  return true;
}

/** Suppress older provider announcements even when their current status is degraded. */
export function overviewProviderIsToday(service: { reportedAt?: string; checkedAt: string }, start: string, end: string): boolean {
  const at = Date.parse(service.reportedAt ?? service.checkedAt);
  return Number.isFinite(at) && at >= Date.parse(start) && at < Date.parse(end);
}
