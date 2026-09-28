import { DashboardGateShell } from "@/components/dashboard/dashboard-gate-shell";
import { requireDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

/** Separate route layout keeps setup independent of dashboard data and navigation. */
export default async function AccountSetupLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardSession({ allowOnboarding: true });
  return <DashboardGateShell>{children}</DashboardGateShell>;
}
