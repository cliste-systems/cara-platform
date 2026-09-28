import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAdminGlobalMetricRange } from "./admin-metric-range";
import { formatDashboardFeedRelativeTime } from "./dashboard-feed-time";
import { isAdminDemoCallRow } from "./engineer-test-call";
import { loadServiceStatus } from "./admin-service-status-server";
type FeedCall = {id:string;call_id:string|null;name:string;caller:string;at:string;duration_seconds:number;room_name:string|null;caller_number:string|null;is_test_call:boolean;engineer_test_call:boolean;active:boolean;post_call_status:string};
type FeedIssue = {id:string;title:string;detail:string;href:string;at:string};
export async function loadAdminOverview(page = 0, size = 8, issuePage = 0, issueSize = 8, includeServices = true) {
  const servicesPromise = includeServices ? loadServiceStatus() : Promise.resolve([]);
  const { startIso, endExclusiveIso } = getAdminGlobalMetricRange("day");
  const admin = createAdminClient();
  const [stats, feeds] = await Promise.all([
    admin.rpc("admin_overview_snapshot", { p_start: startIso, p_end: endExclusiveIso }),
    admin.rpc("admin_overview_feeds", {p_start:startIso,p_end:endExclusiveIso,p_page:page,p_size:size,p_issue_page:issuePage,p_issue_size:issueSize}),
  ]);
  const feed = feeds.data as {total:number;calls:FeedCall[];issueTotal:number;issues:FeedIssue[]}|null;
  return {
    page, size, issuePage, issueSize, total: feed?.total ?? 0, issueTotal:feed?.issueTotal ?? 0,
    stats: stats.error ? null : { ...(stats.data as {calls:number;minutes:number;support:number;failed:number}), calls: feed?.total ?? stats.data.calls },
    error: stats.error || feeds.error ? "Some overview data could not be loaded. Retrying automatically." : null,
    services: await servicesPromise,
    calls: (feed?.calls ?? []).map(c=>({id:c.id,callId:c.call_id,active:c.active,name:c.name || "Unknown customer",detail:`${c.caller} · ${c.active ? "In progress" : `${isAdminDemoCallRow(c) ? "Demo" : c.engineer_test_call ? "Engineer" : c.is_test_call ? "Demo" : "Live"} · ${(c.duration_seconds/60).toFixed(1)} min`}`,time:c.active ? "Live now" : formatDashboardFeedRelativeTime(c.at),status:c.post_call_status})),
    issues:(feed?.issues ?? []).map(issue=>({...issue,time:formatDashboardFeedRelativeTime(issue.at)})),
  };
}
export type AdminOverview = Awaited<ReturnType<typeof loadAdminOverview>>;
