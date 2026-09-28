import { requireDashboardSession } from "@/lib/dashboard-session";

export default async function DashboardRouteGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireDashboardSession({ allowOnboarding: true });
  return children;
}
