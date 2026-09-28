import type { SupabaseClient } from "@supabase/supabase-js";
import { userNeedsPassword } from "./invite-onboarding";

export async function prepareInviteAuthentication(admin: SupabaseClient, input: {
  email: string;
  redirectTo: string;
  recipientName?: string;
  existingUserId?: string;
  initializePendingSetup?: boolean;
  managedOnboarding?: boolean;
}): Promise<
  | { ok: true; userId: string; actionLink: string; requiresPassword: boolean }
  | { ok: false; message: string }
> {
  const existingUserId = input.existingUserId?.trim();
  let initializePendingSetup = false;
  if (existingUserId && input.initializePendingSetup) {
    const { data: current, error: lookupError } = await admin.auth.admin.getUserById(existingUserId);
    if (lookupError || !current.user || !current.user.invited_at || current.user.last_sign_in_at) {
      return { ok: false, message: "This account already has a sign-in history. Its password setup cannot be reset by an invitation." };
    }
    initializePendingSetup = true;
  }
  const type = existingUserId ? "magiclink" : "invite";
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
      ...(!existingUserId && input.recipientName ? { data: { full_name: input.recipientName } } : {}),
    },
  });
  if (error || !data.user?.id) {
    return { ok: false, message: error?.message || "Could not prepare the invitation. Please try again." };
  }
  const userId = data.user.id;
  if (existingUserId && userId !== existingUserId) {
    return { ok: false, message: "The invitation no longer matches this account. Please reload and try again." };
  }
  const initializePassword = !existingUserId || initializePendingSetup;
  const requiresPassword = initializePassword || userNeedsPassword(data.user);
  // Every managed invite must obey the database agreement gate, including an
  // established login joining another store in its already-validated account.
  if (initializePassword || input.managedOnboarding) {
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...data.user.app_metadata,
        ...(initializePassword ? { needs_password: true } : {}),
        ...(input.managedOnboarding ? { managed_onboarding: true } : {}),
      },
    });
    if (metadataError) return { ok: false, message: "Could not secure the account setup. Please try again." };
  }
  const hashedToken = data.properties?.hashed_token?.trim();
  if (!hashedToken) return { ok: false, message: "Could not create a secure invitation link. Please try again." };
  const callbackUrl = new URL(input.redirectTo);
  callbackUrl.searchParams.set("token_hash", hashedToken);
  callbackUrl.searchParams.set("type", type);
  return { ok: true, userId, requiresPassword, actionLink: callbackUrl.toString() };
}
