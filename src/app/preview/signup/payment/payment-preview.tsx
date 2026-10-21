"use client";
import { LAUNCHES } from "@/lib/cliste-plans.data";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutFormInner } from "@/components/billing/cliste-stripe-checkout-form";
import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";
import { CLISTE_STRIPE_APPEARANCE, CLISTE_STRIPE_FONTS } from "@/lib/stripe-elements-theme";
import { getStripeJs } from "@/lib/stripe-publishable";

/** Real Payment Element in deferred setup mode: no intent, customer or subscription. */
export function PaymentPreview({setupTier="diy"}:{setupTier?:"diy"|"remote"|"onsite_dublin"}) {
  const setup = LAUNCHES[setupTier];
  const setupLabel = setup.priceCents ? `${setup.name} · ${new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(setup.priceCents/100)} once, on your first invoice after the trial` : undefined;
  return <main className="flex min-h-dvh flex-col bg-white">
    <SignupBrandFrame stage="billing" title="Set up billing" description="7-day free trial, then your selected plan renews. Cancel anytime.">
      <Elements stripe={getStripeJs()} options={{ mode: "setup", currency: "eur", appearance: CLISTE_STRIPE_APPEARANCE, fonts: CLISTE_STRIPE_FONTS }}>
        <CheckoutFormInner subscriptionId="" returnUrl="" summary={{ planName: "Growth", amountLabel: "€199", intervalLabel: "month", trialDays: 7, email: "you@business.ie", setupTier, setupLabel }} paymentOnly setupBusy onActivated={() => {}} />
      </Elements>
      <p className="mt-3 text-center text-[11px] leading-4 text-slate-500">Stripe test preview · Use test card details only · Submission is disabled</p>
    </SignupBrandFrame>
  </main>;
}
