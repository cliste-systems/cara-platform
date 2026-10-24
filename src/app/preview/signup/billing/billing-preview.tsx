"use client";
import {PLANS, LAUNCHES, type PlanTier} from "@/lib/cliste-plans.data";

import { SignupBillingCheckout, type SignupCheckoutData, type SetupChoice } from "@/components/billing/signup-billing-checkout";

const sampleCheckout: SignupCheckoutData = {
  clientSecret: "",
  subscriptionId: "local-visual-preview",
  returnUrl: "",
  summary: { planName: "Growth", amountLabel: "€199", intervalLabel: "month", trialDays: 7, email: "you@business.ie", setupTier: "diy" },
};

export function BillingSetupPreview({ planTier = "pro" }: { planTier?: PlanTier }) {
  const selectedPlan = PLANS[planTier];
  const checkout = { ...sampleCheckout, summary: { ...sampleCheckout.summary, planName: selectedPlan.name, amountLabel: `€${selectedPlan.monthlyCents / 100}` } };
  return <>
    <SignupBillingCheckout initialCheckout={checkout} preview setupPreviewOnly onSetupChange={async (choice: SetupChoice) => ({
      ok: true,
      ...checkout,
      summary: { ...checkout.summary, setupTier: choice, setupLabel:choice==="diy"?undefined:`${LAUNCHES[choice].name} · €${LAUNCHES[choice].priceCents/100} once, on your first invoice after the trial` },
    })} />
  </>;
}
