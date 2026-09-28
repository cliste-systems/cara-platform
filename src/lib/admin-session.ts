import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { allowAdminDevWithoutSupabase } from "@/lib/supabase-env";
import { createClient } from "@/utils/supabase/server";

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
  return isAdminEmailAllowlisted(user.email) || hasConsoleAccessFlag(user);
}

type ResolveAdminAuth =
  | { tag: "ok"; user: User }
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

async function resolveAdminAuth(): Promise<ResolveAdminAuth> {
  if (allowAdminDevWithoutSupabase()) {
    return { tag: "ok", user: devGateAdminUser() };
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
  if (!canAccessAdminConsole(user)) return { tag: "forbidden" };
  return { tag: "ok", user };
}

/** AAL1 is allowed only while enrolling or challenging the admin second factor. */
export const requireAdminMfaSetupSessionUser = cache(async (): Promise<User> => {
  const r = await resolveAdminAuth();
  if (r.tag === "ok") return r.user;
  if (r.tag === "forbidden") {
    redirect(
      "/authenticate?error=forbidden&message=This%20account%20is%20not%20allowed%20to%20access%20Admin."
    );
  }
  redirect(
    "/authenticate?error=admin&message=Sign%20in%20with%20an%20authorized%20Admin%20account."
  );
});


export const requireAdminMfaSessionUser = cache(async (): Promise<User> => {
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

/** All privileged admin entry points enforce MFA, including legacy callers. */
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
