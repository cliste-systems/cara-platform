import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { HomeCallReviewRow } from "@/lib/dashboard-home-calls-to-review";
import {
  buildHomeCallsToReviewRows,
  countHomeCallsToReview,
} from "@/lib/dashboard-home-calls-to-review";
import type { HomeTopTopicRow } from "@/lib/dashboard-home-top-topics";
import { buildHomeTopTopicRows } from "@/lib/dashboard-home-top-topics";
import type { HomeCallTimesBucket } from "@/lib/dashboard-home-call-times";
import type {
  HomeCaraTrainingRow,
  HomeRequestRow,
} from "@/lib/dashboard-home-requests";
import { formatMinutes } from "@/app/(dashboard)/dashboard/billing/usage-helpers";
import { loadAccountBilling } from "@/lib/account-session";
import { buildHomeLiveActivityFeed } from "@/lib/dashboard-activity-feed";
import { sumBillableMinutesFromDurations } from "@/lib/billable-minutes";
import { PLANS } from "@/lib/cliste-plans";
import { buildCaraLastCallSnapshot } from "@/lib/cara-last-call";
import { buildCaraStatus } from "@/lib/cara-status";
import { dashboardFollowUpHubHref } from "@/lib/dashboard-follow-up-hub";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { dashboardTimeGreeting } from "@/lib/dashboard-greeting";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatDashboardFeedRelativeTime } from "@/lib/dashboard-feed-time";
import { buildHomeUsageSnapshot } from "@/lib/dashboard-home-analytics";
import { buildHomeCallTimesBuckets } from "@/lib/dashboard-home-call-times";
import {
  buildHomeCaraTrainingRows,
  mergeHomeNeedsAttentionRows,
  type HomeCaraTrainingItemRow,
  type HomeRequestTicketRow,
} from "@/lib/dashboard-home-requests";
import type { HomeAttentionCallRow } from "@/lib/dashboard-home-attention";
import {
  DASHBOARD_HOME_ATTENTION_ROW_LIMIT,
  DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT,
  DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
} from "@/lib/dashboard-home-panel-limit";
import {
  dashboardMetricRangePeriodPhrase,
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  type DashboardMetricRangeKey,
} from "@/lib/dashboard-metric-range";
import { normalizeCallOutcome } from "@/lib/call-history-types";
import { isRoutedCallOutcome } from "@/lib/dashboard-routed-outcomes";
import { resolveDashboardOrganizationScope } from "@/lib/dashboard-scope";
import type { DashboardSession } from "@/lib/dashboard-session";
import {
  customerCallFilters,
  customerTicketFilters,
  customerTrainingFilters,
  customerUsageFilters,
  CUSTOMER_TRAINING_JOINS,
  isCustomerCallRow,
} from "@/lib/dashboard-customer-data";

type CallLogRow = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  duration_seconds: number | null;
  ai_summary?: string | null;
  post_call_status?: string | null;
  call_resolution?: string | null;
  engineer_test_call?: boolean | null;
  is_test_call?: boolean | null;
  room_name?: string | null;
};

export type DashboardHomeStat = {
  label: string;
  value: string;
  href: string;
};

export type DashboardHomeSnapshot = {
  greeting: string;
  subheading: string;
  stats: DashboardHomeStat[];
  activity: TimelineFeedRow[];
  needsAttention: HomeRequestRow[];
  openActions: number;
  caraTraining: HomeCaraTrainingRow[];
  openTrainingCount: number;
  topTopics: HomeTopTopicRow[];
  callsToReview: HomeCallReviewRow[];
  callsToReviewCount: number;
  callTimes: HomeCallTimesBucket[];
};

function countExact(res: {
  count: number | null;
  error: { message: string } | null;
}): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

function getFirstName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function applyRangeEnd<T extends { gte: (col: string, v: string) => T; lt: (col: string, v: string) => T }>(
  query: T,
  rangeEndExclusiveIso: string | null,
): T {
  if (rangeEndExclusiveIso) return query.lt("created_at", rangeEndExclusiveIso);
  return query;
}

function applyOrganizationScope<T>(query: T, organizationIds: string[]): T {
  const scoped = query as {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  };
  if (organizationIds.length === 1) return scoped.eq("organization_id", organizationIds[0]!);
  return scoped.in("organization_id", organizationIds);
}

function defaultPeriodStart(): string {
  return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString().slice(0, 10);
}

export async function loadDashboardHomeSnapshot(input: {
  session: DashboardSession;
  metricRange: DashboardMetricRangeKey;
  viewAllLocations: boolean;
  niche: string | null | undefined;
  agentBusinessType: string | null | undefined;
  organizationSlug?: string | null;
}): Promise<DashboardHomeSnapshot> {
  const { session, metricRange, viewAllLocations, niche, agentBusinessType, organizationSlug } = input;
  const { supabase, organizationId, profile, accountId } = session;
  const scope = await resolveDashboardOrganizationScope(session, viewAllLocations);
  const scopedOrgIds = scope.organizationIds;
  const panelPeriodPhrase = dashboardMetricRangePeriodPhrase(metricRange);
  const metricRangeStartIso = getDashboardMetricRangeLowerBoundIso(metricRange);
  const metricRangeEndExclusiveIso = getDashboardMetricRangeUpperExclusiveIso(metricRange);
  const accountBilling = await loadAccountBilling(accountId);
  const planTier = accountBilling?.planTier ?? "pro";
  const plan = PLANS[planTier];
  const billingPeriodStart = accountBilling?.billingPeriodStart ?? defaultPeriodStart();

  const [
    callsInMetricRangeRes,
    actionsInMetricRangeRes,
    openActionsRes,
    callsForMetricRollupsRes,
    callsForPanelsRes,
    openTicketsRes,
    orgRes,
    latestCallRes,
    usageRecordsRes,
    trainingItemsRes,
    openTrainingCountRes,
  ] = await Promise.all([
    applyRangeEnd(applyOrganizationScope(
      customerCallFilters(supabase.from("call_logs").select("id", { count: "exact", head: true }))
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ), metricRangeEndExclusiveIso),
    applyRangeEnd(applyOrganizationScope(
      customerTicketFilters(supabase.from("action_tickets").select("id", { count: "exact", head: true }))
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ), metricRangeEndExclusiveIso),
    applyOrganizationScope(
      customerTicketFilters(supabase.from("action_tickets").select("id", { count: "exact", head: true }))
        .eq("status", "open").gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ),
    applyRangeEnd(applyOrganizationScope(
      customerCallFilters(supabase.from("call_logs").select("outcome, duration_seconds, ai_summary, transfer_connected"))
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ), metricRangeEndExclusiveIso),
    applyRangeEnd(applyOrganizationScope(
      customerCallFilters(supabase.from("call_logs").select(
        "id, created_at, outcome, caller_number, caller_name, duration_seconds, ai_summary, post_call_status, call_resolution, engineer_test_call, is_test_call, room_name",
      ))
        .gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT * 2),
      scopedOrgIds,
    ), metricRangeEndExclusiveIso),
    applyOrganizationScope(
      customerTicketFilters(supabase.from("action_tickets").select(
        "id, summary, created_at, status, caller_name, caller_number, department_slug, brief_summary",
      ))
        .eq("status", "open").gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false }).limit(DASHBOARD_HOME_ATTENTION_ROW_LIMIT),
      scopedOrgIds,
    ),
    supabase.from("organizations")
      .select("is_active, status, phone_number, onboarding_step, business_hours, agent_opening_hours, routing_links, agent_business_rules, agent_faqs, agent_services_departments, niche, cara_handle_options")
      .eq("id", organizationId).maybeSingle(),
    customerCallFilters(supabase.from("call_logs").select("id, created_at, caller_number, caller_name, outcome"))
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    applyOrganizationScope(
      customerUsageFilters(supabase.from("usage_records").select("minutes_billable"))
        .gte("billing_period_start", billingPeriodStart),
      scopedOrgIds.length > 0 ? scopedOrgIds : [organizationId],
    ),
    applyOrganizationScope(
      customerTrainingFilters(supabase.from("cara_training_items").select(
        `id, gap_summary, status, updated_at, knowledge_folder_id, knowledge_topic_labels, ${CUSTOMER_TRAINING_JOINS}`,
      ))
        .in("status", ["awaiting_answer", "draft_ready"])
        .order("updated_at", { ascending: false }).limit(DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT),
      scopedOrgIds,
    ),
    applyOrganizationScope(
      customerTrainingFilters(supabase.from("cara_training_items").select(
        `id, ${CUSTOMER_TRAINING_JOINS}`, { count: "exact", head: true },
      )).in("status", ["awaiting_answer", "draft_ready"]),
      scopedOrgIds,
    ),
  ]);

  const callsForPanels = (callsForPanelsRes.error ? [] : (callsForPanelsRes.data ?? [])) as CallLogRow[];
  const customerCallsForPanels = callsForPanels.filter(isCustomerCallRow);
  const callsForMetricRollups = callsForMetricRollupsRes.error ? [] : (callsForMetricRollupsRes.data ?? []);
  const callsAnsweredLive = countExact(callsInMetricRangeRes);
  const actionsCreatedLive = countExact(actionsInMetricRangeRes);
  const openActionsLive = countExact(openActionsRes);
  const routedCountLive = callsForMetricRollups.filter((row) => isRoutedCallOutcome(row.outcome)).length;
  const callbackCountLive = callsForMetricRollups.filter(
    (row) => normalizeCallOutcome(String(row.outcome ?? "")) === "callback_requested",
  ).length;
  const minutesUsedLive = sumBillableMinutesFromDurations(callsForMetricRollups.map((row) => row.duration_seconds));

  let billingMinutesUsed = 0;
  for (const row of usageRecordsRes.error ? [] : (usageRecordsRes.data ?? [])) {
    const value = (row as { minutes_billable: number | null }).minutes_billable;
    billingMinutesUsed += typeof value === "number" ? value : Number(value) || 0;
  }
  const org = orgRes.error ? null : orgRes.data;
  const lastCall = buildCaraLastCallSnapshot(
    latestCallRes.error || !latestCallRes.data ? null : (latestCallRes.data as CallLogRow),
  );
  const caraStatus = buildCaraStatus({
    lifecycleStatus: (org?.status as string | undefined) ?? "active",
    isActive: org?.is_active !== false,
    phoneNumber: (org?.phone_number as string | null)?.trim() || null,
    openFollowUpCount: openActionsLive,
    periodPhrase: panelPeriodPhrase,
    lastCall,
  });
  const openTicketRows = (openTicketsRes.error ? [] : (openTicketsRes.data ?? [])) as HomeRequestTicketRow[];
  const needsAttentionLive = mergeHomeNeedsAttentionRows({
    tickets: openTicketRows,
    calls: customerCallsForPanels as HomeAttentionCallRow[],
    formatTime: formatDashboardFeedRelativeTime,
    limit: DASHBOARD_HOME_ATTENTION_ROW_LIMIT,
  });
  const trainingItemRows = (trainingItemsRes.error ? [] : (trainingItemsRes.data ?? [])) as HomeCaraTrainingItemRow[];
  const caraTrainingLive = buildHomeCaraTrainingRows({
    items: trainingItemRows,
    formatTime: formatDashboardFeedRelativeTime,
    limit: DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT,
  });
  const openTrainingCountLive = countExact(openTrainingCountRes);
  const recentCallsForFeed = customerCallsForPanels.slice(0, DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT);
  const activityLive = buildHomeLiveActivityFeed({
    calls: recentCallsForFeed,
    formatTime: formatDashboardFeedRelativeTime,
    limit: DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
  });
  const callSummariesForTopics = callsForMetricRollups.map((row) => (row as { ai_summary?: string | null }).ai_summary);
  const topTopicsLive = buildHomeTopTopicRows({
    // Customer call-volume signals only, not operational training or tickets.
    callSummaries: callSummariesForTopics,
    ticketSummaries: [],
    trainingGaps: [],
  });
  const callsToReviewLive = buildHomeCallsToReviewRows({ calls: customerCallsForPanels, formatTime: formatDashboardFeedRelativeTime });
  const callsToReviewCountLive = countHomeCallsToReview(customerCallsForPanels);
  const callTimesLive = buildHomeCallTimesBuckets(customerCallsForPanels.map((row) => row.created_at));
  const usageSnapshotLive = buildHomeUsageSnapshot({
    minutesUsed: billingMinutesUsed > 0 ? billingMinutesUsed : minutesUsedLive,
    includedMinutes: plan.includedMinutes,
  });
  const minutesUsedDisplay = usageSnapshotLive.minutesUsed;
  const firstName = getFirstName(profile?.name);
  const greeting = dashboardTimeGreeting(firstName);
  const homeCopy = dashboardVerticalCopy(niche, agentBusinessType);
  const followUpHubHref = dashboardFollowUpHubHref(homeCopy.vertical.id);
  const thirdStat = homeCopy.home.heroThirdStat ?? {
    label: "Info sent", href: DASHBOARD_ROUTES.routing, kind: "routed" as const,
  };
  const thirdStatValue = thirdStat.kind === "callbacks" ? callbackCountLive : routedCountLive;
  const stats: DashboardHomeStat[] = homeCopy.vertical.id === "retail"
    ? [
        { label: "Calls answered", value: String(callsAnsweredLive), href: DASHBOARD_ROUTES.calls },
        { label: "Enquiries captured", value: String(actionsCreatedLive), href: followUpHubHref },
        { label: "Needs action", value: String(openActionsLive), href: followUpHubHref },
        { label: "Needs input", value: String(openTrainingCountLive), href: DASHBOARD_ROUTES.caraKnowledgeNeedsInput },
        { label: "Minutes used", value: formatMinutes(minutesUsedDisplay), href: DASHBOARD_ROUTES.usage },
      ]
    : [
        { label: "Calls answered", value: String(callsAnsweredLive), href: DASHBOARD_ROUTES.calls },
        { label: "Enquiries captured", value: String(actionsCreatedLive), href: followUpHubHref },
        { label: thirdStat.label, value: String(thirdStatValue), href: thirdStat.href },
        { label: "Needs attention", value: String(openActionsLive), href: followUpHubHref },
        { label: "Minutes used", value: formatMinutes(minutesUsedDisplay), href: DASHBOARD_ROUTES.usage },
      ];

  return {
    greeting,
    subheading: homeCopy.home.heroSubheading,
    stats,
    activity: activityLive,
    needsAttention: needsAttentionLive,
    openActions: openActionsLive,
    caraTraining: caraTrainingLive,
    openTrainingCount: openTrainingCountLive,
    topTopics: topTopicsLive,
    callsToReview: callsToReviewLive,
    callsToReviewCount: callsToReviewCountLive,
    callTimes: callTimesLive,
  };
}
