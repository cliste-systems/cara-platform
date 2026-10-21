"use client";

import { useState } from "react";

import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import type { BillingInterval, PlanTier } from "@/lib/cliste-plans.data";
import { PLANS } from "@/lib/cliste-plans.data";
import { planIntentLabel } from "@/lib/signup-plan-intent";

import { SignupForm } from "./signup-form";
import { SignupSignInLink } from "./signup-sign-in-link";

type Props = {
  planTier: PlanTier | null;
  billingInterval: BillingInterval;
  skipTurnstile: boolean;
};

export function SignupFlow({ planTier, billingInterval, skipTurnstile }: Props) {
  const [panelExiting, setPanelExiting] = useState(false);
  const selectedPlan =
    planTier && PLANS[planTier] ? PLANS[planTier] : null;

  return (
    <AuthMarketingShell
      title="Create your account"
      subtitle="A few details to get started."
      pageBackground={PUBLIC_ASSETS.signupScenes.signup}
      compact
      contentExiting={panelExiting}
    >
      <SignupForm
        planTier={planTier}
        billingInterval={billingInterval}
        selectedPlanName={
          selectedPlan ? planIntentLabel(selectedPlan.tier) : null
        }
        selectedPlanPriceCents={
          selectedPlan
            ? billingInterval === "year"
              ? selectedPlan.annualCents
              : selectedPlan.monthlyCents
            : null
        }
        billingIntervalLabel={
          billingInterval === "year" ? "annual" : "monthly"
        }
        skipTurnstile={skipTurnstile}
        onTransitionStart={() => setPanelExiting(true)}
      />
      <SignupSignInLink />
    </AuthMarketingShell>
  );
}
