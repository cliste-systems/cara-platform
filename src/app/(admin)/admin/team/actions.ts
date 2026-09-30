"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { buildSecurityEventContext, logSecurityEvent } from "@/lib/security-events";
import { requireAdminPermission } from "@/lib/admin-session";
import { revokeAdminStaffSessions } from "@/lib/admin-sessions";
import { canEditStaffMember, parseStaffAccess, parseStaffEmail, type StaffMemberRow } from "@/lib/admin-staff-input";
import { dispatchStaffInvitation, findStaffAuthUser, prepareStaffInvitation } from "@/lib/admin-staff-invitation";
import { isResendConfigured } from "@/lib/resend-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export type StaffActionState = { error?: string; success?: string; warning?: string };

function refreshTeam() { revalidatePath("/admin/team"); }

async function auditStaff(actor: { id: string; email?: string }, targetUserId: string, eventType: string, metadata: Record<string, unknown> = {}, outcome: "success" | "failure" = "success") {
  await logSecurityEvent(buildSecurityEventContext(await headers()), { actorUserId: actor.id, actorEmail: actor.email, targetUserId, eventType, outcome, metadata });
}

async function sendAndRecord(admin: ReturnType<typeof createAdminClient>, member: Pick<StaffMemberRow, "user_id" | "email" | "display_name" | "permissions">, invitation: { actionLink: string; requiresPassword: boolean }, actor: { id: string; email?: string }, resend = false): Promise<StaffActionState> {
  const sent = await dispatchStaffInvitation({ email: member.email, displayName: member.display_name, permissions: member.permissions, ...invitation });
  await auditStaff(actor, member.user_id, resend ? "admin_staff_invitation_resent" : "admin_staff_invitation_sent", {}, sent.ok ? "success" : "failure");
  const now = new Date().toISOString();
  const { error } = await admin.from("admin_staff").update({
    invitation_error: sent.ok ? null : sent.message,
    ...(sent.ok ? { invitation_sent_at: now } : {}),
    updated_at: now,
  }).eq("user_id", member.user_id);
  refreshTeam();
  if (error) return { warning: sent.ok ? "Invitation sent, but its delivery status could not be saved. Refresh before trying again." : "Team member saved, but delivery failed. Please resend their invitation." };
  return sent.ok ? { success: `Invitation sent to ${member.email}.` } : { warning: `Team member saved. ${sent.message}` };
}

export async function inviteStaffMember(_previous: StaffActionState, form: FormData): Promise<StaffActionState> {
  const actor = await requireAdminPermission("team");
  const input = parseStaffAccess(form);
  if (!input.ok) return { error: input.error };
  const email = parseStaffEmail(form.get("email"));
  if (!email) return { error: "Enter a valid email address." };
  if (email === actor.email?.toLowerCase()) return { error: "You already have access to this workspace." };
  if (!isResendConfigured()) return { error: "Email sending is unavailable. Please try again later." };
  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin.from("admin_staff").select("user_id").eq("email", email).maybeSingle();
  if (memberError) return { error: "Could not check team members. Please try again." };
  if (member) return { error: "This person is already on your team. Use their access settings or resend their invitation." };

  try {
    const existingUser = await findStaffAuthUser(admin, email);
    if (existingUser) {
      // A customer identity must never silently gain access to the staff workspace.
      const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
        admin.from("profiles").select("organization_id, account_id").eq("id", existingUser.id).maybeSingle(),
        admin.from("account_memberships").select("account_id").eq("user_id", existingUser.id).limit(1),
      ]);
      if (profileError || membershipError) return { error: "Could not verify this account’s existing access. Please try again." };
      if (profile?.organization_id || profile?.account_id || memberships?.length) return { error: "This email belongs to a customer account. Use a separate work email for staff access." };
    }
    const invitation = await prepareStaffInvitation(admin, { email, displayName: input.displayName, existingUser });
    const { error: saveError } = await admin.from("admin_staff").insert({ user_id: invitation.userId, email, display_name: input.displayName, role: "member", permissions: input.permissions, status: "invited", invited_by: actor.id });
    if (saveError) return { error: "Could not save the team member. Refresh the team list before trying again." };
    await auditStaff(actor, invitation.userId, "admin_staff_invited", { permissions: input.permissions });
    return sendAndRecord(admin, { user_id: invitation.userId, email, display_name: input.displayName, permissions: input.permissions }, invitation, actor);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not prepare the invitation. Please try again." };
  }
}

export async function updateStaffAccess(_previous: StaffActionState, form: FormData): Promise<StaffActionState> {
  const actor = await requireAdminPermission("team");
  const input = parseStaffAccess(form);
  if (!input.ok) return { error: input.error };
  const userId = String(form.get("userId") ?? "");
  const admin = createAdminClient();
  const { data: member, error } = await admin.from("admin_staff").select("user_id,role").eq("user_id", userId).maybeSingle();
  if (error || !member || !canEditStaffMember(member, actor.id)) return { error: "This team member’s access cannot be changed here." };
  const { error: saveError } = await admin.from("admin_staff").update({ display_name: input.displayName, permissions: input.permissions, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("role", "member");
  if (saveError) return { error: "Could not save access. Please try again." };
  await auditStaff(actor, userId, "admin_staff_access_updated", { permissions: input.permissions });
  refreshTeam();
  return { success: "Access updated. The changes apply immediately." };
}

export async function changeStaffStatus(userId: string, status: "enabled" | "disabled"): Promise<StaffActionState> {
  const actor = await requireAdminPermission("team");
  if (status !== "enabled" && status !== "disabled") return { error: "Choose a valid access status." };
  const admin = createAdminClient();
  const { data: member, error } = await admin.from("admin_staff").select("user_id,role,accepted_at").eq("user_id", userId).maybeSingle();
  if (error || !member || member.user_id === actor.id) return { error: "You cannot change your own access status." };
  const { error: saveError } = await admin.rpc("admin_staff_set_status", { p_actor_user_id: actor.id, p_target_user_id: userId, p_enabled: status === "enabled" });
  if (saveError) return { error: "Could not update team access. Please try again." };
  await auditStaff(actor, userId, "admin_staff_status_changed", { enabled: status === "enabled" });
  if (status === "disabled") {
    try { await revokeAdminStaffSessions(userId); }
    catch { refreshTeam(); return { warning: "Access is disabled. Some sign-in sessions could not be removed, but they cannot access the admin workspace." }; }
  }
  refreshTeam();
  return { success: status === "disabled" ? "Access disabled and sign-in sessions revoked." : "Access restored. This person can sign in with their existing account." };
}

export async function resendStaffInvitation(userId: string): Promise<StaffActionState> {
  const actor = await requireAdminPermission("team");
  if (!isResendConfigured()) return { error: "Email sending is unavailable. Please try again later." };
  const admin = createAdminClient();
  const { data: member, error } = await admin.from("admin_staff").select("*").eq("user_id", userId).maybeSingle();
  if (error || !member || !canEditStaffMember(member, actor.id) || member.status !== "invited") return { error: "Only pending team invitations can be resent. Restore access first if it is disabled." };
  if (member.invitation_sent_at && Date.now() - new Date(member.invitation_sent_at).getTime() < 60_000) return { error: "This invitation was just sent. Please wait a minute before resending it." };
  const { data, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !data.user || data.user.email?.toLowerCase() !== member.email) return { error: "Could not verify the invited account. Please refresh and try again." };
  try {
    const invitation = await prepareStaffInvitation(admin, { email: member.email, displayName: member.display_name, existingUser: data.user });
    return sendAndRecord(admin, member, invitation, actor, true);
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not resend this invitation." }; }
}

export async function signOutStaffSessions(userId: string): Promise<StaffActionState> {
  const actor = await requireAdminPermission("team");
  if (userId === actor.id) return { error: "Use Security & sessions to manage your own sign-ins." };
  const admin = createAdminClient();
  const { data: member, error } = await admin.from("admin_staff").select("user_id").eq("user_id", userId).maybeSingle();
  if (error || !member) return { error: "This team member could not be found." };
  try {
    const count = await revokeAdminStaffSessions(userId);
    await auditStaff(actor, userId, "admin_staff_sessions_revoked", { revokedCount: count });
    return { success: count ? `${count} sign-in session${count === 1 ? "" : "s"} ended. This person can sign in again with their existing access.` : "This team member has no active sign-in sessions." };
  } catch { return { error: "Could not sign out this team member. Please try again." }; }
}
