import {hasAccountOwnerAccess} from "@/lib/account-owner-access";
import {loadDashboardBillingDetails} from "@/lib/dashboard-billing-details";
import { setupOptionLabel } from "@/lib/setup-option-label";
import { redirect } from "next/navigation";

import { loadAccountBilling, loadAccountLocations } from "@/lib/account-session";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { parseOrganizationNiche } from "@/lib/organization-niche";
import { PLANS, type PlanTier } from "@/lib/cliste-plans";
import { customerUsageFilters } from "@/lib/dashboard-customer-data";

import { finaliseBillingCheckout } from "./actions";
import { UsageView } from "./usage-view";
import type { UsagePageData } from "./usage-helpers";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Usage: plan quota, customer minutes this billing period, and billing portal. */
export default async function BillingPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const suspendedQuery = sp.suspended === "1";
  const status = firstParam(sp.status);
  const checkoutSessionId = firstParam(sp.session_id);

  if (status === "return" && checkoutSessionId) {
    let finalised = false;
    try {
      await finaliseBillingCheckout(checkoutSessionId);
      finalised = true;
    } catch (err) {
      console.warn("[billing] finalise checkout failed", err);
    }
    redirect(finalised ? "/dashboard/usage?billing=ready" : "/dashboard/usage?billing=pending");
  }

  const { supabase, accountId, organizationId, user, profile } = await requireDashboardSession();

  // Retail pilot clients are invoiced directly by Cliste — no self-serve billing.
  const { data: orgNicheRow } = await supabase.from("organizations")
    .select("niche,launch_tier").eq("id", organizationId).maybeSingle();
  if (parseOrganizationNiche(orgNicheRow?.niche) === "retail") {
    if (!suspendedQuery) redirect("/dashboard");
    return (
      <div className="mx-auto w-full max-w-xl py-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6">
          <h1 className="text-lg font-semibold tracking-tight text-amber-950">This account is suspended</h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-950/90">
            Cara has stopped answering calls for this store. Contact Cliste to
            reactivate the account — billing for pilot stores is handled
            directly, not through this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const [accountBilling, locations] = await Promise.all([
    loadAccountBilling(accountId), loadAccountLocations(accountId),
  ]);
  const locationIds = locations.map((location) => location.id);
  const planTier: PlanTier | null = accountBilling?.planTier ?? null;
  const plan = planTier ? PLANS[planTier] : null;
  const periodStart = accountBilling?.billingPeriodStart ??
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);

  // Read every page rather than silently truncating totals at the API row cap.
  const usageRows: { organization_id: string; minutes_billable: number | null; synced_to_stripe_at: string | null; ended_at: string | null }[] = [];
  const smsRows: { organization_id: string; segments: number }[] = [];
  let usageError: { message: string } | null = null;
  let smsError: { message: string } | null = null;
  for (let offset = 0; ; offset += 500) {
    const result = await customerUsageFilters(supabase.from("usage_records")
      .select("id, organization_id, minutes_billable, synced_to_stripe_at, ended_at"))
      .in("organization_id", locationIds.length ? locationIds : [organizationId])
      .gte("billing_period_start", periodStart).order("id").range(offset, offset + 499);
    if (result.error) { usageError = result.error; usageRows.length = 0; break; }
    usageRows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from("sms_usage_records").select("id, organization_id, segments")
      .in("organization_id", locationIds.length ? locationIds : [organizationId])
      .gte("sent_at", `${periodStart}T00:00:00.000Z`).order("id").range(offset, offset + 499);
    if (result.error) { smsError = result.error; smsRows.length = 0; break; }
    smsRows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) break;
  }

  const breakdownByOrg = new Map<string, { usedMinutes: number; usedSms: number; callsCounted: number }>();
  for (const location of locations) {
    breakdownByOrg.set(location.id, { usedMinutes: 0, usedSms: 0, callsCounted: 0 });
  }
  let usedMinutes = 0;
  let lastStripeSync: string | null = null;
  let lastCallAt: string | null = null;
  for (const row of usageRows ?? []) {
    const record = row as {
      organization_id: string;
      minutes_billable: number | null;
      synced_to_stripe_at: string | null;
      ended_at: string | null;
    };
    const m = record.minutes_billable;
    const minutes = typeof m === "number" ? m : Number(m) || 0;
    usedMinutes += minutes;
    const bucket = breakdownByOrg.get(record.organization_id);
    if (bucket) { bucket.usedMinutes += minutes; bucket.callsCounted += 1; }
    const synced = record.synced_to_stripe_at;
    if (synced && (!lastStripeSync || synced > lastStripeSync)) lastStripeSync = synced;
    const ended = record.ended_at;
    if (ended && (!lastCallAt || ended > lastCallAt)) lastCallAt = ended;
  }

  let usedSms = 0;
  for (const row of smsRows ?? []) {
    const record = row as { organization_id: string; segments?: number };
    const segments = typeof record.segments === "number" ? record.segments : 0;
    usedSms += segments;
    const bucket = breakdownByOrg.get(record.organization_id);
    if (bucket) bucket.usedSms += segments;
  }
  const locationBreakdown = locations.map((location) => {
    const bucket = breakdownByOrg.get(location.id) ?? { usedMinutes: 0, usedSms: 0, callsCounted: 0 };
    return {
      organizationId: location.id,
      locationName: resolveOrganizationDisplayName(location.name, location.slug) || "Location",
      usedMinutes: bucket.usedMinutes,
      usedSms: bucket.usedSms,
      callsCounted: bucket.callsCounted,
    };
  });

  const includedMinutes = plan?.includedMinutes ?? 0;
  const includedSms = plan?.includedSms ?? 0;
  const extraSms = Math.max(0, usedSms - includedSms);
  const extraMinutes = Math.max(0, usedMinutes - includedMinutes);
  const remainingMinutes = Math.max(0, includedMinutes - usedMinutes);
  const progressPct = includedMinutes > 0 ? Math.min(100, Math.round((usedMinutes / includedMinutes) * 100)) : 0;
  const projectedOverageCents = plan ? extraMinutes * plan.overageRateCents + extraSms * plan.smsOverageRateCents : 0;
  const hasBillingPortal = Boolean(accountBilling?.platformCustomerId?.trim());
  const hasSubscription = Boolean(accountBilling?.platformSubscriptionId?.trim());
  const suspended = suspendedQuery || accountBilling?.status === "suspended";
  const owner=await hasAccountOwnerAccess(supabase,{userId:user.id,accountId,profileRole:profile.role});
  const canManageBilling = owner && (hasBillingPortal || hasSubscription || suspended);
  const billingDetails=owner?await loadDashboardBillingDetails(accountBilling?.platformSubscriptionId??null,accountBilling?.platformCustomerId??null):null;

  const data: UsagePageData = {
    planName: plan?.name ?? "No plan",
    plan,
    usedMinutes,
    includedMinutes,
    extraMinutes,
    remainingMinutes,
    progressPct,
    projectedOverageCents,
    periodStart,
    periodEnd: billingDetails?.renewsAt??null,
    billingDetails,
    setupChoice:setupOptionLabel(orgNicheRow?.launch_tier),
    loadError:usageError||smsError||!accountBilling?"We couldn’t load complete usage information. Refresh before relying on these totals.":null,
    callsCounted: usageRows?.length ?? 0,
    lastCallAt,
    lastStripeSync,
    hasBillingPortal,
    hasSubscription,
    canManageBilling,
    canSetUpBilling: owner && !canManageBilling,
    suspended,
    suspendedReason: null,
    usedSms,
    includedSms,
    extraSms,
    locationCount: locations.length,
    locationBreakdown,
  };
  const billingReady = firstParam(sp.billing) === "ready";
  const checkoutCancelled = status === "cancel";

  return (
    <div className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "overflow-hidden")} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <UsageView className="min-h-0 flex-1" data={data} billingReady={billingReady} billingPending={firstParam(sp.billing) === "pending"} checkoutCancelled={checkoutCancelled} />
      </div>
    </div>
  );
}
