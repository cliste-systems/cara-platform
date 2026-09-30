import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAdminPermission, type AdminStaffAccess } from "@/lib/admin-permissions";

export type AdminStaffRecord = AdminStaffAccess & {
  user_id: string;
  email: string;
  display_name: string | null;
};

const STAFF_ACCESS_COLUMNS = "user_id, email, display_name, role, permissions, status";

function parseStaffRecord(data: Record<string, unknown> | null): AdminStaffRecord | null {
  if (!data) return null;
  if ((data.role !== "owner" && data.role !== "member") || (data.status !== "invited" && data.status !== "active" && data.status !== "disabled")) return null;
  if (typeof data.user_id !== "string" || typeof data.email !== "string") return null;
  return {
    user_id: data.user_id,
    email: data.email,
    display_name: typeof data.display_name === "string" ? data.display_name : null,
    role: data.role,
    status: data.status,
    permissions: Array.isArray(data.permissions) ? data.permissions.filter(isAdminPermission) : [],
  };
}

/** Intentionally uncached: activation may race another request or a membership change. */
async function loadAdminStaffRecord(userId: string): Promise<AdminStaffRecord | null> {
  const { data, error } = await createAdminClient().from("admin_staff")
    .select(STAFF_ACCESS_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not verify staff access.");
  return parseStaffRecord(data);
}

/** Never fall back to token metadata or an email allowlist when the database denies access. */
export const getAdminStaffRecord = cache(loadAdminStaffRecord);

/** Called only after MFA. Concurrent first requests may have already activated this invitation. */
export async function activateAdminStaffMembership(userId: string): Promise<AdminStaffRecord | null> {
  const { data, error } = await createAdminClient().from("admin_staff")
    .update({ status: "active", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("status", "invited").select(STAFF_ACCESS_COLUMNS).maybeSingle();
  if (error) throw new Error("Could not activate your staff membership. Refresh to check your access.");
  const current = data ? parseStaffRecord(data) : await loadAdminStaffRecord(userId);
  // A concurrent disable/delete must never be treated as successful activation.
  return current?.status === "active" ? current : null;
}
