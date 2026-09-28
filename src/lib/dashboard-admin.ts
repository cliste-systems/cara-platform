import { redirect } from "next/navigation";
import { hasAccountOwnerAccess } from "./account-owner-access";

import {
  dashboardRoleLabel,
} from "@/lib/team-roles";

import {
  requireDashboardSession,
  type DashboardSession,
} from "./dashboard-session";

export async function requireDashboardAdmin(): Promise<DashboardSession> {
  const session = await requireDashboardSession();
  if (!(await hasAccountOwnerAccess(session.supabase, {
    userId: session.user.id, accountId: session.accountId, profileRole: session.profile.role,
  }))) {
    redirect("/dashboard");
  }
  return session;
}

export { dashboardRoleLabel };
