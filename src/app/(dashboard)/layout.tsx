import { WorkspaceUnavailable } from "@/components/dashboard/workspace-unavailable";
import { PreviewWorkspaceUnavailable, requireDashboardSession } from "@/lib/dashboard-session";

export default async function DashboardRouteGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireDashboardSession({ allowOnboarding: true });
  } catch (error) {
    if (error instanceof PreviewWorkspaceUnavailable) return <WorkspaceUnavailable />;
    throw error;
  }
  return children;
}
