import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAdminStaffRecord } from "@/lib/admin-staff-access";
import { clientAccountAccessError } from "@/lib/admin-client-account";
import { prepareInviteEmail, sendPreparedInviteEmail } from "@/lib/invite-email";

export async function findClientAuthUser(admin: SupabaseClient, email: string): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not check the client email: ${error.message}`);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

export async function validateClientAccountUser(admin: SupabaseClient, user: User | null, accountId: string | null) {
  if (!user) return { profile: null, hasMembership: false };
  const [profileResult, membershipsResult] = await Promise.all([
    admin.from("profiles").select("id, account_id, role").eq("id", user.id).maybeSingle(),
    admin.from("account_memberships").select("account_id, role").eq("user_id", user.id),
  ]);
  if (profileResult.error || membershipsResult.error) {
    throw new Error(profileResult.error?.message ?? membershipsResult.error?.message);
  }
  const accessError = clientAccountAccessError({
    accountId,
    profileAccountId: profileResult.data?.account_id ?? null,
    hasProfile: Boolean(profileResult.data),
    membershipAccountIds: (membershipsResult.data ?? []).map((row) => row.account_id),
    isStaff: Boolean(await getAdminStaffRecord(user.id)),
  });
  if (accessError) throw new Error(accessError);
  return {
    profile: profileResult.data,
    hasMembership: (membershipsResult.data ?? []).some((row) => row.account_id === accountId),
  };
}

/** All access records are durable before any email leaves the app. Retries repair partial setup. */
export async function deliverClientInvitation(input: {
  admin: SupabaseClient;
  inviteId: string;
  accountId: string;
  organizationId: string;
  email: string;
  recipientName: string;
  businessName: string;
  organizationName: string;
  redirectTo: string;
}): Promise<{ ok: true; userId: string; warning?: string } | { ok: false; message: string }> {
  const { admin } = input;
  try {
    const existingUser = await findClientAuthUser(admin, input.email);
    const existingAccess = await validateClientAccountUser(admin, existingUser, input.accountId);
    const prepared = await prepareInviteEmail({
      email: input.email,
      recipientName: input.recipientName,
      businessName: input.businessName,
      productName: "HelloCara",
      managedOnboarding: true,
      organizationName: input.organizationName,
      billingMethod: "invoice",
      redirectTo: input.redirectTo,
      existingUserId: existingUser?.id,
      initializePendingSetup: Boolean(existingUser?.invited_at && !existingUser.last_sign_in_at && !existingAccess.profile && !existingAccess.hasMembership),
      admin,
    });
    if (!prepared.ok) throw new Error(prepared.message);

    // Recheck after link generation in case another request created the same email.
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(prepared.userId);
    if (authError || !authData.user) throw new Error(authError?.message ?? "Could not verify the invited user.");
    const access = await validateClientAccountUser(admin, authData.user, input.accountId);
    if (!access.profile) {
      const { error } = await admin.from("profiles").insert({
        id: prepared.userId,
        account_id: input.accountId,
        organization_id: input.organizationId,
        active_organization_id: input.organizationId,
        role: "admin",
        name: input.recipientName,
      });
      if (error) throw new Error(`Could not save the client profile: ${error.message}`);
    }
    if (!access.hasMembership) {
      const { error } = await admin.from("account_memberships").insert({
        user_id: prepared.userId,
        account_id: input.accountId,
        role: access.profile?.role === "member" ? "member" : "admin",
      });
      if (error) throw new Error(`Could not save organisation access: ${error.message}`);
    }
    const { error: inviteError } = await admin.from("admin_invites").update({
      user_id: prepared.userId,
      delivery_status: "pending",
      delivery_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", input.inviteId);
    if (inviteError) throw new Error(`Could not save the invitation: ${inviteError.message}`);

    const sent = await sendPreparedInviteEmail(prepared.prepared);
    if (!sent.ok) throw new Error(sent.message);
    const { error: deliveryError } = await admin.from("admin_invites").update({
      sent_at: new Date().toISOString(),
      delivery_status: "sent",
      delivery_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", input.inviteId);
    return {
      ok: true,
      userId: prepared.userId,
      ...(deliveryError ? { warning: "The email was sent, but its delivery status could not be saved. Check the client invitation before sending it again." } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The invitation could not be sent.";
    await admin.from("admin_invites").update({
      delivery_status: "failed",
      delivery_error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", input.inviteId);
    return { ok: false, message };
  }
}
