import "server-only";
import { finalizeSignupBilling } from "@/lib/signup-billing-security";
import { reserveSignupPoolNumber } from "@/lib/reserve-signup-number";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { patchAccountAndLocations } from "@/lib/account-billing";
import { resolveAccountIdForOrganization } from "@/lib/account-access";
import {
  isLaunchTier,
  isPlanTier,
  normaliseLaunchTierForDb,
  PLATFORM_TRIAL_DAYS,
  type LaunchTier,
  type PlanTier,
} from "@/lib/cliste-plans";
import { LOCAL_DEV_APP_ORIGIN, resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { ONBOARDING_STEPS } from "@/lib/onboarding-session";
import { assertPlatformCheckoutSessionComplete } from "@/lib/platform-checkout-session-validation";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export {
  assertPlatformCheckoutSessionComplete,
  PlatformCheckoutNotCompleteError,
} from "@/lib/platform-checkout-session-validation";

export type PlatformCheckoutResult =
  | { ok: true; mode: "redirect"; url: string }
  | { ok: true; mode: "embedded"; clientSecret: string }
  | { ok: false; message: string };

export async function resolveCheckoutReturnOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return resolveAppSiteOrigin().origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be set for billing return URLs.",
    );
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : LOCAL_DEV_APP_ORIGIN;
}

/** Persist plan / launch / interval on the account before Checkout. */
export async function persistOrgBillingSelection(input: {
  organizationId: string;
  planTier: PlanTier;
  launchTier: LaunchTier;
  interval: "month" | "year";
}): Promise<void> {
  const accountId = await resolveAccountIdForOrganization(input.organizationId);
  if (!accountId) {
    throw new Error("Organisation is not linked to an account.");
  }

  const payload = {
    plan_tier: input.planTier,
    launch_tier: normaliseLaunchTierForDb(input.launchTier),
    billing_interval: input.interval,
    updated_at: new Date().toISOString(),
  };

  await patchAccountAndLocations(accountId, payload);
}

type PlatformCheckoutBaseInput = {
  organizationId: string;
  userEmail: string | undefined;
  planTier: PlanTier;
  launchTier: LaunchTier;
  interval: "month" | "year";
  idempotencyKey: string;
  signupFlow?: string;
  integrationIdentifier?: string;
};

type RedirectCheckoutInput = PlatformCheckoutBaseInput & {
  checkoutMode?: "redirect";
  successUrl: string;
  cancelUrl: string;
};

type EmbeddedCheckoutInput = PlatformCheckoutBaseInput & {
  checkoutMode: "embedded";
  returnUrl: string;
};

/**
 * Stripe Billing Checkout for the Cliste platform subscription (plan + metered
 * overage, optional one-off launch fee).
 */
export async function createPlatformSubscriptionCheckout(
  input: RedirectCheckoutInput | EmbeddedCheckoutInput,
): Promise<PlatformCheckoutResult> {
  const accountId = await resolveAccountIdForOrganization(input.organizationId);
  if (!accountId) {
    return { ok: false, message: "Organisation is not linked to an account." };
  }

  await persistOrgBillingSelection({
    organizationId: input.organizationId,
    planTier: input.planTier,
    launchTier: input.launchTier,
    interval: input.interval,
  });

  const admin = createAdminClient();

  const planKey =
    input.interval === "year"
      ? `cliste_plan_${input.planTier}_annual`
      : `cliste_plan_${input.planTier}_monthly`;
  const overageKey = `cliste_plan_${input.planTier}_overage_min`;
  const smsOverageKey = `cliste_plan_${input.planTier}_overage_sms`;
  const wantedKeys = [planKey, overageKey, smsOverageKey];
  if (input.launchTier !== "diy") {
    wantedKeys.push(`cliste_setup_${input.launchTier}_once`);
  }

  // Resolve new signup prices in the active Stripe account. Sandbox price IDs
  // must never overwrite the shared database's existing billing catalogue.
  const { data: priceRows } = input.signupFlow
    ? { data: (await getStripeClient().prices.list({ lookup_keys: wantedKeys, active: true, limit: 100 })).data.map(price => ({ key: price.lookup_key!, stripe_price_id: price.id })) }
    : await admin.from("stripe_platform_prices").select("key, stripe_price_id").in("key", wantedKeys).eq("active", true);

  const priceMap = new Map<string, string>();
  for (const r of priceRows ?? []) {
    priceMap.set(r.key as string, r.stripe_price_id as string);
  }

  const planPriceId = priceMap.get(planKey);
  const overagePriceId = priceMap.get(overageKey);
  const smsOveragePriceId = priceMap.get(smsOverageKey);
  if (!planPriceId || !overagePriceId) {
    return {
      ok: false,
      message:
        "Pricing isn't configured yet. Run `npm run stripe:bootstrap` from the app repo and refresh.",
    };
  }

  const stripe = getStripeClient();
  const lineItems: Array<{ price: string; quantity?: number }> = [
    { price: planPriceId, quantity: 1 },
    { price: overagePriceId },
  ];
  if (smsOveragePriceId) {
    lineItems.push({ price: smsOveragePriceId });
  }

  const addInvoiceItems: Array<{ price: string; quantity?: number }> = [];
  if (input.launchTier !== "diy") {
    const setupPriceId = priceMap.get(`cliste_setup_${input.launchTier}_once`);
    if (setupPriceId) {
      addInvoiceItems.push({ price: setupPriceId, quantity: 1 });
    }
  }

  const sessionBase = {
    mode: "subscription" as const,
    payment_method_collection: "always" as const,
    ...(input.integrationIdentifier ? { integration_identifier: input.integrationIdentifier } : {}),
    line_items: lineItems,
    customer_email: input.userEmail,
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: PLATFORM_TRIAL_DAYS,
      metadata: {
        cliste_account_id: accountId,
        cliste_organization_id: input.organizationId,
        cliste_plan_tier: input.planTier,
        cliste_launch_tier: input.launchTier,
        ...(input.signupFlow ? { cliste_signup_flow: input.signupFlow } : {}),
      },
      ...(addInvoiceItems.length > 0
        ? { add_invoice_items: addInvoiceItems }
        : {}),
    },
    metadata: {
      cliste_account_id: accountId,
      cliste_organization_id: input.organizationId,
      cliste_plan_tier: input.planTier,
      cliste_launch_tier: input.launchTier,
      ...(input.signupFlow ? { cliste_signup_flow: input.signupFlow } : {}),
    },
  };

  try {
    if (input.checkoutMode === "embedded") {
      const checkout = await stripe.checkout.sessions.create(
        {
          ...sessionBase,
          ui_mode: "embedded_page",
          return_url: input.returnUrl,
        },
        { idempotencyKey: input.idempotencyKey },
      );

      if (!checkout.client_secret) {
        return {
          ok: false,
          message: "Stripe did not return an embedded Checkout client secret.",
        };
      }
      return { ok: true, mode: "embedded", clientSecret: checkout.client_secret };
    }

    const checkout = await stripe.checkout.sessions.create(
      {
        ...sessionBase,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (!checkout.url) {
      return { ok: false, message: "Stripe did not return a Checkout URL." };
    }
    return { ok: true, mode: "redirect", url: checkout.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    console.error("[platform-billing] checkout failed", err);
    return { ok: false, message };
  }
}

/** Persist Stripe customer + subscription ids after Checkout success. */
export async function persistPlatformCheckoutSession(
  organizationId: string,
  checkoutSessionId: string,
): Promise<void> {
  if (!checkoutSessionId.trim()) return;

  const stripe = getStripeClient();
  const co = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription", "customer"],
  });

  assertPlatformCheckoutSessionComplete(co);

  const accountId = await resolveAccountIdForOrganization(organizationId);
  const metaOrg = (co.metadata?.cliste_organization_id ?? "").trim();
  const metaAccount = (co.metadata?.cliste_account_id ?? "").trim();
  if (
    metaOrg !== organizationId &&
    (!accountId || metaAccount !== accountId)
  ) {
    throw new Error("Checkout session does not belong to this organisation.");
  }

  const subscriptionId =
    typeof co.subscription === "string"
      ? co.subscription
      : co.subscription?.id ?? null;
  const customerId =
    typeof co.customer === "string" ? co.customer : co.customer?.id ?? null;

  const admin = createAdminClient();
  if (!accountId) {
    throw new Error("Organisation is not linked to an account.");
  }
  if (co.metadata?.cliste_signup_flow === "simple_v1") {
    if (!subscriptionId) throw new Error("Missing subscription.");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!["active", "trialing"].includes(subscription.status) || subscription.metadata.cliste_account_id !== accountId || subscription.metadata.cliste_organization_id !== organizationId) throw new Error("Invalid subscription.");
    await finalizeSignupBilling(accountId, organizationId, subscription);
    return;
  }
  const billingPatch = {
    platform_subscription_id: subscriptionId,
    platform_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };
  await admin.from("accounts").update(billingPatch).eq("id", accountId);
  await admin.from("organizations").update(billingPatch).eq("account_id", accountId);
}

/**
 * Activate an account + org after a paid platform subscription checkout.
 * Idempotent — safe from both the browser return handler and Stripe webhooks.
 */
export async function activatePlatformSubscriptionGoLive(
  organizationId: string,
  options?: { dashboardOnly?: boolean },
): Promise<void> {
  const accountId = await resolveAccountIdForOrganization(organizationId);
  if (!accountId) {
    throw new Error("Organisation is not linked to an account.");
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("platform_subscription_id, platform_customer_id, status")
    .eq("id", accountId)
    .maybeSingle();

  const subscriptionId = String(
    account?.platform_subscription_id ?? "",
  ).trim();
  if (!subscriptionId) {
    throw new Error("No platform subscription found for this organisation.");
  }

  const nowIso = new Date().toISOString();
  if (options?.dashboardOnly) {
    // Activation was committed atomically by finalize_signup_billing.
    if (account?.status !== "active") throw new Error("Billing has not been confirmed.");
    // Confirmed payment setup reserves existing inventory, without activating calls.
    // An empty pool must not fail checkout or trigger a paid purchase.
    try { await reserveSignupPoolNumber(organizationId); } catch { console.warn("[signup] Pool reservation unavailable; workspace remains accessible."); }
    return;
  }
  const activationPatch = {
    platform_subscription_id: subscriptionId,
    platform_customer_id:
      (account?.platform_customer_id as string | null) ?? null,
    status: "active",
    launch_status: "completed",
    updated_at: nowIso,
  };

  await patchAccountAndLocations(accountId, activationPatch, {
    primaryOrganizationId: organizationId,
  });

  await admin
    .from("organizations")
    .update({
      is_active: true,
      onboarding_step: ONBOARDING_STEPS.done,
      updated_at: nowIso,
    })
    .eq("id", organizationId);

  try {
    const phoneResult = await provisionOrganizationPhoneNumber(organizationId);
    if (!phoneResult.ok) {
      console.warn(
        "[platform-billing] phone provision failed",
        organizationId,
        phoneResult.message,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("23505") ||
      msg.includes("phone_numbers_one_assigned_per_org")
    ) {
      return;
    }
    console.error(
      "[platform-billing] phone provision error",
      organizationId,
      err,
    );
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
}

/** Validate a Checkout Session payload from a Stripe webhook event. */
export function assertWebhookPlatformCheckoutSessionComplete(
  session: Stripe.Checkout.Session,
): void {
  assertPlatformCheckoutSessionComplete(session);
}

export function parseOrgBillingSelection(org: {
  plan_tier: string | null;
  launch_tier: string | null;
  billing_interval: string | null;
}): {
  planTier: PlanTier;
  launchTier: LaunchTier;
  interval: "month" | "year";
} {
  const planTier = isPlanTier(org.plan_tier) ? org.plan_tier : "pro";
  const launchTier =
    isLaunchTier(org.launch_tier ?? "") ? (org.launch_tier as LaunchTier) : "diy";
  const interval = org.billing_interval === "year" ? "year" : "month";
  return { planTier, launchTier, interval };
}
