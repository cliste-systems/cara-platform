"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";

import { SignupCheckoutWelcome } from "./signup-checkout-welcome";
import { ClisteCheckoutSuccess } from "@/components/billing/cliste-checkout-success";
import { CheckoutPlanSummary, ClisteStripeCheckoutForm } from "@/components/billing/cliste-stripe-checkout-form";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import { PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans.data";
import type { PlatformElementsCheckoutSummary } from "@/lib/platform-billing-elements";

type Props = {
  initialPaymentStep?: boolean;
  setupControl?: ReactNode;
  setupBusy?: boolean;
  clientSecret: string;
  subscriptionId: string;
  summary: PlatformElementsCheckoutSummary;
  returnUrl: string;
  continueHref: string;
  continueLabel?: string;
  configureAfterCheckout?: boolean;
  onPersist?: (subscriptionId: string, setupIntentId?: string) => Promise<void>;
};

export function PlanCheckoutFlow(props: Props) {
  return (
    <Suspense fallback={<PlanCheckoutFlowFallback />}>
      <PlanCheckoutFlowInner {...props} />
    </Suspense>
  );
}

function PlanCheckoutFlowFallback() {
  return (
    <OnboardingStepShell
      variant="checkout"
      centered
      title="Set up billing"
      description={`${PLATFORM_TRIAL_DAYS}-day free trial, then your selected plan renews. Cancel anytime.`}
    >
      <div className="h-[28rem] w-full" aria-hidden />
    </OnboardingStepShell>
  );
}

function PlanCheckoutFlowInner({
  clientSecret,
  subscriptionId,
  summary,
  returnUrl,
  continueHref,
  continueLabel,
  configureAfterCheckout,
  onPersist,
  setupControl,
  setupBusy,
  initialPaymentStep = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activated, setActivated] = useState(
    () => !configureAfterCheckout && searchParams.get("complete") === "1",
  );
  const reduceMotion = useReducedMotion();
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [openingSetup, setOpeningSetup] = useState(false);
  const [paymentStep, setPaymentStep] = useState(initialPaymentStep);
  const choosingSetup = Boolean(setupControl) && !paymentStep && !activated;

  function handleActivated() {
    if (configureAfterCheckout) {
      setOpeningSetup(true);
      router.prefetch(continueHref);
      router.replace(continueHref);
      return;
    }
    setActivated(true);
    router.replace(`${pathname}?complete=1`, { scroll: false });
  }

  if (activated && setupControl) return <SignupCheckoutWelcome continueHref={continueHref} />;

  return (
    <OnboardingStepShell
      variant="checkout"
      centered
      contentOnly={activated}
      hideLogo={activated}
      backAction={setupControl && paymentStep ? () => setPaymentStep(false) : undefined}
      backDisabled={paymentBusy || openingSetup}
      signupScene={choosingSetup ? "setup" : "billing"}
      title={activated ? undefined : choosingSetup ? "Choose your setup" : "Set up billing"}
      description={
        activated
          ? undefined
          : choosingSetup ? "Set up Cara yourself, or get a hand from our engineer." : `${PLATFORM_TRIAL_DAYS}-day free trial, then your selected plan renews. Cancel anytime.`
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {choosingSetup ? <motion.div key="setup-choice" className="w-full space-y-4" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <CheckoutPlanSummary summary={summary} setupControl={setupControl} />
          <button type="button" disabled={setupBusy} onClick={() => setPaymentStep(true)} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0b1220] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#182233] disabled:cursor-wait disabled:opacity-60">Continue to payment <span aria-hidden="true">→</span></button>
        </motion.div> : !activated ? (
          <motion.div
            key="checkout-form"
            className="w-full"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: -10, transition: { duration: 0.28, ease: ONBOARDING_EASE } }
            }
          >
            <ClisteStripeCheckoutForm
              openingSetup={openingSetup}
              paymentOnly={Boolean(setupControl)}
              onBusyChange={setPaymentBusy}
              setupBusy={setupBusy}
              clientSecret={clientSecret}
              subscriptionId={subscriptionId}
              summary={summary}
              returnUrl={returnUrl}
              onPersist={onPersist}
              onActivated={handleActivated}
            />
          </motion.div>
        ) : (
          <motion.div
            key="checkout-success"
            className="w-full"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: ONBOARDING_EASE }}
          >
            <ClisteCheckoutSuccess
              trialDays={summary.trialDays}
              continueHref={continueHref}
              continueLabel={continueLabel}
              description={configureAfterCheckout ? "Your workspace is ready. Set up Cara in your dashboard before going live." : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </OnboardingStepShell>
  );
}
