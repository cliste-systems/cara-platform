import "server-only";
import { redirect } from "next/navigation";
import { hasAccountOwnerAccess } from "@/lib/account-owner-access";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { usesSimpleSignup } from "@/lib/public-signup-flow";

export async function requirePublicSignupSession() {
  const session = await requireDashboardSession({ allowOnboarding: true });
  if (session.isLocalPreview || !usesSimpleSignup(session.user)) redirect("/auth/post-login");
  if (!(await hasAccountOwnerAccess(session.supabase, { userId: session.user.id, accountId: session.accountId, profileRole: session.profile.role }))) redirect("/dashboard");
  return session;
}
