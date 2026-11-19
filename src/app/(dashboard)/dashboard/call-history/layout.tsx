import { DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";

/** Locks Calls to the dashboard viewport; scrolling happens inside list/detail panels. */
export default async function CallHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organization = await getCachedDashboardOrganizationRow();
  const className = organization?.niche === "retail"
    ? DASHBOARD_VIEWPORT_LAYOUT
    : "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white";
  return <div className={className}>{children}</div>;
}
