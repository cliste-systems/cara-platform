import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { PLANS, PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";

import { PlanPicker } from "@/app/(onboarding)/onboarding/plan/plan-picker";

export const dynamic = "force-dynamic";

export default function DevOnboardingPlanPreviewPage() {
  const plans = Object.values(PLANS).map((p) => ({
    tier: p.tier,
    name: p.name,
    tagline: p.tagline,
    monthlyCents: p.monthlyCents,
    annualCents: p.annualCents,
    includedMinutes: p.includedMinutes,
    includedSms: p.includedSms,
    overageRateCents: p.overageRateCents,
    smsOverageRateCents: p.smsOverageRateCents,
    applicationFeeBps: p.applicationFeeBps,
    features: p.features,
    recommended: Boolean(p.recommended),
    selfServe: p.selfServe,
  }));

  return (
    <OnboardingStepShell
      variant="plan"
      compact
      title="Choose your plan"
      description={`${PLATFORM_TRIAL_DAYS} days free, then monthly billing. Card required. Cancel anytime.`}
    >
        <PlanPicker
        plans={plans.filter(p=>p.selfServe)}
        configureAfterCheckout
        defaultPlan="pro"
        defaultInterval="month"
        previewCheckoutPath="/dev/onboarding/plan/checkout"
      />
    </OnboardingStepShell>
  );
}
