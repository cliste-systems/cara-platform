import { redirect } from "next/navigation";
import { userNeedsPassword } from "@/lib/invite-onboarding";

import { canAccessAdminConsole } from "@/lib/admin-session";
import { redirectIfEmailUnconfirmed } from "@/lib/require-email-confirmed";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

async function stampAdminInviteAccepted(userId: string, email: string) {
  try {
    const admin = createAdminClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { data: profile } = await admin
      .from("profiles")
      .select("account_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.account_id) return;
    const [{ data: membership }, { data: organizations }] = await Promise.all([
      admin.from("account_memberships").select("account_id").eq("user_id", userId).eq("account_id", profile.account_id).maybeSingle(),
      admin.from("organizations").select("id").eq("account_id", profile.account_id),
    ]);
    if (!membership || !organizations?.length) return;

    await admin
      .from("admin_invites")
      .update({
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .in("organization_id", organizations.map((organization) => organization.id))
      .ilike("email", normalizedEmail)
      .is("accepted_at", null);
  } catch (err) {
    console.warn(
      "[post-login] admin_invites accept stamp failed",
      err instanceof Error ? err.message : err,
    );
  }
}

export default async function PostLoginRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/authenticate");
  }

  redirectIfEmailUnconfirmed(user);

  if (user.email) {
    await stampAdminInviteAccepted(user.id, user.email);
  }

  if (canAccessAdminConsole(user)) {
    redirect("/admin");
  }

  if (userNeedsPassword(user)) redirect("/dashboard/set-password");

  // Gate on the salon's lifecycle. SaaS signups land here while still
  // onboarding (status != 'active') and are routed into the wizard so they
  // can't poke around a half-configured dashboard.
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("status")
      .eq("id", profile.organization_id)
      .maybeSingle();
    const status = (org?.status as string | undefined) ?? "active";
    if (status === "pending_verification" || status === "onboarding") {
      redirect("/onboarding");
    }
    if (status === "suspended") {
      redirect("/dashboard/billing?suspended=1");
    }
  }

  redirect("/dashboard");
}
