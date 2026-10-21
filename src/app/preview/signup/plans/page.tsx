import { notFound } from "next/navigation";
import { PlanPicker } from "@/app/(onboarding)/onboarding/plan/plan-picker";
import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";
import { PLANS, PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";

export const dynamic = "force-dynamic";

async function previewCheckout() {
  "use server";
  return { ok: false as const, message: "Local preview — no checkout or subscription is created." };
}

/** Real plan controls for local design review, without account or billing writes. */
export default function LocalSignupPlansPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const plans = Object.values(PLANS).filter((plan) => plan.selfServe).map((plan) => ({ ...plan, recommended: Boolean(plan.recommended) }));

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SignupBrandFrame stage="plans" title="Choose your plan" description={`${PLATFORM_TRIAL_DAYS} days free, then monthly billing. Card required. Cancel anytime.`}>
        <PlanPicker plans={plans} defaultPlan="pro" defaultInterval="month" checkoutAction={previewCheckout} configureAfterCheckout />
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">Local preview · Compare and select plans · No checkout or subscription is created</p>
      </SignupBrandFrame>
    </main>
  );
}
