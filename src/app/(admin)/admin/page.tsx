import { redirect } from "next/navigation";
import { adminLandingPath } from "@/lib/admin-permissions";
import { LayoutGrid } from "lucide-react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminStaffContext } from "@/lib/admin-session";
import { loadAdminOverview } from "@/lib/admin-overview";
import { AdminGlobalMetricsBoard } from "./admin-global-metrics-board";
export const dynamic = "force-dynamic";
export default async function AdminHomePage() {
  const staff = await requireAdminStaffContext();
  if (staff.role !== "owner") redirect(adminLandingPath(staff));
  const initial = await loadAdminOverview();
  return <AdminPageShell icon={LayoutGrid} title="Overview" description="Today’s calls and minutes · Current support, reviews and service status" fillViewport>
    <AdminGlobalMetricsBoard initial={initial} />
  </AdminPageShell>;
}
