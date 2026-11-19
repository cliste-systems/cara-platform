import type { PlanDefinition } from "@/lib/cliste-plans";

export type UsageLocationBreakdown = {
  organizationId: string;
  locationName: string;
  usedMinutes: number;
  usedSms: number;
  callsCounted: number;
};

export type UsagePageData = {
  billingDetails?:import("@/lib/dashboard-billing-details").DashboardBillingDetails|null;
  setupChoice?:string;
  loadError?:string|null;
  planName: string;
  plan: PlanDefinition | null;
  usedMinutes: number;
  includedMinutes: number;
  extraMinutes: number;
  remainingMinutes: number;
  progressPct: number;
  projectedOverageCents: number;
  periodStart: string;
  periodEnd: string | null;
  callsCounted: number;
  /** Most recent finished call included in this period's total. */
  lastCallAt: string | null;
  /** When usage was last forwarded to Stripe (meter events). */
  lastStripeSync: string | null;
  /** Stripe customer id stored on the org (portal opens immediately). */
  hasBillingPortal: boolean;
  /** Subscription id on the org — portal can recover customer id from Stripe. */
  hasSubscription: boolean;
  /** Show Manage billing (portal or heal customer from subscription). */
  canManageBilling: boolean;
  canSetUpBilling?: boolean;
  suspended: boolean;
  suspendedReason: string | null;
  usedSms: number;
  includedSms: number;
  extraSms: number;
  locationCount: number;
  locationBreakdown: UsageLocationBreakdown[];
};

export function buildUsageSummary(data: UsagePageData): {
  primary: string;
  secondary: string;
} {
  const used = formatMinutes(data.usedMinutes);
  const included = formatMinutes(data.includedMinutes);

  if (data.includedMinutes <= 0) {
    return {
      primary: `${used} minutes used`,
      secondary: "No included minutes on your current plan.",
    };
  }

  if (data.extraMinutes > 0) {
    return {
      primary: `${used} of ${included} minutes used`,
      secondary: `${formatMinutes(data.extraMinutes)} extra minute${data.extraMinutes === 1 ? "" : "s"} this period.`,
    };
  }

  return {
    primary: `${used} of ${included} minutes used`,
    secondary: `${formatMinutes(data.remainingMinutes)} minute${data.remainingMinutes === 1 ? "" : "s"} remaining before extra minutes apply.`,
  };
}

export function formatMinutes(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-IE", {
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 1,
  });
}

export function formatEuro(cents: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `€${(cents / 100).toFixed(0)}`;
  }
}

export function formatEuroFromCents(cents: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `€${(cents / 100).toFixed(2)}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** First day of the next billing period (monthly from `periodStart`). */
export function billingPeriodRenewalDate(periodStart: string): Date {
  const start = new Date(`${periodStart.trim()}T12:00:00Z`);
  const renew = new Date(start);
  renew.setUTCMonth(renew.getUTCMonth() + 1);
  return renew;
}

export function formatBillingPeriodRenewal(periodStart: string): string {
  try {
    return billingPeriodRenewalDate(periodStart).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  try {
    return new Date(iso).toLocaleString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatStripeSyncStatus(
  lastStripeSync: string | null,
  hasBillingPortal: boolean,
): string {
  if (lastStripeSync?.trim()) return formatDateTime(lastStripeSync);
  if (!hasBillingPortal) return "Set up billing first";
  return "Pending";
}
