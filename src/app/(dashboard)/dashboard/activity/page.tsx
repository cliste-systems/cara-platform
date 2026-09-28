import { redirect } from "next/navigation";

import {
  callsPageDateGreetingSubline,
  getCallsPageDayBoundsIso,
  parseCallsPageDateParam,
} from "@/lib/calls-page-date";
import { buildDashboardActivityFeed } from "@/lib/dashboard-activity-feed";
import { ACTIVITY_FEED_LIMIT } from "@/lib/dashboard-list-limits";
import { formatDashboardFeedRelativeTime } from "@/lib/dashboard-feed-time";
import { ALL_LOCATIONS_VIEW_COOKIE } from "@/lib/account-locations";
import { resolveDashboardOrganizationScope } from "@/lib/dashboard-scope";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  customerCallFilters,
  customerTicketFilters,
  ENGINEER_CALL_FILTER,
} from "@/lib/dashboard-customer-data";
import { cookies } from "next/headers";

import { ActivityView } from "./activity-view";

export const dynamic = "force-dynamic";

type ActivityPageProps = {
  searchParams?: Promise<{ date?: string; range?: string }>;
};

function applyDayBounds<T extends {
  gte: (col: string, v: string) => T;
  lt: (col: string, v: string) => T;
}>(query: T, lowerInclusive: string, upperExclusive: string): T {
  return query.gte("created_at", lowerInclusive).lt("created_at", upperExclusive);
}

function applyOrganizationScope<T>(query: T, organizationIds: string[]): T {
  const scoped = query as {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  };
  if (organizationIds.length === 1) return scoped.eq("organization_id", organizationIds[0]!);
  return scoped.in("organization_id", organizationIds);
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const session = await requireDashboardSession();
  const { supabase } = session;
  const cookieStore = await cookies();
  const viewAllLocations = cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";
  const scope = await resolveDashboardOrganizationScope(session, viewAllLocations);
  const scopedOrgIds = scope.organizationIds;
  const sp = searchParams ? await searchParams : {};
  const now = new Date();
  if (sp.range && !sp.date) redirect("/dashboard/activity");
  const selectedDate = parseCallsPageDateParam(sp.date, now);
  const dateLabel = callsPageDateGreetingSubline(selectedDate, now);
  const { lowerInclusive, upperExclusive } = getCallsPageDayBoundsIso(selectedDate);

  function scopedDay<T extends {
    gte: (col: string, v: string) => T;
    lt: (col: string, v: string) => T;
  }>(query: T): T {
    return applyDayBounds(applyOrganizationScope(query, scopedOrgIds), lowerInclusive, upperExclusive);
  }
  function countCustomerCalls(outcome?: string) {
    let query = customerCallFilters(supabase.from("call_logs").select("id", { count: "exact", head: true }));
    if (outcome) query = query.eq("outcome", outcome);
    return scopedDay(query);
  }
  const callColumns =
    "id, created_at, outcome, caller_number, caller_name, caller_data_erased_at, ai_summary, engineer_test_call, is_test_call, room_name";

  const [callsRes, engineerRes, ticketsRes, countRes, linksRes, callbacksRes, requestsRes] = await Promise.all([
    scopedDay(customerCallFilters(supabase.from("call_logs").select(callColumns)))
      .order("created_at", { ascending: false }).limit(ACTIVITY_FEED_LIMIT),
    // Independent of customer pagination: test bursts cannot hide real calls.
    scopedDay(supabase.from("call_logs").select(callColumns).eq("is_test_call", false).or(ENGINEER_CALL_FILTER))
      .order("created_at", { ascending: false }).limit(1),
    scopedDay(customerTicketFilters(supabase.from("action_tickets").select(
      "id, created_at, caller_name, caller_number, summary, brief_summary, engineer_test_call",
    )))
      .order("created_at", { ascending: false }).limit(ACTIVITY_FEED_LIMIT),
    countCustomerCalls(),
    countCustomerCalls("link_sent"),
    countCustomerCalls("callback_requested"),
    scopedDay(customerTicketFilters(supabase.from("action_tickets").select("id", { count: "exact", head: true }))),
  ]);
  if ([callsRes, engineerRes, ticketsRes, countRes, linksRes, callbacksRes, requestsRes].some((res) => res.error)) {
    return <p className="p-6 text-[13px] text-red-700">Could not load activity. Please refresh.</p>;
  }
  const rows = buildDashboardActivityFeed({
    calls: [...(callsRes.data ?? []), ...(engineerRes.data ?? [])],
    tickets: ticketsRes.data ?? [],
    formatTime: formatDashboardFeedRelativeTime,
    limit: ACTIVITY_FEED_LIMIT,
  });
  // Exact full-day CUSTOMER counts, independent of the feed and its test notice.
  const callCount = countRes.count ?? 0;
  const requestCount = requestsRes.count ?? 0;
  const summary = [
    { value: String(callCount), label: callCount === 1 ? "call" : "calls" },
    { value: String(linksRes.count ?? 0), label: "links sent" },
    { value: String(callbacksRes.count ?? 0), label: "callbacks" },
    { value: String(requestCount), label: requestCount === 1 ? "request" : "requests" },
  ];
  return <ActivityView rows={rows} summary={summary} dateLabel={dateLabel} />;
}
