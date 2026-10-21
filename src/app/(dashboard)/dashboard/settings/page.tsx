import {smsPlanPricing} from "@/lib/sms-plan-pricing";
import {parseBusinessHoursBundle} from "@/lib/business-hours";
import {DEFAULT_OUTSIDE_HOURS} from "@/lib/outside-hours-policy";
import { parseCallRoutingMode } from "@/lib/call-routing";
import { loadAccountBilling } from "@/lib/account-session";
import { buildDashboardAccountSummary } from "@/lib/dashboard-account-summary";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { signupSegmentLabel } from "@/lib/signup-segment-label";
import { canManageDashboardConfig } from "@/lib/team-roles";

import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, organizationId, user, profile, accountId, isLocalPreview } =
    await requireDashboardSession();

  const [{ data: org, error }, accountBilling, { data: blockedRows }] =
    await Promise.all([
    supabase
      .from("organizations")
      .select(
        "business_hours, is_active, status, name, phone_number, niche, agent_business_type, notification_email, notification_phone, call_routing_mode, fallback_number, slug, block_anonymous_callers",
      )
      .eq("id", organizationId)
      .maybeSingle(),
    loadAccountBilling(accountId),
    supabase
      .from("blocked_callers")
      .select("id, caller_e164, reason, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  if (!org) {
    return (
      <p className="text-sm text-slate-600">
        No organization found for this session. Check your profile and sign in
        again.
      </p>
    );
  }

  const status = (org.status as string | null)?.trim().toLowerCase() ?? "";
  const accountStatus =
    status === "suspended"
      ? "Paused"
      : status && status !== "active"
        ? "—"
        : "Active";

  const accountSummary = buildDashboardAccountSummary(profile, user, {
    name: accountBilling?.name ?? org.name ?? null,
    slug: (org.slug as string | null) ?? null,
  });

  return (
    <SettingsView
      className="min-h-0 flex-1"
      smsPricing={smsPlanPricing(accountBilling?.planTier)}
      callHandling={parseBusinessHoursBundle(org.business_hours).meta.outsideHours??DEFAULT_OUTSIDE_HOURS}
      signInEmail={user.email ?? ""}
      canManageAccount={canManageDashboardConfig(profile.role)}
      isLocalPreview={isLocalPreview}
      profileInitial={{
        name:
          profile.name?.trim() ||
          user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() ||
          "",
        initials: accountSummary.initials,
        avatarUrl: accountSummary.avatarUrl,
        subtitle: accountSummary.subtitle,
      }}
      blockedNumbers={{
        rows: (blockedRows ?? []).map((row) => ({
          id: row.id as string,
          caller_e164: row.caller_e164 as string,
          reason: (row.reason as string | null) ?? null,
          created_at: row.created_at as string,
        })),
        blockAnonymousCallers: Boolean(org.block_anonymous_callers),
      }}
      initial={{
        isActive: org.is_active ?? true,
        phoneNumber: org.phone_number ?? "",
        signupSegment: signupSegmentLabel({
          niche: org.niche,
          businessType: org.agent_business_type,
        }),
        notificationEmail: org.notification_email ?? "",
        notificationPhone: org.notification_phone ?? "",
        callRoutingMode: parseCallRoutingMode(org.call_routing_mode),
        transferNumber: (org.fallback_number as string | null) ?? "",
        accountStatus,
      }}
    />
  );
}
