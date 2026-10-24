"use client";

import { Check, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { ONBOARDING_PRIMARY_BUTTON } from "@/components/onboarding/onboarding-ui";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

export type CheckoutSubmitPhase = "idle" | "loading" | "success";

type Props = {
  phase: CheckoutSubmitPhase;
  idleLabel?: string;
  loadingLabel?: string;
  trialDays: number;
  disabled?: boolean;
  className?: string;
};

export function ClisteCheckoutSubmitButton({
  phase,
  trialDays,
  idleLabel,
  loadingLabel,
  disabled = false,
  className,
}: Props) {
  const reduceMotion = useReducedMotion();
  const isSuccess = phase === "success";
  const isLoading = phase === "loading";

  return (
    <motion.button
      data-signup-primary
      type="submit"
      disabled={disabled || isLoading || isSuccess}
      aria-busy={isLoading}
      aria-live="polite"
      className={cn(
        ONBOARDING_PRIMARY_BUTTON,
        "relative h-12 w-full overflow-hidden px-6 text-[15px]",
        isSuccess &&
          "border-[#292929] bg-[#292929] text-white hover:bg-[#292929] hover:text-white",
        className,
      )}
      animate={
        reduceMotion
          ? undefined
          : isSuccess
            ? { scale: [1, 1.03, 1] }
            : undefined
      }
      transition={{ duration: 0.45, ease: ONBOARDING_EASE }}
    >
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {loadingLabel ?? "Starting your trial…"}
          </>
        ) : isSuccess ? (
          <motion.span
            className="inline-flex items-center gap-2"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: ONBOARDING_EASE }}
          >
            <Check className="size-5" strokeWidth={2.5} aria-hidden />
            Trial started
          </motion.span>
        ) : (
          idleLabel ?? `Start ${trialDays}-day free trial`
        )}
      </span>
    </motion.button>
  );
}
