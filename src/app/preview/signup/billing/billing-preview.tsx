"use client";
import {LAUNCHES} from "@/lib/cliste-plans.data";

import { SignupBillingCheckout, type SignupCheckoutData, type SetupChoice } from "@/components/billing/signup-billing-checkout";

const sampleCheckout: SignupCheckoutData = {
  clientSecret: "",
  subscriptionId: "local-visual-preview",
  returnUrl: "",
  summary: { planName: "Growth", amountLabel: "€199", intervalLabel: "month", trialDays: 7, email: "you@business.ie", setupTier: "diy" },
};

export function BillingSetupPreview() {
  return <>
    <SignupBillingCheckout initialCheckout={sampleCheckout} preview setupPreviewOnly onSetupChange={async (choice: SetupChoice) => ({
      ok: true,
      ...sampleCheckout,
      summary: { ...sampleCheckout.summary, setupTier: choice, setupLabel:choice==="diy"?undefined:`${LAUNCHES[choice].name} · €${LAUNCHES[choice].priceCents/100} once, on your first invoice after the trial` },
    })} />
    <p className="fixed inset-x-4 bottom-2 pointer-events-none text-center text-[11px] text-slate-500">Local preview · Sample plan and email · Setup choices work; payment is disabled</p>
  </>;
}
