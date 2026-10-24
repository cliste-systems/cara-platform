import "server-only";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";
import { normaliseLaunchTierForDb, isLaunchTier, isPlanTier, PLANS } from "@/lib/cliste-plans";

export async function beginSignupBilling(accountId: string, organizationId: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc("begin_signup_billing", { p_account: accountId, p_org: organizationId });
  if (error || typeof data !== "number") throw new Error("Billing cannot start. Your account may need review, or may already have used its trial. Contact support if you need help.");
  return data;
}

export async function finalizeSignupBilling(accountId: string, organizationId: string, subscription: Stripe.Subscription) {
  const plan = subscription.metadata.cliste_plan_tier;
  const launch = subscription.metadata.cliste_launch_tier;
  if (!isPlanTier(plan) || !isLaunchTier(launch)) throw new Error("Invalid subscription offer.");
  const base = subscription.items.data.find(item => item.price.lookup_key === `cliste_plan_${plan}_monthly` || item.price.lookup_key === `cliste_plan_${plan}_annual`);
  const interval = base?.price.recurring?.interval;
  if (!base || !["month", "year"].includes(interval ?? "") || base.price.currency !== "eur" || base.price.unit_amount !== (interval === "year" ? PLANS[plan].annualCents : PLANS[plan].monthlyCents)) throw new Error("Subscription pricing could not be verified.");
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { error } = await createAdminClient().rpc("finalize_signup_billing", {
    p_account: accountId, p_org: organizationId, p_subscription: subscription.id,
    p_customer: customer, p_plan: plan, p_launch: normaliseLaunchTierForDb(launch), p_interval: interval,
  });
  if (error) {
    await cancelSupersededSignupSubscription(accountId, subscription);
    throw new Error("Your checkout could not be completed. Your account may already have billing set up or need review. Contact support for help.");
  }
  // Clear other abandoned checkout subscriptions before they can bill.
  for await (const candidate of getStripeClient().subscriptions.list({ customer, status: "all", limit: 100 })) {
    await cancelSupersededSignupSubscription(accountId, candidate);
  }
}

export async function selectSignupOffer(accountId:string, organizationId:string, plan:string, launch:string, interval:string) {
  if (!isLaunchTier(launch)) throw new Error("Invalid setup option.");
  const {error} = await createAdminClient().rpc("select_signup_offer", {p_account:accountId,p_org:organizationId,p_plan:plan,p_launch:normaliseLaunchTierForDb(launch),p_interval:interval});
  if(error) throw new Error("Your plan could not be changed. Your account may need review or already have billing set up.");
}

/** A completed billing claim is immutable: only a different subscription may be cancelled. */
export async function cancelSupersededSignupSubscription(accountId: string, subscription: Stripe.Subscription): Promise<boolean> {
  if (subscription.metadata.cliste_signup_flow !== "simple_v1" || subscription.metadata.cliste_account_id !== accountId) return false;
  const { data, error } = await createAdminClient().from("signup_billing_eligibility")
    .select("completed_subscription_id").eq("account_id", accountId).maybeSingle();
  if (error) throw error;
  if (!data?.completed_subscription_id || data.completed_subscription_id === subscription.id) return false;
  if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
    await getStripeClient().subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
  }
  return true;
}
