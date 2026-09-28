/** Dashboard team roles stored on `profiles.role`. */
export type DashboardTeamRole = "admin" | "member";

export const DASHBOARD_TEAM_ROLE_LABELS: Record<DashboardTeamRole, string> = {
  admin: "Owner",
  member: "View only",
};

export function parseDashboardTeamRole(
  raw: string | null | undefined,
): DashboardTeamRole {
  return raw === "admin" ? "admin" : "member";
}

export function isDashboardAdmin(role: string | null | undefined): boolean {
  return parseDashboardTeamRole(role) === "admin";
}

export function canManageDashboardConfig(role: string | null | undefined): boolean {
  return isDashboardAdmin(role);
}

export function dashboardRoleLabel(role: string | null | undefined): string {
  return DASHBOARD_TEAM_ROLE_LABELS[parseDashboardTeamRole(role)];
}
