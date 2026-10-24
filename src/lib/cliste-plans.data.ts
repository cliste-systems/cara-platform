/**
 * Pure data for Cliste platform plans + launches.
 *
 * This file is isomorphic: no `server-only`, no Next imports, no Supabase.
 * Marketing site CTAs should use the same tier slugs: starter | pro | business | custom
 */

/** Platform subscription free-trial length (Stripe `trial_period_days`). */
export const PLATFORM_TRIAL_DAYS = 7;

export type PlanTier = "starter" | "pro" | "business" | "enterprise";
export type BillingInterval = "month" | "year";
export type LaunchTier = "diy" | "remote" | "onsite_dublin" | "onsite_rest_ie";

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyCents: number;
  annualCents: number;
  includedMinutes: number;
  includedSms: number;
  overageRateCents: number;
  smsOverageRateCents: number;
  applicationFeeBps: number;
  /** Locations included in the base subscription price. */
  includedLocations: number;
  /** Per extra location / month (Business+). Null = not available. */
  locationAddonMonthlyCents: number | null;
  features: string[];
  recommended?: boolean;
  /** When false, checkout is blocked — contact sales (Custom / Enterprise). */
  selfServe: boolean;
};

/** Licensed Stripe price for each location beyond the first. */
export const LOCATION_ADDON_MONTHLY_CENTS = 7900;
export const LOCATION_ADDON_STRIPE_KEY = "cliste_location_addon_monthly";

export const STANDARD_PLAN_FEATURES = [
  "Cara, your AI receptionist, available 24/7",
  "Call transcripts, summaries and callback capture",
  "Knowledge Base and HelloCara dashboard",
  "Forward your existing business number",
];

export const PLANS: Record<PlanTier, PlanDefinition> = {
  starter: {
    tier: "starter",
    name: "Starter",
    tagline:
      "For smaller businesses that want calls answered and requests captured.",
    monthlyCents: 9900,
    annualCents: 9900 * 10,
    includedMinutes: 150,
    includedSms: 40,
    overageRateCents: 49,
    smsOverageRateCents: 15,
    applicationFeeBps: 150,
    includedLocations: 1,
    locationAddonMonthlyCents: null,
    selfServe: true,
    features: [...STANDARD_PLAN_FEATURES],
  },
  pro: {
    tier: "pro",
    name: "Growth",
    tagline:
      "For busy local businesses handling more calls each month.",
    monthlyCents: 19900,
    annualCents: 19900 * 10,
    includedMinutes: 400,
    includedSms: 150,
    overageRateCents: 45,
    smsOverageRateCents: 15,
    applicationFeeBps: 100,
    includedLocations: 1,
    locationAddonMonthlyCents: null,
    recommended: true,
    selfServe: true,
    features: [...STANDARD_PLAN_FEATURES],
  },
  business: {
    tier: "business",
    name: "Business",
    tagline:
      "For businesses with a higher call volume that need more included minutes.",
    monthlyCents: 34900,
    annualCents: 34900 * 10,
    includedMinutes: 800,
    includedSms: 300,
    overageRateCents: 40,
    smsOverageRateCents: 15,
    applicationFeeBps: 50,
    includedLocations: 1,
    locationAddonMonthlyCents: LOCATION_ADDON_MONTHLY_CENTS,
    selfServe: true,
    features: [...STANDARD_PLAN_FEATURES],
  },
  enterprise: {
    tier: "enterprise",
    name: "Custom",
    tagline:
      "Volume pricing, negotiated rates, and tailored setup for larger businesses.",
    monthlyCents: 0,
    annualCents: 0,
    includedMinutes: 2000,
    includedSms: 500,
    overageRateCents: 45,
    smsOverageRateCents: 15,
    applicationFeeBps: 25,
    includedLocations: 1,
    locationAddonMonthlyCents: LOCATION_ADDON_MONTHLY_CENTS,
    selfServe: false,
    features: [
      "Volume minutes and SMS",
      "Negotiated overage rates",
      "Multi-location routing",
      "Dedicated success contact",
      "Custom Cara setup reviews",
    ],
  },
};

export type LaunchDefinition = {
  tier: LaunchTier;
  name: string;
  description: string;
  priceCents: number;
  targetRegion?: string;
};

export const LAUNCHES: Record<LaunchTier, LaunchDefinition> = {
  diy: {
    tier: "diy",
    name: "Set up myself",
    description:
      "Set up Cara in your dashboard.",
    priceCents: 0,
  },
  remote: {
    tier: "remote",
    name: "Remote setup",
    description:
      "Help setting up Cara remotely.",
    priceCents: 19900,
  },
  onsite_dublin: {
    tier: "onsite_dublin",
    name: "On-site setup",
    description:
      "Help setting up Cara at your premises.",
    priceCents: 39900,
    targetRegion: "Dublin, Kildare, Meath, Wicklow, Louth",
  },
  onsite_rest_ie: {
    tier: "onsite_rest_ie",
    name: "On-site setup",
    description:
      "Help setting up Cara at your premises.",
    priceCents: 39900,
    targetRegion: "Cork, Galway, Limerick, Waterford, and nationwide",
  },
};

export function planFromPriceCents(cents: number): PlanTier | null {
  if (cents <= 0) return null;
  for (const p of Object.values(PLANS)) {
    if (p.monthlyCents === cents || p.annualCents === cents) return p.tier;
  }
  return null;
}

/** Resolve plan tier from a Stripe Price lookup_key (cliste_plan_<tier>_monthly|annual). */
export function planFromStripePriceId(lookupKey: string): PlanTier | null {
  const key = lookupKey.trim();
  const match = /^cliste_plan_(starter|pro|business|enterprise)_(monthly|annual)$/.exec(
    key,
  );
  if (!match) return null;
  const tier = match[1];
  return isPlanTier(tier) ? tier : null;
}

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    typeof value === "string" &&
    (value === "starter" ||
      value === "pro" ||
      value === "business" ||
      value === "enterprise")
  );
}

export function isLaunchTier(value: unknown): value is LaunchTier {
  return (
    typeof value === "string" &&
    (value === "diy" ||
      value === "remote" ||
      value === "onsite_dublin" ||
      value === "onsite_rest_ie")
  );
}

export function normaliseLaunchTierForDb(
  t: LaunchTier,
): "diy" | "remote" | "onsite" {
  if (t === "diy") return "diy";
  if (t === "remote") return "remote";
  return "onsite";
}

export function planSupportsSelfServeCheckout(tier: PlanTier): boolean {
  return PLANS[tier].selfServe;
}
