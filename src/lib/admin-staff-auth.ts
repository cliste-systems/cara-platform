import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function prepareStaffInvitationAuthentication(admin: SupabaseClient, input: { email: string; displayName: string; existingUser: User | null; origin: string }): Promise<{ userId: string; actionLink: string; requiresPassword: boolean }> {
  const origin = input.origin;
  const existing = input.existingUser;
  const requiresPassword = !existing || existing.app_metadata?.admin_needs_password === true || Boolean(existing.invited_at && !existing.last_sign_in_at);
  if (!requiresPassword && existing) return { userId: existing.id, actionLink: `${origin}/authenticate`, requiresPassword: false };

  const { data, error } = await admin.auth.admin.generateLink({
    type: existing ? "magiclink" : "invite",
    email: input.email,
    options: { redirectTo: `${origin}/auth/callback`, ...(!existing ? { data: { full_name: input.displayName } } : {}) },
  });
  if (error || !data.user || !data.properties?.hashed_token) throw new Error("Could not prepare a secure invitation. Please try again.");
  if (existing && existing.id !== data.user.id) throw new Error("This email’s account changed. Reload and try again.");
  const { error: metadataError } = await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { ...data.user.app_metadata, admin_needs_password: true } });
  if (metadataError) throw new Error("Could not secure the team account setup. Please try again.");
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", existing ? "magiclink" : "invite");
  return { userId: data.user.id, actionLink: url.toString(), requiresPassword: true };
}

