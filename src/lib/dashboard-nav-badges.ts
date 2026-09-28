import type { SupabaseClient } from "@supabase/supabase-js";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { getDashboardMetricRangeLowerBoundIso } from "@/lib/dashboard-metric-range";
import {
  customerCallFilters,
  customerTrainingFilters,
  CUSTOMER_TRAINING_JOINS,
} from "@/lib/dashboard-customer-data";

export {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  DASHBOARD_CARA_TRAINING_SEEN_COOKIE,
} from "./dashboard-nav-seen-cookies";

export type DashboardNavBadgeMap = Partial<Record<string, number>>;

export type DashboardNavSeenAt = {
  callHistory: Date | null;
  /** @deprecated Action Inbox retired. */
  actionInbox: Date | null;
  caraTraining: Date | null;
};

function countHead(
  res: { count: number | null; error: { message: string } | null },
): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

export async function fetchDashboardNavBadges(
  supabase: SupabaseClient,
  organizationId: string,
  _seen: DashboardNavSeenAt | null | undefined,
): Promise<DashboardNavBadgeMap> {
  const callsTodaySince = getDashboardMetricRangeLowerBoundIso("today");

  const [callHistoryRes, trainingRes] = await Promise.all([
    customerCallFilters(
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true }),
    )
      .eq("organization_id", organizationId)
      .gte("created_at", callsTodaySince),
    customerTrainingFilters(
      supabase
        .from("cara_training_items")
        .select(`id,${CUSTOMER_TRAINING_JOINS}`, { count: "exact", head: true }),
    )
      .eq("organization_id", organizationId)
      .in("status", ["awaiting_answer", "draft_ready"]),
  ]);

  const callBadge = countHead(callHistoryRes);
  const trainingBadge = countHead(trainingRes);

  return {
    "/dashboard/calls": callBadge,
    "/dashboard/call-history": callBadge,
    [DASHBOARD_ROUTES.caraKnowledgeNeedsInput]: trainingBadge,
  };
}

export function formatNavBadgeCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}
