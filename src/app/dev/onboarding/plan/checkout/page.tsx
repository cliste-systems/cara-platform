import { SignupCheckoutWelcome } from "@/components/billing/signup-checkout-welcome";
import { SignupBillingCheckout } from "@/components/billing/signup-billing-checkout";
import { updateDevCheckoutSetup } from "./actions";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { prepareDevElementsCheckoutPreview } from "@/lib/dev-stripe-checkout-preview";
import { PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";
import { stripePublishableConfigured } from "@/lib/stripe-publishable";

export const dynamic = "force-dynamic";

export default async function DevOnboardingPlanCheckoutPreviewPage({searchParams}: {searchParams:Promise<{plan?:string;setup?:string;step?:string;complete?:string}>}) {
  const selection = await searchParams;
  if (selection.complete === "1") return <SignupCheckoutWelcome continueHref="/dashboard?welcome=1" />;

  if (!stripePublishableConfigured()) {
    return (
      <OnboardingStepShell
        variant="wide"
        title="Set up billing"
        description={`Add a payment method to start your ${PLATFORM_TRIAL_DAYS}-day free trial.`}
      >
        <CheckoutNotice message="Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local to load Stripe Elements." />
      </OnboardingStepShell>
    );
  }

  const result = await prepareDevElementsCheckoutPreview(selection);

  if (!result.ok) {
    return (
      <OnboardingStepShell
        variant="wide"
        title="Set up billing"
        description={`${PLATFORM_TRIAL_DAYS}-day free trial, then your plan renews monthly. Cancel anytime.`}
      >
        <CheckoutError message={result.message} />
      </OnboardingStepShell>
    );
  }

  return (
    <SignupBillingCheckout key={selection.step ?? "setup"} initialPaymentStep={selection.step === "payment"} initialCheckout={result} onSetupChange={updateDevCheckoutSetup.bind(null, selection.plan ?? "pro")} preview />
  );
}

function CheckoutNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {message}
    </div>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}
