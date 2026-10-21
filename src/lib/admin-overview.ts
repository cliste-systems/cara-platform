import "server-only";
import { CALL_ANALYSIS_VERSION } from "./call-analysis-simple";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAdminGlobalMetricRange } from "./admin-metric-range";
import { formatDashboardFeedRelativeTime } from "./dashboard-feed-time";
import { overviewCallKind, overviewProcessingLabel, type OverviewIssueFilter } from "./admin-overview-model";
import { loadServiceStatus } from "./admin-service-status-server";

type FeedCall = {
  id: string; call_id: string | null; name: string; at: string; duration_seconds: number;
  room_name: string | null; caller_number: string | null; engineer_test_call: boolean;
  is_test_call: boolean; verification_call: boolean; active: boolean; post_call_status: string | null;
  analysis_status: string | null; verdict: string | null;
};
export type OverviewIssue = {
  id: string; callId: string | null; title: string; detail: string; href: string;
  at: string; priority: number; signature: string | null; reasons: string[]; time: string;
};
export type OverviewStats = {
  calls: number; customer: number; demo: number; engineer: number; verification: number;
  active: number; minutes: number; support: number; failed: number; failedReviews: number; failedCalls: number; processingIssues: number; pendingReviews: number;
};
export type OverviewHealth = {
  completed: number; voice: number; voiceAssessed: number;
  processing: number; processingAssessed: number; capture: number; captureAssessed: number;
};
type OperationsFeed = {
  total: number; calls: FeedCall[]; issueTotal: number;
  issues: Omit<OverviewIssue, "time">[]; stats: OverviewStats; health: OverviewHealth;
};

export async function loadAdminOverview(page = 0, size = 3, issuePage = 0, issueSize = 3, includeServices = true, issueFilter: OverviewIssueFilter = "all") {
  const { startIso, endExclusiveIso } = getAdminGlobalMetricRange("day");
  const [response, services, attention] = await Promise.all([
    createAdminClient().rpc("admin_operations_overview_for_version", {
      p_start: startIso, p_end: endExclusiveIso, p_version: CALL_ANALYSIS_VERSION, p_page: page, p_size: size,
      p_issue_page: issueFilter === "all" ? issuePage : 0, p_issue_size: issueFilter === "all" ? issueSize : 50,
    }),
    includeServices ? loadServiceStatus() : Promise.resolve([]),
    createAdminClient().rpc("admin_attention_queue", {p_filter:issueFilter,p_page:issuePage,p_size:issueSize}),
  ]);
  const feed = response.error ? null : response.data as OperationsFeed | null;
  const queue = attention.error ? null : attention.data as {total:number;issues:Omit<OverviewIssue,"time">[]} | null;
  return {
    page, size, issuePage, issueSize, issueFilter, total: feed?.total ?? 0, issueTotal: queue?.total ?? 0,
    stats: feed?.stats ?? null, health: feed?.health ?? null, services: services,
    checkedAt: new Date().toISOString(), date: startIso, dateEnd: endExclusiveIso,
    error: !feed ? "Overview data could not be loaded. Retrying automatically." : !queue ? "Attention queue could not be loaded. Retrying automatically." : null,
    calls: (feed?.calls ?? []).map(call => ({
      id: call.id, callId: call.call_id, active: call.active, name: call.name || "Unknown customer",
      at: call.at, kind: overviewCallKind(call), minutes: (call.duration_seconds / 60).toFixed(1),
      time: call.active ? "Live now" : formatDashboardFeedRelativeTime(call.at),
      status: overviewProcessingLabel(call.post_call_status, call.active),
      processingStatus: call.post_call_status, analysisStatus: call.analysis_status, verdict: call.verdict,
    })),
    issues: (queue?.issues ?? []).map(issue => ({ ...issue, time: formatDashboardFeedRelativeTime(issue.at) })),
  };
}
export type AdminOverview = Awaited<ReturnType<typeof loadAdminOverview>>;
