/** Canonical staff capabilities. Membership and status always come from admin_staff. */
export const ADMIN_PERMISSIONS = ["customers", "calls", "support", "inbox", "billing"] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type AdminStaffRole = "owner" | "member";
export type AdminStaffStatus = "invited" | "active" | "disabled";
export type AdminStaffAccess = {
  role: AdminStaffRole;
  status: AdminStaffStatus;
  permissions: readonly AdminPermission[];
};

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && ADMIN_PERMISSIONS.some((permission) => permission === value);
}

export function isEnabledAdminStaff(staff: AdminStaffAccess | null | undefined): boolean {
  return Boolean(staff && (staff.status === "active" || staff.status === "invited"));
}

export function hasAdminPermission(staff: AdminStaffAccess | null | undefined, permission: AdminPermission | "team"): boolean {
  if (!isEnabledAdminStaff(staff) || !staff) return false;
  if (staff.role === "owner") return true;
  return permission !== "team" && staff.permissions.includes(permission);
}

export function adminLandingPath(staff: AdminStaffAccess): string {
  if (!isEnabledAdminStaff(staff)) return "/authenticate";
  if (staff.role === "owner") return "/admin";
  if (hasAdminPermission(staff, "customers")) return "/admin/customers";
  if (hasAdminPermission(staff, "calls")) return "/admin/call-analysis";
  if (hasAdminPermission(staff, "support")) return "/admin/support";
  if (hasAdminPermission(staff, "inbox")) return "/admin/inbox";
  if (hasAdminPermission(staff, "billing")) return "/admin/payments/platform-income";
  return "/admin/security";
}
