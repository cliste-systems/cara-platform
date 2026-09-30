import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { allowAdminDevWithoutSupabase } from "@/lib/supabase-env";
import { createClient } from "@/utils/supabase/server";
import { activateAdminStaffMembership, getAdminStaffRecord, type AdminStaffRecord } from "@/lib/admin-staff-access";
import { hasAdminPermission, isEnabledAdminStaff, type AdminPermission } from "@/lib/admin-permissions";
import { isActiveAdminSession } from "@/lib/admin-sessions";

const DEFAULT_ADMIN_EMAIL = "brendan@clistesystems.ie";
const LOCAL_DEV_ADMIN_ID = "local-admin-gate";

function parseAllowedAdminEmails(): Set<string> {
  const raw = process.env.CLISTE_ADMIN_ALLOWED_EMAILS?.trim();
  const values = (raw ? raw.split(",") : [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!values.includes(DEFAULT_ADMIN_EMAIL)) {
    values.push(DEFAULT_ADMIN_EMAIL);
  }
  return new Set(values);
}

function hasConsoleAccessFlag(user: User): boolean {
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  return (
    appMeta?.cliste_admin_console === true ||
    appMeta?.cliste_admin_console === "true"
  );
}

export function isAdminEmailAllowlisted(
  email: string | null | undefined
): boolean {
  const v = email?.trim().toLowerCase();
  if (!v) return false;
  return parseAllowedAdminEmails().has(v);
}

export function canAccessAdminConsole(user: User): boolean {
  if (user.app_metadata?.admin_disabled === true || user.app_metadata?.admin_staff_status === "disabled") return false;
  // Routing hint only; privileged access is always checked against admin_staff.
  return isAdminEmailAllowlisted(user.email) || hasConsoleAccessFlag(user);
}

type ResolveAdminAuth =
  | { tag: "ok"; user: User; staff: AdminStaffRecord }
  | { tag: "no_session" }
  | { tag: "forbidden" };

function devGateAdminUser(): User {
  const label = process.env.CLISTE_ADMIN_DISPLAY_NAME?.trim() || "admin";
  const email = label.includes("@") ? label : `${label}@local.dev`;
  return {
    id: LOCAL_DEV_ADMIN_ID,
    aud: "authenticated",
    role: "authenticated",
    email,
    phone: "",
    confirmation_sent_at: undefined,
    confirmed_at: undefined,
    last_sign_in_at: undefined,
    app_metadata: { cliste_admin_console: true },
    user_metadata: {},
    identities: [],
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    is_anonymous: false,
  };
}

const resolveAdminAuth = cache(async (): Promise<ResolveAdminAuth> => {
  if (allowAdminDevWithoutSupabase()) {
    const user = devGateAdminUser();
    return { tag: "ok", user, staff: { user_id: user.id, email: user.email!, display_name: "Local administrator", role: "owner", permissions: [], status: "active" } };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[admin-session] Supabase client unavailable", err);
    return { tag: "no_session" };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { tag: "no_session" };
  try {
    const staff = await getAdminStaffRecord(user.id);
    if (!staff || !isEnabledAdminStaff(staff)) return { tag: "forbidden" };
    if (!(await isActiveAdminSession(user, supabase))) return { tag: "no_session" };
    return { tag: "ok", user, staff };
  } catch (error) {
    console.error("[admin-session] Staff access unavailable", error);
    return { tag: "forbidden" };
  }
});

/** AAL1 is allowed only while enrolling or challenging the admin second factor. */
export const requireAdminMfaSetupSessionUser = cache(async (): Promise<User> => {
  const r = await resolveAdminAuth();
  if (r.tag === "ok") {
    if (r.user.app_metadata?.admin_needs_password === true) redirect("/staff/setup");
    return r.user;
  }
  if (r.tag === "forbidden") {
    redirect(
      "/authenticate?error=forbidden&message=This%20account%20is%20not%20allowed%20to%20access%20Admin."
    );
  }
  redirect(
    "/authenticate?error=admin&message=Sign%20in%20with%20an%20authorized%20Admin%20account."
  );
});


const requireStaffMfaSessionUser = cache(async (): Promise<User> => {
  const user = await requireAdminMfaSetupSessionUser();

  // Local shell-only development may run without Supabase auth.
  // Production always requires AAL2.
  if (allowAdminDevWithoutSupabase()) {
    return user;
  }

  const supabase = await createClient();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || data.currentLevel !== "aal2") {
    redirect("/admin/mfa");
  }

  return user;
});

export type AdminStaffContext = AdminStaffRecord & { user: User };

export const requireAdminStaffContext = cache(async (): Promise<AdminStaffContext> => {
  const user = await requireStaffMfaSessionUser();
  const result = await resolveAdminAuth();
  if (result.tag !== "ok") redirect("/authenticate?error=admin");
  let staff = result.staff;
  if (staff.status === "invited" && !allowAdminDevWithoutSupabase()) {
    const activated = await activateAdminStaffMembership(user.id);
    if (!activated) redirect("/authenticate?error=forbidden&message=Your%20staff%20access%20is%20no%20longer%20active.");
    staff = activated;
  }
  return { ...staff, user };
});

export async function requireAdminPermission(permission: AdminPermission | "team"): Promise<User> {
  const staff = await requireAdminStaffContext();
  if (!hasAdminPermission(staff, permission)) redirect("/admin/security?access=denied");
  return staff.user;
}

/** Legacy unscoped callers are owner-only. New endpoints must request a capability explicitly. */
export const requireAdminMfaSessionUser = cache(async (): Promise<User> => requireAdminPermission("team"));
export const requireAdminSessionUser = requireAdminMfaSessionUser;

export async function adminMfaAssuranceLevel(): Promise<"aal1" | "aal2" | null> {
  if (allowAdminDevWithoutSupabase()) return "aal2";
  try {
    const supabase = await createClient();
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return null;
    return data.currentLevel ?? null;
  } catch {
    return null;
  }
}
