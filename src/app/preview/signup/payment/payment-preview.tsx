"use client";
import { checkoutFeedback } from "@/lib/checkout-feedback";
import { LAUNCHES } from "@/lib/cliste-plans.data";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutFormInner } from "@/components/billing/cliste-stripe-checkout-form";
import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";
import { CLISTE_STRIPE_APPEARANCE, CLISTE_STRIPE_FONTS } from "@/lib/stripe-elements-theme";
import { getStripeJs } from "@/lib/stripe-publishable";

/** Real Payment Element in deferred setup mode: no intent, customer or subscription. */
export function PaymentPreview({setupTier="diy",cardDeclined=false}:{cardDeclined?:boolean;setupTier?:"diy"|"remote"|"onsite_dublin"}) {
  const setup = LAUNCHES[setupTier];
  const setupLabel = setup.priceCents ? `${setup.name} · ${new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(setup.priceCents/100)} once, on your first invoice after the trial` : undefined;
  return <main className="flex min-h-dvh flex-col bg-white">
    <SignupBrandFrame stage="billing" title="Set up billing" description="Add your payment details to start your 7-day free trial.">
      <Elements stripe={getStripeJs()} options={{ mode: "setup", currency: "eur", appearance: CLISTE_STRIPE_APPEARANCE, fonts: CLISTE_STRIPE_FONTS }}>
        <CheckoutFormInner initialFeedback={cardDeclined ? checkoutFeedback("confirmation", {code:"card_declined"}) : undefined} subscriptionId="" returnUrl="" summary={{ planName: "Growth", amountLabel: "€199", intervalLabel: "month", trialDays: 7, email: "you@business.ie", setupTier, setupLabel }} paymentOnly setupBusy onActivated={() => {}} />
      </Elements>
    </SignupBrandFrame>
  </main>;
}
