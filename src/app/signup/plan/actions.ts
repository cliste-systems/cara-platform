"use server";

import { redirect } from "next/navigation";
import { isPlanTier, planSupportsSelfServeCheckout } from "@/lib/cliste-plans";
import { persistOrgBillingSelection, persistPlatformCheckoutSession, activatePlatformSubscriptionGoLive, resolveCheckoutReturnOrigin } from "@/lib/platform-billing-checkout";
import { createPlatformElementsCheckout, persistPlatformElementsSubscription } from "@/lib/platform-billing-elements";
import { PUBLIC_SIGNUP_FLOW } from "@/lib/public-signup-flow";
import { requirePublicSignupSession } from "@/lib/public-signup-session";
import { getMissingLegalAcceptances } from "@/lib/legal-acceptances";
import { createAdminClient } from "@/utils/supabase/admin";
import { getStripeClient } from "@/lib/stripe";

export async function startPublicCheckout(_: unknown, form: FormData): Promise<{ok:false;message:string}> {
  const session = await requirePublicSignupSession();
  const plan = String(form.get("planTier") ?? "");
  if (!isPlanTier(plan) || !planSupportsSelfServeCheckout(plan)) return {ok:false,message:"Choose an available plan."};
  const interval = "month";
  const launchTier = form.get("launchTier") === "remote" ? "remote" : form.get("launchTier") === "onsite_dublin" ? "onsite_dublin" : "diy";
  const admin = createAdminClient();
  const missing = await getMissingLegalAcceptances(admin, {userId:session.user.id,organizationId:session.organizationId,needsDpa:true});
  if (missing.length) redirect("/dashboard/legal-accept");
  const { data: account, error } = await admin.from("accounts").select("name, status, platform_subscription_id").eq("id", session.accountId).single();
  if (error || !account) return {ok:false,message:"Your business could not be loaded. Please try again."};
  if (account.status === "active" && account.platform_subscription_id) redirect("/dashboard");
  try {
    await persistOrgBillingSelection({organizationId:session.organizationId,planTier:plan,launchTier,interval});
  } catch {
    return {ok:false,message:"Your plan could not be saved. Please try again."};
  }
  redirect("/signup/plan/checkout");
}

export async function preparePublicCheckout() {
  const session = await requirePublicSignupSession();
  const admin=createAdminClient();
  const missing=await getMissingLegalAcceptances(admin,{userId:session.user.id,organizationId:session.organizationId,needsDpa:true});
  if(missing.length) redirect("/signup/plan");
  const {data:account,error}=await admin.from("accounts").select("plan_tier,billing_interval,launch_tier,status,platform_subscription_id").eq("id",session.accountId).single();
  if(error || !account) throw new Error("Your billing details could not be loaded.");
  if(account.status==="active" && account.platform_subscription_id) redirect("/dashboard");
  if(!isPlanTier(account.plan_tier) || !planSupportsSelfServeCheckout(account.plan_tier)) redirect("/signup/plan");
  const launchTier = account.launch_tier === "remote" ? "remote" : account.launch_tier === "onsite" ? "onsite_dublin" : "diy";
  const result=await createPlatformElementsCheckout({organizationId:session.organizationId,accountId:session.accountId,userEmail:session.user.email??"",planTier:account.plan_tier,launchTier,interval:account.billing_interval==="year"?"year":"month",signupFlow:PUBLIC_SIGNUP_FLOW,idempotencyKey:`signup-elements-${session.accountId}-${account.plan_tier}-${account.billing_interval}-${launchTier}-${Math.floor(Date.now()/86400000)}`});
  if(!result.ok) return {ok:false as const,message:"Payment setup is temporarily unavailable. Please try again."};
  const origin=await resolveCheckoutReturnOrigin();
  return {...result,returnUrl:`${origin}/signup/complete?subscription_id=${result.subscriptionId}`};
}

export async function persistPublicCheckout(subscriptionId: string, setupIntentId?: string) {
  const session=await requirePublicSignupSession();
  const subscription=await getStripeClient().subscriptions.retrieve(subscriptionId);
  if(subscription.metadata.cliste_signup_flow!==PUBLIC_SIGNUP_FLOW || subscription.metadata.cliste_account_id!==session.accountId || subscription.metadata.cliste_organization_id!==session.organizationId) throw new Error("Payment setup does not belong to this account.");
  const {data:account,error}=await session.supabase.from("accounts").select("status,platform_subscription_id").eq("id",session.accountId).single();
  if(error || !account) throw new Error("Your billing account could not be checked. Please try again.");
  if(account.status === "active" && account.platform_subscription_id && account.platform_subscription_id !== subscriptionId) throw new Error("Your account already has an active subscription. Manage your plan in Settings.");
  await persistPlatformElementsSubscription({organizationId:session.organizationId,accountId:session.accountId,subscriptionId,setupIntentId});
  await activatePlatformSubscriptionGoLive(session.organizationId,{dashboardOnly:true});
}

// Retain support for test checkout links issued before the original embedded UI was restored.
export async function completePublicCheckout(checkoutId: string) {
  const session = await requirePublicSignupSession();
  if (!/^cs_[a-zA-Z0-9_]+$/.test(checkoutId)) throw new Error("Invalid checkout session.");
  const checkout = await getStripeClient().checkout.sessions.retrieve(checkoutId);
  if (checkout.metadata?.cliste_signup_flow !== PUBLIC_SIGNUP_FLOW || checkout.metadata?.cliste_organization_id !== session.organizationId || checkout.metadata?.cliste_account_id !== session.accountId) throw new Error("Checkout does not belong to this account.");
  await persistPlatformCheckoutSession(session.organizationId, checkout.id);
  await activatePlatformSubscriptionGoLive(session.organizationId, { dashboardOnly: true });
}

export async function updatePublicCheckoutSetup(choice: string) {
  const session = await requirePublicSignupSession();
  if (!["diy", "remote", "onsite_dublin"].includes(choice)) return {ok:false as const,message:"Choose an available setup option."};
  const {data:account,error} = await session.supabase.from("accounts").select("plan_tier,billing_interval,status,platform_subscription_id").eq("id",session.accountId).single();
  if (error || !account || !isPlanTier(account.plan_tier)) return {ok:false as const,message:"Your billing details could not be loaded."};
  if (account.status === "active" && account.platform_subscription_id) redirect("/dashboard");
  await persistOrgBillingSelection({organizationId:session.organizationId,planTier:account.plan_tier,launchTier:choice as "diy"|"remote"|"onsite_dublin",interval:account.billing_interval === "year" ? "year" : "month"});
  return preparePublicCheckout();
}
