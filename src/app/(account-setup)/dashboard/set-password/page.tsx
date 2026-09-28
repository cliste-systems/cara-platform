import { redirect } from "next/navigation";

import { OnboardingShell } from "@/components/dashboard/onboarding-shell";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { userNeedsPassword } from "@/lib/invite-onboarding";
import { createAdminClient } from "@/utils/supabase/admin";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage() {
  const session = await requireDashboardSession({ allowOnboarding: true });
  if (!session.isLocalPreview && !userNeedsPassword(session.user)) redirect("/dashboard/legal-accept");
  const { data: account } = await createAdminClient().from("accounts").select("name").eq("id", session.accountId).maybeSingle();
  return (
    <OnboardingShell step={1} title="Make your account yours" description="Your email is already linked to your account. Choose a password you’ll use whenever you sign in." organizationName={account?.name}>
      <SetPasswordForm email={session.user.email ?? ""} />
    </OnboardingShell>
  );
}
