import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  activityFeedCallerLabel,
  callerLiveActivityLabel,
  formatDashboardFeedRelativeTime,
} from "@/lib/dashboard-feed-time";
import { formatActivityFeedBadge } from "@/lib/dashboard-live-activity";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  ENGINEER_TEST_CALL_BRAND,
  ENGINEER_TEST_CALL_LIST_LABEL,
  ENGINEER_TEST_CALL_ROW_SUBTITLE,
  isEngineerTestCallRow,
} from "@/lib/engineer-test-call";

/** One informational engineer entry, sorted with customer calls, never a counter. */
function collapseEngineerTestCallsForLiveActivity(
  calls: ActivityFeedSourceCall[],
): ActivityFeedSourceCall[] {
  const sorted = calls
    .filter((row) => row.is_test_call !== true && Number.isFinite(Date.parse(row.created_at)))
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  let hasEngineer = false;
  return sorted.filter((row) => {
    if (!isEngineerTestCallRow(row)) return true;
    if (hasEngineer) return false;
    hasEngineer = true;
    return true;
  });
}

export type ActivityFeedSourceCall = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  caller_data_erased_at?: string | null;
  ai_summary?: string | null;
  engineer_test_call?: boolean | null;
  is_test_call?: boolean | null;
  room_name?: string | null;
};

export type ActivityFeedSourceTicket = {
  id: string;
  created_at: string;
  caller_name?: string | null;
  caller_number?: string | null;
  caller_data_erased_at?: string | null;
  summary?: string | null;
  brief_summary?: string | null;
  engineer_test_call?: boolean | null;
};

function ticketSummaryForBadge(row: ActivityFeedSourceTicket): string | null {
  return row.summary?.trim() || row.brief_summary?.trim() || null;
}

/** Overview Live activity — incoming calls only, first name + number. */
export function buildHomeLiveActivityFeed(input: {
  calls: ActivityFeedSourceCall[];
  formatTime?: (iso: string) => string;
  limit?: number;
}): TimelineFeedRow[] {
  const limit = input.limit ?? 200;
  const formatTime = input.formatTime ?? formatDashboardFeedRelativeTime;
  return collapseEngineerTestCallsForLiveActivity(input.calls)
    .slice(0, limit)
    .map((row) => {
      const label = isEngineerTestCallRow(row)
        ? { title: ENGINEER_TEST_CALL_LIST_LABEL, subtitle: ENGINEER_TEST_CALL_ROW_SUBTITLE }
        : callerLiveActivityLabel(row);
      return {
        id: `${row.id}-call`,
        title: label.title,
        subtitle: label.subtitle,
        time: formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
        isoDate: row.created_at,
      };
    });
}

/** Full activity page — customer work plus at most one informational test entry. */
export function buildDashboardActivityFeed(input: {
  calls: ActivityFeedSourceCall[];
  tickets: ActivityFeedSourceTicket[];
  formatTime: (iso: string) => string;
  limit?: number;
}): TimelineFeedRow[] {
  const limit = input.limit ?? 200;

  const rows: (TimelineFeedRow & { timestamp: number })[] = [
    ...collapseEngineerTestCallsForLiveActivity(input.calls).map((row) => {
      const engineer = isEngineerTestCallRow(row);
      const action = engineer
        ? ENGINEER_TEST_CALL_BRAND
        : formatActivityFeedBadge({ summary: row.ai_summary, outcome: row.outcome });
      return {
        id: `${row.id}-call`,
        title: engineer ? ENGINEER_TEST_CALL_LIST_LABEL : activityFeedCallerLabel(row),
        ...(engineer ? { subtitle: ENGINEER_TEST_CALL_ROW_SUBTITLE } : {}),
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
        badge: action,
        isoDate: row.created_at,
        timestamp: Date.parse(row.created_at),
      };
    }),
    ...input.tickets.filter((row) => !isEngineerTestCallRow(row)).map((row) => {
      const action = formatActivityFeedBadge({ summary: ticketSummaryForBadge(row) });
      return {
        id: `${row.id}-ticket`,
        title: activityFeedCallerLabel(row),
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(row.id)}`,
        badge: action,
        isoDate: row.created_at,
        timestamp: Date.parse(row.created_at),
      };
    }),
  ]
    .filter((row) => Number.isFinite(row.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return rows.map(({ timestamp: _timestamp, ...row }) => row);
}
