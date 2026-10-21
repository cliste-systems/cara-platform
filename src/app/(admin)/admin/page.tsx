import { redirect } from "next/navigation";
import { adminLandingPath } from "@/lib/admin-permissions";
import { requireAdminStaffContext } from "@/lib/admin-session";
import { loadAdminOverview } from "@/lib/admin-overview";
import { AdminGlobalMetricsBoard } from "./admin-global-metrics-board";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const staff = await requireAdminStaffContext();
  if (staff.role !== "owner") redirect(adminLandingPath(staff));
  return <AdminGlobalMetricsBoard initial={await loadAdminOverview()} />;
}
