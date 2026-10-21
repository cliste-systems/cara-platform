"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import {
  ONBOARDING_HEADLINE,
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_PRIMARY_BUTTON,
  ONBOARDING_PRIMARY_BUTTON_SHIMMER,
  ONBOARDING_SELECTION_CARD,
  ONBOARDING_SUBHEADLINE,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

type Props = {
  trialDays: number;
  continueHref: string;
  continueLabel?: string;
  className?: string;
  description?: string;
};

export function ClisteCheckoutSuccess({
  trialDays,
  continueHref,
  continueLabel = "Continue to dashboard",
  className,
  description,
}: Props) {
  return (
    <OnboardingEnter tone="profile" className={cn("w-full", className)}>
      <div
        className={cn(
          ONBOARDING_SELECTION_CARD,
          "overflow-hidden px-6 py-7 sm:px-8 sm:py-8",
        )}
      >
        <div className="flex flex-col items-center text-center">
          <OnboardingEnter tone="profile" className="flex justify-center">
            <ClisteLogoMark size={ONBOARDING_LOGO_SIZE} priority />
          </OnboardingEnter>

          <OnboardingEnter tone="profile" className="w-full">
            <h2 className={cn(ONBOARDING_HEADLINE, "mt-5")}>Thank you</h2>
          </OnboardingEnter>

          <OnboardingEnter tone="profile" className="w-full">
            <p className="mt-2 text-[14px] font-medium leading-snug text-[#0b1220]">
              Your {trialDays}-day trial has started.
            </p>
          </OnboardingEnter>

          <OnboardingEnter tone="profile" className="w-full">
            <p className={cn(ONBOARDING_SUBHEADLINE, "mt-2 max-w-md")}>
              {description ?? "You’re set. Cara takes it from here."}
            </p>
          </OnboardingEnter>
        </div>

        <OnboardingEnter tone="profile" className="w-full">
          <Link
            href={continueHref}
            className={cn(
              ONBOARDING_PRIMARY_BUTTON,
              "mt-8 h-12 w-full px-6 text-[15px]",
            )}
          >
            <span aria-hidden className={ONBOARDING_PRIMARY_BUTTON_SHIMMER} />
            <span className="relative z-[1] inline-flex items-center justify-center gap-2">
              {continueLabel}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </Link>
        </OnboardingEnter>
      </div>
    </OnboardingEnter>
  );
}
