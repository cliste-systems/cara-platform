"use server";

import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { userNeedsPassword, validateInvitePassword } from "@/lib/invite-onboarding";
import { createAdminClient } from "@/utils/supabase/admin";

export type SetInvitePasswordState = { error?: string };

export async function setInvitePassword(_previous: SetInvitePasswordState, formData: FormData): Promise<SetInvitePasswordState> {
  const session = await requireDashboardSession({ allowOnboarding: true });
  if (session.isLocalPreview) return { error: "Password setup is unavailable in a local preview." };
  if (!userNeedsPassword(session.user)) redirect("/dashboard/legal-accept");
  const password = formData.get("password");
  const validationError = validateInvitePassword(password, formData.get("confirmation"));
  if (validationError) return { error: validationError };

  // The user's authenticated session must update their own password. Admin privilege
  // is used only to clear the trusted gate after that update succeeds.
  const { error: passwordError } = await session.supabase.auth.updateUser({ password: password as string });
  if (passwordError) return { error: passwordError.message };
  const admin = createAdminClient();
  const { data: current, error: lookupError } = await admin.auth.admin.getUserById(session.user.id);
  if (lookupError || !current.user) return { error: "Your password was saved, but setup could not finish. Please try again." };
  const { error: metadataError } = await admin.auth.admin.updateUserById(session.user.id, {
    app_metadata: { ...current.user.app_metadata, needs_password: false },
  });
  if (metadataError) return { error: "Your password was saved, but setup could not finish. Please try again." };
  const { error: refreshError } = await session.supabase.auth.refreshSession();
  if (refreshError) redirect("/authenticate?message=Your%20password%20is%20saved.%20Please%20sign%20in%20to%20continue.");
  redirect("/dashboard/legal-accept");
}
