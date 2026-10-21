"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { sendInviteEmail } from "@/lib/invite-email";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import {
  parseOrganizationNiche,
  PRODUCT_NAME_BY_NICHE,
} from "@/lib/organization-niche";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { verticalPackForNiche } from "@/lib/verticals";
import { createAdminClient } from "@/utils/supabase/admin";

export type TeamActionResult = { ok: true } | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function inviteTeamMember(
  _prev: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  const session = await requireDashboardAdmin();

  const { data: org } = await session.supabase
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();
  if (verticalPackForNiche(String(org?.niche ?? "")).id === "retail") {
    return {
      ok: false,
      message: "Retail stores manage team access via Cliste admin.",
    };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "member");

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (role !== "member" && role !== "admin") {
    return { ok: false, message: "Invalid role." };
  }

  const admin = createAdminClient();
  const appOrigin =
    (process.env.NEXT_PUBLIC_APP_URL?.trim()
      ? resolveAppSiteOrigin().origin
      : null) ??
    (await headers()).get("origin") ??
    "http://localhost:3001";
  const inviteRedirectTo = `${appOrigin}/auth/callback`;

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, slug, niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName =
    resolveOrganizationDisplayName(orgRow?.name, orgRow?.slug) ||
    "your team";
  const niche = parseOrganizationNiche(orgRow?.niche);
  const productName = PRODUCT_NAME_BY_NICHE[niche];

  const { data: existingAuthUsers } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existingAuthUser = existingAuthUsers?.users?.find(
    (user) => user.email?.trim().toLowerCase() === email,
  );
  if (existingAuthUser?.id) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("account_id")
      .eq("id", existingAuthUser.id)
      .maybeSingle();

    if (
      existingProfile?.account_id &&
      existingProfile.account_id !== session.accountId
    ) {
      return {
        ok: false,
        message: "This email is already linked to another business.",
      };
    }
  }

  const inviteResult = await sendInviteEmail({
    email,
    recipientName: name || undefined,
    businessName,
    productName,
    redirectTo: inviteRedirectTo,
    admin,
  });

  if (!inviteResult.ok) {
    return {
      ok: false,
      message: inviteResult.message,
    };
  }

  const userId = inviteResult.userId;

  const { data: existing } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.account_id && existing.account_id !== session.accountId) {
    return {
      ok: false,
      message: "This email is already linked to another business.",
    };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      account_id: session.accountId,
      organization_id: session.organizationId,
      active_organization_id: session.organizationId,
      role,
      name: name || null,
    },
    { onConflict: "id" },
  );

  if (!profileError) {
    await admin.from("account_memberships").upsert(
      {
        user_id: userId,
        account_id: session.accountId,
        role,
      },
      { onConflict: "user_id,account_id" },
    );
  }

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  const ctx = buildSecurityEventContext(await headers());
  await logSecurityEvent(ctx, {
    eventType: "team_member_invited",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId: userId,
    targetEmail: email,
    metadata: { role },
  });

  revalidatePath(DASHBOARD_ROUTES.team);
  return { ok: true };
}

export async function removeTeamMemberAction(
  formData: FormData,
): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  await removeTeamMember(userId);
}

export async function removeTeamMember(
  userId: string,
): Promise<TeamActionResult> {
  const session = await requireDashboardAdmin();
  const trimmed = userId.trim();
  if (!trimmed) return { ok: false, message: "Invalid member." };

  const { data: org } = await session.supabase
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();
  if (verticalPackForNiche(String(org?.niche ?? "")).id === "retail") {
    return {
      ok: false,
      message: "Retail stores manage team access via Cliste admin.",
    };
  }

  if (trimmed === session.user.id) {
    return { ok: false, message: "You cannot remove yourself." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, account_id, role")
    .eq("id", trimmed)
    .maybeSingle();

  if (!profile || profile.account_id !== session.accountId) {
    return { ok: false, message: "Team member not found." };
  }

  if (profile.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_id", session.accountId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { ok: false, message: "You need at least one owner on the team." };
    }
  }

  const { error } = await admin.from("profiles").delete().eq("id", trimmed);
  if (error) return { ok: false, message: error.message };

  await admin
    .from("account_memberships")
    .delete()
    .eq("user_id", trimmed)
    .eq("account_id", session.accountId);

  try {
    await admin.auth.admin.deleteUser(trimmed);
  } catch {
    /* profile already removed; auth cleanup is best-effort */
  }

  revalidatePath(DASHBOARD_ROUTES.team);
  return { ok: true };
}
