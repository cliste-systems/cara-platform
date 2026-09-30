"use server";

import { redirect } from "next/navigation";
import { validateInvitePassword } from "@/lib/invite-onboarding";
import { requireStaffPasswordSetup } from "./session";

export type StaffPasswordState = { error?: string };

export async function setStaffPassword(_previous: StaffPasswordState, form: FormData): Promise<StaffPasswordState> {
  const { user, supabase, admin } = await requireStaffPasswordSetup();
  const password = form.get("password");
  const validation = validateInvitePassword(password, form.get("confirmation"));
  if (validation) return { error: validation };
  const { error: passwordError } = await supabase.auth.updateUser({ password: password as string });
  if (passwordError) return { error: passwordError.message };
  const { data: current, error: lookupError } = await admin.auth.admin.getUserById(user.id);
  if (lookupError || !current.user) return { error: "Your password was saved, but setup could not finish. Please try again." };
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...current.user.app_metadata, admin_needs_password: false } });
  if (metadataError) return { error: "Your password was saved, but setup could not finish. Please try again." };
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) redirect("/authenticate?error=session_expired&message=Your%20password%20is%20saved.%20Sign%20in%20to%20continue.");
  // Staff acceptance is recorded only after the required MFA check succeeds.
  redirect("/admin/mfa");
}
