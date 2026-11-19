"use server";

import { revalidatePath } from "next/cache";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { CLISTE_COMPANY } from "@/lib/company-details";
import { planSupportsSelfServeCheckout } from "@/lib/cliste-plans";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import {
  createPlatformSubscriptionCheckout,
  parseOrgBillingSelection,
  persistPlatformCheckoutSession,
  resolveCheckoutReturnOrigin,
} from "@/lib/platform-billing-checkout";
import { getStripeClient, stripeIsConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export type BillingPortalResult =
  | { ok: true; url: string }
  | { ok: false; message: string; connectionPending?:boolean };

export type EmbeddedBillingCheckoutResult =
  | { ok: true; clientSecret: string }
  | { ok: false; message: string };

/**
 * Embedded Stripe Checkout (in-app) for dashboard orgs without a subscription.
 */
export async function prepareEmbeddedBillingCheckout(): Promise<EmbeddedBillingCheckoutResult> {
  if (!stripeIsConfigured()) {
    return {
      ok: false,
      message: "Billing is not configured for this environment.",
    };
  }

  const { supabase, organizationId, user } = await requireDashboardAdmin();

  const { data: org } = await supabase
    .from("organizations")
    .select("plan_tier, launch_tier, billing_interval, platform_subscription_id")
    .eq("id", organizationId)
    .maybeSingle<{
      plan_tier: string | null;
      launch_tier: string | null;
      billing_interval: string | null;
      platform_subscription_id: string | null;
    }>();

  if (org?.platform_subscription_id?.trim()) {
    return {
      ok: false,
      message: "You already have billing set up. Use Manage billing on the Usage page.",
    };
  }

  const { planTier, launchTier, interval } = parseOrgBillingSelection(
    org ?? { plan_tier: null, launch_tier: null, billing_interval: null },
  );

  if (!planSupportsSelfServeCheckout(planTier)) {
    return {
      ok: false,
      message:
        `Custom plans are arranged with our team. Email ${CLISTE_COMPANY.helloEmail} to update billing.`,
    };
  }

  const origin = await resolveCheckoutReturnOrigin();
  const result = await createPlatformSubscriptionCheckout({
    organizationId,
    userEmail: user.email ?? undefined,
    planTier,
    launchTier,
    interval,
    checkoutMode: "embedded",
    returnUrl: `${origin}/dashboard/usage?status=return&session_id={CHECKOUT_SESSION_ID}`,
    idempotencyKey: `dashboard-checkout-embedded-${organizationId}-${planTier}-${interval}`,
  });

  if (!result.ok) return result;
  if (result.mode !== "embedded") {
    return { ok: false, message: "Expected embedded Checkout session." };
  }
  return { ok: true, clientSecret: result.clientSecret };
}

export async function finaliseBillingCheckout(
  checkoutSessionId: string,
): Promise<void> {
  const { organizationId } = await requireDashboardAdmin();
  await persistPlatformCheckoutSession(organizationId, checkoutSessionId);
  revalidatePath("/dashboard/usage");
  revalidatePath("/dashboard/billing");
}

/**
 * Mints a Stripe Billing Portal session so operators can update their
 * payment method, invoices, and subscription without leaving Cliste.
 */
export async function openBillingPortal(paymentDetailsOnly=false): Promise<BillingPortalResult> {
  if (!stripeIsConfigured()) {
    return {
      ok: false,
      message: "Billing is not configured for this environment.",
    };
  }

  const { supabase, organizationId,accountId } = await requireDashboardAdmin();

  const { data: org } = await supabase
    .from("organizations")
    .select("platform_customer_id, platform_subscription_id")
    .eq("id", organizationId)
    .maybeSingle<{
      platform_customer_id: string | null;
      platform_subscription_id: string | null;
    }>();

  const customerId = await resolvePlatformCustomerId(
    organizationId,
    org?.platform_customer_id ?? null,
    org?.platform_subscription_id ?? null,
  );

  if (!customerId) {
    return {
      ok: false,
      message:
        "No billing account found yet. Choose a plan or contact support if you already subscribed.",
    };
  }

  const stripe = getStripeClient();
  const returnBase = resolveAppSiteOrigin().origin;

  try {
    const {data:billingAccount}=await supabase.from('accounts').select('platform_subscription_id').eq('id',accountId).single();
    const subscriptionId=billingAccount?.platform_subscription_id??org?.platform_subscription_id;
    const subscription=subscriptionId?await stripe.subscriptions.retrieve(subscriptionId):null;
    const pendingConnection=subscription?.metadata.cliste_trial_activation==='forwarded_call'&&!subscription.metadata.cliste_connection_verified_at;
    if(pendingConnection&&!paymentDetailsOnly)return {ok:false,connectionPending:true,message:'Your trial is waiting for your phone connection. You can update your payment method or cancel setup here.'};
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${returnBase}/dashboard/usage`,
      ...(pendingConnection?{flow_data:{type:'payment_method_update' as const,after_completion:{type:'redirect' as const,redirect:{return_url:`${returnBase}/dashboard/usage`}}}}:{}),
    });
    if (!session.url) {
      return { ok: false, message: "Stripe did not return a billing portal URL." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not open the billing portal.";
    console.error("[billing] portal session failed", err);
    return { ok: false, message };
  }
}

async function resolvePlatformCustomerId(
  organizationId: string,
  existingCustomerId: string | null,
  subscriptionId: string | null,
): Promise<string | null> {
  const trimmedCustomer = existingCustomerId?.trim();
  if (trimmedCustomer) return trimmedCustomer;

  const trimmedSub = subscriptionId?.trim();
  if (!trimmedSub) return null;

  const stripe = getStripeClient();
  let customerId: string | null = null;

  try {
    const sub = await stripe.subscriptions.retrieve(trimmedSub);
    customerId =
      typeof sub.customer === "string"
        ? sub.customer
        : (sub.customer?.id ?? null);
  } catch (err) {
    console.error("[billing] subscription retrieve failed", trimmedSub, err);
    return null;
  }

  if (!customerId) return null;

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      platform_customer_id: customerId,
      platform_subscription_id: trimmedSub,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  return customerId;
}

/** Cancellation remains available while the ordinary subscription portal is withheld. */
export async function cancelPendingConnectionSetup():Promise<{ok:boolean;message:string}>{
 const {supabase,accountId,organizationId}=await requireDashboardAdmin();
 const {data:account}=await supabase.from('accounts').select('platform_subscription_id').eq('id',accountId).single();
 if(!account?.platform_subscription_id)return {ok:false,message:'No subscription was found.'};
 const stripe=getStripeClient(),sub=await stripe.subscriptions.retrieve(account.platform_subscription_id);
 if(sub.metadata.cliste_account_id!==accountId||sub.metadata.cliste_organization_id!==organizationId||sub.metadata.cliste_trial_activation!=='forwarded_call'||sub.metadata.cliste_connection_verified_at)return {ok:false,message:'Your billing state changed. Refresh before continuing.'};
 if(sub.status!=='canceled')await stripe.subscriptions.cancel(sub.id,{invoice_now:false,prorate:false});
 revalidatePath('/dashboard');return {ok:true,message:'Setup cancelled. Your trial will not start.'};
}
