"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminStaffContext } from "@/lib/admin-session";
import { getAdminSessionId, revokeAdminStaffSessions } from "@/lib/admin-sessions";
import { validateInvitePassword } from "@/lib/invite-onboarding";
import { buildSecurityEventContext, logSecurityEvent } from "@/lib/security-events";
import { createClient } from "@/utils/supabase/server";

export type AdminSecurityState = { error?: string; success?: string };

export async function revokeOwnAdminSession(_previous: AdminSecurityState, form: FormData): Promise<AdminSecurityState> {
  const { user } = await requireAdminStaffContext();
  const supabase = await createClient();
  const currentId = await getAdminSessionId(user, supabase);
  if (!currentId) return { error: "Your session could not be verified. Please sign in again." };
  const mode = form.get("mode");
  const sessionId = String(form.get("sessionId") ?? "");
  if (mode !== "one" && mode !== "others") return { error: "Choose which session to sign out." };
  if (mode === "one" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { error: "Choose a valid session to sign out." };
  }
  if (mode === "one" && sessionId === currentId && form.get("confirmCurrent") !== "yes") {
    return { error: "Confirm that you want to sign out of this device." };
  }
  let count: number;
  try {
    count = await revokeAdminStaffSessions(user.id, mode === "others"
      ? { exceptSessionId: currentId }
      : { sessionId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn’t sign out that session." };
  }
  await logSecurityEvent(buildSecurityEventContext(await headers()), {
    eventType: "admin_sessions_revoked", outcome: "success", actorUserId: user.id,
    actorEmail: user.email, targetUserId: user.id, metadata: { scope: mode, count },
  });
  if (mode === "one" && sessionId === currentId) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/authenticate?message=You%20have%20signed%20out%20of%20this%20device.");
  }
  revalidatePath("/admin/security");
  return { success: count > 0 ? `${count === 1 ? "Session" : `${count} sessions`} signed out.` : "Those sessions are already signed out." };
}

export async function changeAdminPassword(_previous: AdminSecurityState, form: FormData): Promise<AdminSecurityState> {
  const { user } = await requireAdminStaffContext();
  const supabase = await createClient();
  const currentId = await getAdminSessionId(user, supabase);
  if (!currentId) return { error: "Your session could not be verified. Please sign in again." };
  const password = form.get("password");
  const validation = validateInvitePassword(password, form.get("confirmation"));
  if (validation) return { error: validation };
  // A verified MFA session updates only its own password through Supabase Auth.
  const { error } = await supabase.auth.updateUser({ password: password as string });
  if (error) {
    if (error.code === "reauthentication_needed" || error.code === "reauthentication_not_valid") {
      return { error: "Please sign out and sign in again, then return here to change your password." };
    }
    return { error: error.message };
  }
  let revokeFailed = false;
  try {
    await revokeAdminStaffSessions(user.id, { exceptSessionId: currentId });
  } catch {
    revokeFailed = true;
  }
  await logSecurityEvent(buildSecurityEventContext(await headers()), {
    eventType: "admin_password_changed", outcome: "success", actorUserId: user.id,
    actorEmail: user.email, targetUserId: user.id, metadata: { otherSessionsRevoked: !revokeFailed },
  });
  revalidatePath("/admin/security");
  if (revokeFailed) return { error: "Your password was changed, but we couldn’t sign out other devices. Use ‘Sign out other sessions’ below to try again." };
  return { success: "Password changed. Your other sessions have been signed out." };
}
