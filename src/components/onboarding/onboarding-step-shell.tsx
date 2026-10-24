"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { SignupBrandFrame } from "./signup-brand-frame";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import {
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_SHELL_LOGO_GAP,
  ONBOARDING_SHELL_SECTION_GAP,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

import { OnboardingEnter, OnboardingEnterProvider } from "./onboarding-enter";
import { OnboardingStepHeader } from "./onboarding-step-header";

export type OnboardingStepShellVariant =
  | "default"
  | "wide"
  | "plan"
  | "training"
  | "profile"
  | "checkout";

const VARIANT_MAX_WIDTH: Record<OnboardingStepShellVariant, string> = {
  default: "max-w-lg",
  wide: "max-w-6xl",
  plan: "max-w-6xl",
  training: "max-w-[720px]",
  profile: "max-w-lg lg:max-w-xl",
  checkout: "max-w-xl",
};

type Props = {
  backAction?: () => void;
  backDisabled?: boolean;
  signupScene?: keyof typeof PUBLIC_ASSETS.signupScenes;
  title?: string;
  /** First name only — rendered as “Hey {name}, {title}”. */
  firstName?: string;
  description?: string;
  children: ReactNode;
  variant?: OnboardingStepShellVariant;
  /** Skip the shell header block; children supply per-step titles (Train Cara). */
  contentOnly?: boolean;
  /** Tighter vertical rhythm for dense steps (plan picker). */
  compact?: boolean;
  /** Vertically center the step in the viewport (checkout). */
  centered?: boolean;
  /** Hide the logo mark (success screens that bring their own icon). */
  hideLogo?: boolean;
};

export function OnboardingStepShell({
  title,
  firstName,
  description,
  children,
  variant = "default",
  contentOnly = false,
  compact = false,
  centered = false,
  hideLogo = false,
  signupScene,
  backAction,
  backDisabled,
}: Props) {
  const pathname = usePathname();
  const showHeader = !contentOnly && Boolean(title?.trim());
  const isProfile = variant === "profile";
  const isCheckout = variant === "checkout" || centered;
  const enterTone = isProfile ? "profile" : "default";
  const isKnowledge = pathname === "/onboarding/knowledge";
  const isPlan = variant === "plan";
  const showShellLogo = !isKnowledge && !hideLogo;
  const signupPath = pathname
    .replace(/^\/dev\/onboarding/, "/signup")
    .replace(/^\/preview\/signup\/billing$/, "/signup/plan/checkout")
    .replace(/^\/preview\/signup\/[^/]+\/checkout$/, "/signup/plan/checkout")
    .replace(/^\/preview\/signup\/[^/]+\/plan$/, "/signup/plan");
  const signupStage = signupPath === "/signup/voice" ? "voice" : signupPath.startsWith("/signup/plan/checkout") ? (signupScene === "setup" ? "setup" : "billing") : signupPath === "/signup/plan" ? "plans" : null;
  if (signupStage) return <SignupBrandFrame backAction={backAction} backDisabled={backDisabled} scene={signupScene} stage={signupStage} title={contentOnly ? undefined : title} description={contentOnly ? undefined : description}>{children}</SignupBrandFrame>;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <OnboardingEnterProvider>
        <div
          className={cn(
            "min-h-0 flex-1",
            isKnowledge && contentOnly
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
              : "overflow-y-auto overscroll-y-contain",
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center px-4 sm:px-6",
              isCheckout
                ? "min-h-full justify-center py-5 sm:py-6"
                : isPlan
                  ? "pb-5 pt-8 sm:pb-6 sm:pt-10"
                  : isKnowledge && contentOnly
                    ? "flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 pb-3 pt-3 sm:px-6 sm:pt-4"
                    : compact
                      ? "pb-4 pt-3 sm:pb-5 sm:pt-4"
                      : "min-h-full py-6 sm:py-8",
            )}
          >
            <div
              className={cn(
                "mx-auto flex w-full flex-col items-center",
                isKnowledge && contentOnly
                  ? "shrink-0"
                  : !compact && !isPlan && !isCheckout && "my-auto",
                VARIANT_MAX_WIDTH[variant],
                isKnowledge && contentOnly && "max-w-none",
                isPlan
                  ? "gap-4 sm:gap-5"
                  : isCheckout
                    ? "gap-4"
                    : compact
                      ? "gap-2.5 sm:gap-3"
                      : ONBOARDING_SHELL_SECTION_GAP,
              )}
            >
              <div
                className={cn(
                  "flex w-full shrink-0 flex-col items-center",
                  showHeader
                    ? compact
                      ? "gap-2"
                      : isPlan
                        ? "gap-4"
                        : ONBOARDING_SHELL_LOGO_GAP
                    : "gap-0",
                )}
              >
                {showShellLogo ? (
                  <OnboardingEnter
                    key={pathname}
                    tone={enterTone}
                    className="flex justify-center"
                  >
                    <ClisteLogoMark
                      size={ONBOARDING_LOGO_SIZE}
                      priority
                      className="mx-auto"
                    />
                  </OnboardingEnter>
                ) : null}

                {showHeader ? (
                  <OnboardingEnter tone={enterTone} className="w-full">
                    <OnboardingStepHeader
                      firstName={firstName}
                      title={title!}
                      subtitle={description}
                      subtitleClassName={
                        isPlan || isCheckout ? "max-w-xl mx-auto" : undefined
                      }
                    />
                  </OnboardingEnter>
                ) : null}
              </div>

              <div
                className={cn(
                  "flex w-full flex-col items-center",
                  isKnowledge && contentOnly ? "shrink-0" : "shrink-0 items-stretch",
                )}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </OnboardingEnterProvider>
    </div>
  );
}
