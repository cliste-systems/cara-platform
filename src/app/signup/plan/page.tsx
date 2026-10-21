import { getMissingLegalAcceptances } from "@/lib/legal-acceptances";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { PlanPicker } from "@/app/(onboarding)/onboarding/plan/plan-picker";
import { PLANS, isPlanTier, PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";
import { requirePublicSignupSession } from "@/lib/public-signup-session";
import { startPublicCheckout } from "./actions";
export const dynamic = "force-dynamic";
export default async function SignupPlanPage() {
  const session = await requirePublicSignupSession();
  const {data:account,error} = await session.supabase.from("accounts").select("plan_tier, billing_interval, launch_tier, status, platform_subscription_id").eq("id",session.accountId).single();
  if(error || !account) throw new Error("Your business details could not be loaded.");
  if(account.status==="active" && account.platform_subscription_id) redirect("/dashboard");
  const missingLegal = await getMissingLegalAcceptances(createAdminClient(), {userId:session.user.id,organizationId:session.organizationId,needsDpa:true});
  if (missingLegal.length) redirect("/dashboard/legal-accept");
  const plans = Object.values(PLANS).filter(p=>p.selfServe).map(p=>({...p, recommended:Boolean(p.recommended)}));
  return <OnboardingStepShell variant="plan" compact title="Choose your plan" description={`${PLATFORM_TRIAL_DAYS} days free, then monthly billing. Card required. Cancel anytime.`}>
    <PlanPicker plans={plans} defaultPlan={isPlanTier(account.plan_tier) ? account.plan_tier : "pro"} defaultInterval={account.billing_interval==="year"?"year":"month"} checkoutAction={startPublicCheckout} configureAfterCheckout />
  </OnboardingStepShell>;
}
