import "server-only";

import type Stripe from "stripe";

import { patchAccountAndLocations } from "@/lib/account-billing";
import { resolveAccountIdForOrganization } from "@/lib/account-access";
import type { LaunchTier, PlanTier } from "@/lib/cliste-plans";
import { PLANS, LAUNCHES, PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";
import { ONBOARDING_STEPS } from "@/lib/onboarding-session";
import { activatePlatformSubscriptionGoLive } from "@/lib/platform-billing-checkout";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export type PlatformElementsCheckoutSummary = {
  planName: string;
  setupLabel?: string;
  setupTier?: "diy" | "remote" | "onsite_dublin";
  trialDays: number;
  amountLabel: string;
  intervalLabel: string;
  email: string;
};

export type PlatformElementsCheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      subscriptionId: string;
      summary: PlatformElementsCheckoutSummary;
    }
  | { ok: false; message: string };

type ElementsCheckoutInput = {
  planTier: PlanTier;
  launchTier: LaunchTier;
  interval: "month" | "year";
  userEmail: string;
  organizationId?: string;
  accountId?: string;
  devPreview?: boolean;
  signupFlow?: string;
  idempotencyKey?: string;
};

function subscriptionCustomerId(subscription: Stripe.Subscription): string | null {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : (subscription.customer?.id ?? null);
}

function subscriptionDefaultPaymentMethodId(
  subscription: Stripe.Subscription,
): string | null {
  const pm = subscription.default_payment_method;
  if (!pm) return null;
  return typeof pm === "string" ? pm : (pm.id ?? null);
}

function setupIntentCustomerId(setupIntent: Stripe.SetupIntent): string | null {
  return typeof setupIntent.customer === "string"
    ? setupIntent.customer
    : (setupIntent.customer?.id ?? null);
}

function setupIntentPaymentMethodId(
  setupIntent: Stripe.SetupIntent,
): string | null {
  const pm = setupIntent.payment_method;
  if (!pm) return null;
  return typeof pm === "string" ? pm : (pm.id ?? null);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reject dev-preview or metadata-mismatched subscriptions before persisting. */
export function assertPlatformSubscriptionOwnership(
  subscription: Stripe.Subscription,
  input: { organizationId: string; accountId?: string },
): void {
  if (
    process.env.NODE_ENV === "production" &&
    subscription.metadata?.cliste_dev_preview === "true"
  ) {
    throw new Error("Subscription does not belong to this organisation.");
  }

  const metaOrg = (subscription.metadata?.cliste_organization_id ?? "").trim();
  if (metaOrg !== input.organizationId) {
    throw new Error("Subscription does not belong to this organisation.");
  }

  const metaAccount = (subscription.metadata?.cliste_account_id ?? "").trim();
  if (metaAccount && input.accountId && metaAccount !== input.accountId) {
    throw new Error("Subscription does not belong to this organisation.");
  }
}

export function assertSetupIntentSucceeded(
  setupIntent: Stripe.SetupIntent,
): void {
  if (setupIntent.status !== "succeeded") {
    throw new Error("Payment setup has not been confirmed yet.");
  }
}

export function assertSetupIntentMatchesSubscription(
  setupIntent: Stripe.SetupIntent,
  subscription: Stripe.Subscription,
  subscriptionId: string,
): void {
  const metaSub = (setupIntent.metadata?.cliste_subscription_id ?? "").trim();
  if (metaSub && metaSub !== subscriptionId) {
    throw new Error("Payment setup does not match this subscription.");
  }

  const setupCustomerId = setupIntentCustomerId(setupIntent);
  const subCustomerId = subscriptionCustomerId(subscription);
  if (
    setupCustomerId &&
    subCustomerId &&
    setupCustomerId !== subCustomerId
  ) {
    throw new Error("Payment setup does not match this subscription.");
  }

  const setupPmId = setupIntentPaymentMethodId(setupIntent);
  const defaultPmId = subscriptionDefaultPaymentMethodId(subscription);
  if (setupPmId && defaultPmId && setupPmId !== defaultPmId) {
    throw new Error("Payment setup does not match this subscription.");
  }
}

async function loadSubscriptionPriceIds(
  planTier: PlanTier,
  launchTier: LaunchTier,
  interval: "month" | "year",
  signupFlow?: string,
): Promise<
  | { ok: true; planPriceId: string; overagePriceId: string; smsOveragePriceId?: string; setupPriceId?: string }
  | { ok: false; message: string }
> {
  const planKey =
    interval === "year"
      ? `cliste_plan_${planTier}_annual`
      : `cliste_plan_${planTier}_monthly`;
  const overageKey = `cliste_plan_${planTier}_overage_min`;
  const smsOverageKey = `cliste_plan_${planTier}_overage_sms`;
  // The public signup offer is minute-based; retain legacy SMS billing only in the older flow.
  const wantedKeys = signupFlow ? [planKey, overageKey] : [planKey, overageKey, smsOverageKey];
  if (launchTier !== "diy") {
    wantedKeys.push(`cliste_setup_${launchTier}_once`);
  }

  const admin = createAdminClient();
  const stripePrices = signupFlow ? await getStripeClient().prices.list({lookup_keys:wantedKeys,active:true,limit:100}) : null;
  const { data: priceRows } = stripePrices
    ? {data:stripePrices.data.map(price=>({key:price.lookup_key!,stripe_price_id:price.id}))}
    : await admin.from("stripe_platform_prices").select("key, stripe_price_id").in("key", wantedKeys).eq("active", true);

  const priceMap = new Map<string, string>();
  for (const row of priceRows ?? []) {
    priceMap.set(row.key as string, row.stripe_price_id as string);
  }

  const planPriceId = priceMap.get(planKey);
  const overagePriceId = priceMap.get(overageKey);
  const smsOveragePriceId = priceMap.get(smsOverageKey);
  if (!planPriceId || !overagePriceId) {
    return {
      ok: false,
      message:
        "Pricing isn't configured yet. Run `npm run stripe:bootstrap` and retry.",
    };
  }

  const setupPriceId = !signupFlow || launchTier === "diy" ? undefined : priceMap.get(`cliste_setup_${launchTier}_once`);
  if (signupFlow && launchTier !== "diy" && !setupPriceId) return {ok:false,message:"Setup pricing is temporarily unavailable."};
  if (stripePrices) {
    const expected = new Map([[planKey, interval === "year" ? PLANS[planTier].annualCents : PLANS[planTier].monthlyCents], [overageKey, PLANS[planTier].overageRateCents]]);
    if (setupPriceId) expected.set(`cliste_setup_${launchTier}_once`, LAUNCHES[launchTier].priceCents);
    for (const [key, amount] of expected) {
      const price = stripePrices.data.find(price => price.lookup_key === key);
      if (price?.unit_amount !== amount || price.currency !== "eur") return {ok:false,message:"Billing prices are being updated. Please try again shortly."};
    }
  }
  return { ok: true, planPriceId, overagePriceId, smsOveragePriceId, setupPriceId };
}

function formatEuro(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return `€${value}`;
  return `€${value.toFixed(2)}`;
}

function checkoutSummary(
  planTier: PlanTier,
  interval: "month" | "year",
  email: string,
): PlatformElementsCheckoutSummary {
  const plan = PLANS[planTier];
  const monthlyCents =
    interval === "year" ? plan.annualCents : plan.monthlyCents;

  return {
    planName: plan.name,
    trialDays: PLATFORM_TRIAL_DAYS,
    amountLabel: formatEuro(monthlyCents),
    intervalLabel: interval === "year" ? "year" : "month",
    email,
  };
}

/**
 * Custom Stripe Elements flow — subscription with trial + metered items.
 * Returns a SetupIntent client secret from `pending_setup_intent`.
 */
export async function createPlatformElementsCheckout(
  input: ElementsCheckoutInput,
): Promise<PlatformElementsCheckoutResult> {
  const email = input.userEmail.trim();
  if (!email) {
    return { ok: false, message: "Email is required for billing." };
  }

  const prices = await loadSubscriptionPriceIds(
    input.planTier,
    input.launchTier,
    input.interval,
    input.signupFlow,
  );
  if (!prices.ok) return prices;

  const lineItems: Array<{ price: string; quantity?: number }> = [
    { price: prices.planPriceId, quantity: 1 },
    { price: prices.overagePriceId },
  ];
  if (prices.smsOveragePriceId) {
    lineItems.push({ price: prices.smsOveragePriceId });
  }

  const stripe = getStripeClient();

  try {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        ...(input.organizationId
          ? { cliste_organization_id: input.organizationId }
          : {}),
        ...(input.accountId ? { cliste_account_id: input.accountId } : {}),
        ...(input.devPreview ? { cliste_dev_preview: "true" } : {}),
        ...(input.signupFlow ? { cliste_signup_flow: input.signupFlow } : {}),
      },
    }, input.idempotencyKey ? {idempotencyKey:`${input.idempotencyKey}-customer`} : undefined);

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: lineItems,
      trial_period_days: PLATFORM_TRIAL_DAYS,
      ...(input.signupFlow ? {trial_settings:{end_behavior:{missing_payment_method:"cancel" as const}}} : {}),
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["pending_setup_intent"],
      metadata: {
        cliste_plan_tier: input.planTier,
        cliste_launch_tier: input.launchTier,
        ...(input.organizationId
          ? { cliste_organization_id: input.organizationId }
          : {}),
        ...(input.accountId ? { cliste_account_id: input.accountId } : {}),
        ...(input.devPreview ? { cliste_dev_preview: "true" } : {}),
        ...(input.signupFlow ? { cliste_signup_flow: input.signupFlow } : {}),
      },
    }, input.idempotencyKey ? {idempotencyKey:`${input.idempotencyKey}-subscription`} : undefined);

    const setupIntentRef = subscription.pending_setup_intent;
    const setupIntentId =
      typeof setupIntentRef === "object" && setupIntentRef
        ? setupIntentRef.id
        : typeof setupIntentRef === "string"
          ? setupIntentRef
          : null;

    if (setupIntentId) {
      await stripe.setupIntents.update(setupIntentId, {
        metadata: {
          cliste_subscription_id: subscription.id,
          ...(input.organizationId
            ? { cliste_organization_id: input.organizationId }
            : {}),
          ...(input.accountId ? { cliste_account_id: input.accountId } : {}),
          ...(input.devPreview ? { cliste_dev_preview: "true" } : {}),
        ...(input.signupFlow ? { cliste_signup_flow: input.signupFlow } : {}),
        },
      });
    }

    const setupIntent = setupIntentId
      ? await stripe.setupIntents.retrieve(setupIntentId)
      : null;
    const clientSecret = setupIntent?.client_secret ?? null;

    if (!clientSecret) {
      return {
        ok: false,
        message: "Stripe did not return a payment setup secret.",
      };
    }

    if (prices.setupPriceId) {
      // Created after the trial subscription's initial invoice: charged once at trial end.
      await stripe.invoiceItems.create({customer:customer.id,subscription:subscription.id,pricing:{price:prices.setupPriceId},quantity:1,metadata:{cliste_subscription_id:subscription.id,cliste_launch_tier:input.launchTier}}, {idempotencyKey:`setup-fee-${subscription.id}`});
    }
    return {
      ok: true,
      clientSecret,
      subscriptionId: subscription.id,
      summary: {...checkoutSummary(input.planTier, input.interval, email), setupTier: input.launchTier === "remote" ? "remote" : input.launchTier === "diy" ? "diy" : "onsite_dublin", ...(prices.setupPriceId ? {setupLabel:`${LAUNCHES[input.launchTier].name} · ${formatEuro(LAUNCHES[input.launchTier].priceCents)} once, on your first invoice after the trial`} : {})},
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    console.error("[platform-billing-elements] checkout failed", err);
    return { ok: false, message };
  }
}

/**
 * Stripe can lag attaching default_payment_method after confirmSetup — apply the
 * succeeded SetupIntent's payment method when the subscription is still empty.
 */
export async function syncSubscriptionDefaultPaymentMethod(
  subscriptionId: string,
  setupIntentId?: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  let subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method", "pending_setup_intent"],
  });

  if (subscriptionDefaultPaymentMethodId(subscription)) {
    return subscription;
  }

  let setupIntent: Stripe.SetupIntent | null = null;
  const trimmedSetupIntentId = setupIntentId?.trim();

  if (trimmedSetupIntentId) {
    setupIntent = await stripe.setupIntents.retrieve(trimmedSetupIntentId);
  } else {
    const pending = subscription.pending_setup_intent;
    const pendingId =
      typeof pending === "string" ? pending : (pending?.id ?? null);
    if (pendingId) {
      setupIntent = await stripe.setupIntents.retrieve(pendingId);
    }
  }

  if (!setupIntent || setupIntent.status !== "succeeded") {
    return subscription;
  }

  assertSetupIntentMatchesSubscription(setupIntent, subscription, subscriptionId);

  const paymentMethodId = setupIntentPaymentMethodId(setupIntent);
  if (!paymentMethodId) return subscription;

  const customerId = subscriptionCustomerId(subscription);
  if (customerId) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  subscription = await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: paymentMethodId,
    expand: ["default_payment_method"],
  });

  return subscription;
}

/** After Elements confirmSetup — verify subscription is ready with a payment method. */
export async function assertElementsSubscriptionReady(
  subscriptionId: string,
  setupIntentId?: string,
): Promise<{ customerId: string | null; subscription: Stripe.Subscription }> {
  const attempts = setupIntentId?.trim() ? 3 : 5;
  let subscription: Stripe.Subscription | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    subscription = await syncSubscriptionDefaultPaymentMethod(
      subscriptionId,
      setupIntentId,
    );

    if (subscription.status !== "trialing" && subscription.status !== "active") {
      throw new Error("Subscription is not active yet. Please try again.");
    }

    if (subscriptionDefaultPaymentMethodId(subscription)) {
      return {
        customerId: subscriptionCustomerId(subscription),
        subscription,
      };
    }

    if (attempt < attempts - 1) {
      await sleep(300 * (attempt + 1));
    }
  }

  throw new Error("Payment method has not been confirmed yet.");
}

/** Persist Stripe customer + subscription ids after Elements checkout. */
export async function persistPlatformElementsSubscription(input: {
  organizationId: string;
  subscriptionId: string;
  accountId?: string;
  setupIntentId?: string;
}): Promise<{ customerId: string | null; signupFlow?: string }> {
  const trimmed = input.subscriptionId.trim();
  if (!trimmed) {
    throw new Error("Missing subscription.");
  }

  const accountId =
    input.accountId ??
    (await resolveAccountIdForOrganization(input.organizationId));
  if (!accountId) {
    throw new Error("Organisation is not linked to an account.");
  }

  // Authorize before syncing payment methods, which mutates Stripe records.
  const candidate = await getStripeClient().subscriptions.retrieve(trimmed);
  assertPlatformSubscriptionOwnership(candidate, { organizationId: input.organizationId, accountId });

  const { customerId, subscription } = await assertElementsSubscriptionReady(
    trimmed,
    input.setupIntentId,
  );
  assertPlatformSubscriptionOwnership(subscription, {
    organizationId: input.organizationId,
    accountId,
  });

  const billingPatch = {
    platform_subscription_id: trimmed,
    platform_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };
  await patchAccountAndLocations(accountId, billingPatch);

  return { customerId, signupFlow: subscription.metadata?.cliste_signup_flow };
}

export async function organizationNeedsElementsGoLive(
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("is_active, onboarding_step")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return false;
  const step = Number(org.onboarding_step ?? 0);
  return !org.is_active || step < ONBOARDING_STEPS.done;
}

/**
 * Webhook / redirect fallback — persist + activate when payment method is confirmed.
 * Returns true when go-live ran.
 */
export async function activateElementsOnboardingIfReady(input: {
  organizationId: string;
  subscriptionId: string;
  accountId?: string;
}): Promise<boolean> {
  const needsGoLive = await organizationNeedsElementsGoLive(
    input.organizationId,
  );
  if (!needsGoLive) return false;

  try {
    const billing = await persistPlatformElementsSubscription(input);
    await activatePlatformSubscriptionGoLive(input.organizationId, { dashboardOnly: billing.signupFlow === "simple_v1" });
    return true;
  } catch (err) {
    console.warn(
      "[platform-billing-elements] activateElementsOnboardingIfReady skipped",
      input.organizationId,
      err,
    );
    return false;
  }
}

export function isDevPreviewBillingMetadata(
  metadata: Stripe.Metadata | null | undefined,
): boolean {
  return metadata?.cliste_dev_preview === "true";
}
