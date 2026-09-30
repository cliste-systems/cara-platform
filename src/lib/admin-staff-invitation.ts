import "server-only";
import { prepareStaffInvitationAuthentication } from "@/lib/admin-staff-auth";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { buildStaffInvitationEmail } from "@/lib/admin-staff-email";
import type { AdminPermission } from "@/lib/admin-permissions";
import { sendTransactionalEmail } from "@/lib/resend-mail";

/** Uses the admin API because email ownership must not be inferred from profile text. */
export async function findStaffAuthUser(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Could not check this email’s account. Please try again.");
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

export async function prepareStaffInvitation(admin: SupabaseClient, input: { email: string; displayName: string; existingUser: User | null }) {
  return prepareStaffInvitationAuthentication(admin, { ...input, origin: resolveAppSiteOrigin().origin });
}

export async function dispatchStaffInvitation(input: { email: string; displayName: string; actionLink: string; requiresPassword: boolean; permissions: AdminPermission[] }) {
  try {
    return await sendTransactionalEmail({ to: input.email, ...buildStaffInvitationEmail({ ...input, recipientName: input.displayName }), replyTo: { email: "support@hellocara.ie", name: "HelloCara Support" } });
  } catch {
    return { ok: false as const, message: "Email delivery could not be confirmed. The team member is saved; resend their invitation." };
  }
}
