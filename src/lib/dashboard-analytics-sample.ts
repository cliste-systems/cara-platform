import "server-only";
import { buildDashboardCallAnalytics } from "./dashboard-call-analytics";
import type { DashboardHomeSnapshot } from "./dashboard-home-snapshot";

/** Temporary local design-review data. Callers must enforce the local setup gate. */
export function withLocalAnalyticsSample(snapshot: DashboardHomeSnapshot): DashboardHomeSnapshot {
  const counts = [0, 0, 0, 0, 0, 0, 1, 3, 8, 15, 23, 18, 12, 16, 24, 19, 13, 9, 5, 2, 1, 0, 0, 0];
  const lengths = [0, 0, 0, 0, 0, 0, 64, 91, 118, 145, 182, 161, 126, 154, 197, 168, 143, 115, 103, 88, 62, 0, 0, 0];
  const total = counts.reduce((sum, count) => sum + count, 0);
  const seconds = counts.reduce((sum, count, i) => sum + count * lengths[i], 0);
  const callAnalytics = buildDashboardCallAnalytics({
    total, measured: total, average_seconds: seconds / total,
    longest_seconds: 486, total_seconds: seconds,
    hourly: counts.map((calls, hour) => ({ id: hour, calls, measured: calls, average_seconds: calls ? lengths[hour] : null })),
    daily: [],
  }, [
    { outcome: "answered", count: total - 38 },
    { outcome: "action_created", count: 19 },
    { outcome: "callback_requested", count: 12 },
    { outcome: "link_sent", count: 7 },
  ], "today", new Date().toISOString());
  return {
    ...snapshot, callAnalytics, designSample: true,
    openActions: 3,
    openTrainingCount: 3,
    needsAttention: [
      { id: "local-follow-1", href: "/dashboard/calls?filter=follow_up", title: "Emily Walsh", description: "Boiler service callback", time: "12:42" },
      { id: "local-follow-2", href: "/dashboard/calls?filter=follow_up", title: "Mark O’Connor", description: "Annual plan quote · 2 properties", time: "11:30" },
      { id: "local-follow-3", href: "/dashboard/calls?filter=follow_up", title: "Sinead Byrne", description: "Friday appointment request", time: "10:15" },
    ],
    caraTraining: [
      { id: "local-knowledge-1", href: "/dashboard/cara-knowledge?tab=needs-input", title: "Do we offer weekend call-outs?", description: "Saturday hours & call-out fees", time: "12:24" },
      { id: "local-knowledge-2", href: "/dashboard/cara-knowledge?tab=needs-input", title: "Do we service Worcester boilers?", description: "Supported boiler brands", time: "11:10" },
      { id: "local-knowledge-3", href: "/dashboard/cara-knowledge?tab=needs-input", title: "What’s included in the annual plan?", description: "Plan cover & service visits", time: "09:45" },
    ],
    activity: [
      { id: "local-call-1", href: "/dashboard/calls", title: "John Murphy", subtitle: "Tuesday boiler service", time: "12:48" },
      { id: "local-call-2", href: "/dashboard/calls", title: "Aoife Kelly", subtitle: "Annual plan pricing", time: "12:18" },
      { id: "local-call-3", href: "/dashboard/calls", title: "Patrick Ryan", subtitle: "Coverage & availability", time: "11:55" },
    ],
    callMinutes: seconds / 60,
    averageCallSeconds: Math.round(seconds / total),
    stats: snapshot.stats.map((stat, i) => i === 0 ? { ...stat, value: String(total) } : stat),
  };
}
