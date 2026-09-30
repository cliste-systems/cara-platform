import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminSession = {
  id: string;
  device: string;
  ipMasked: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string | null;
  mfaVerified: boolean;
  isCurrent: boolean;
};

/** getClaims verifies the JWT; the session ID is never accepted from a client form. */
export async function getAdminSessionId(user: Pick<User, "id">, supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || claims.sub !== user.id) return null;
  const id = claims.session_id;
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

/** Revoked sessions must fail immediately, even while their signed JWT has time left. */
export async function isActiveAdminSession(user: Pick<User, "id">, supabase: SupabaseClient): Promise<boolean> {
  try {
    const sessionId = await getAdminSessionId(user, supabase);
    if (!sessionId) return false;
    const { data, error } = await createAdminClient().rpc("admin_auth_session_active", {
      p_user_id: user.id,
      p_session_id: sessionId,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export function maskSessionIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ip = value.trim().split("/")[0];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return `${ip.split(".").slice(0, 2).join(".")}.x.x`;
  }
  if (/^[a-f\d:]+$/i.test(ip) && ip.includes(":")) {
    const prefix = ip.split(":").filter(Boolean).slice(0, 2).join(":");
    return `${prefix || "0"}:••••`;
  }
  return null;
}

export function sessionDeviceLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Unidentified device";
  const ua = value;
  const browser = /Edg\//.test(ua) ? "Edge" : /(?:Firefox|FxiOS)\//.test(ua) ? "Firefox"
    : /(?:Chrome|CriOS)\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const system = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  return system ? `${browser} on ${system}` : "Unidentified device";
}

export async function listAdminStaffSessions(userId: string, currentSessionId: string | null): Promise<AdminSession[]> {
  const { data, error } = await createAdminClient().rpc("admin_list_auth_sessions", { p_user_id: userId });
  if (error) throw new Error("We couldn’t load your sessions. Please refresh and try again.");
  return (data ?? []).map((row: {
    id: string; created_at: string; refreshed_at: string; user_agent: string | null;
    ip: string | null; aal: string | null; not_after: string | null;
  }) => ({
    id: row.id,
    device: sessionDeviceLabel(row.user_agent),
    ipMasked: maskSessionIp(row.ip),
    createdAt: row.created_at,
    lastActiveAt: row.refreshed_at,
    expiresAt: row.not_after,
    mfaVerified: row.aal === "aal2",
    isCurrent: row.id === currentSessionId,
  }));
}

/** Caller must authorise self-service or owner/team management before invoking. */
export async function revokeAdminStaffSessions(userId: string, options: { sessionId?: string; exceptSessionId?: string } = {}): Promise<number> {
  if (!UUID_RE.test(userId) || (options.sessionId !== undefined && !UUID_RE.test(options.sessionId))
    || (options.exceptSessionId !== undefined && !UUID_RE.test(options.exceptSessionId))
    || (options.sessionId && options.exceptSessionId)) {
    throw new Error("Choose a valid session to sign out.");
  }
  const { data, error } = await createAdminClient().rpc("admin_revoke_auth_sessions", {
    p_user_id: userId,
    p_session_id: options.sessionId ?? null,
    p_except_session_id: options.exceptSessionId ?? null,
  });
  if (error) throw new Error("We couldn’t sign out those sessions. Please try again.");
  return typeof data === "number" ? data : 0;
}
