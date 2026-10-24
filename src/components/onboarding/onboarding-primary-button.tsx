"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  ONBOARDING_PRIMARY_BUTTON,
  ONBOARDING_PRIMARY_BUTTON_SHIMMER,
} from "./onboarding-ui";

type Props = {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  pending?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  form?: string;
  name?: string;
  value?: string;
  "aria-label"?: string;
};

function PrimaryButtonContent({
  children,
  showShimmer,
}: {
  children: ReactNode;
  showShimmer: boolean;
}) {
  return (
    <>
      {showShimmer ? (
        <span aria-hidden className={ONBOARDING_PRIMARY_BUTTON_SHIMMER} />
      ) : null}
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </>
  );
}

export function OnboardingPrimaryButton({
  className,
  children,
  disabled,
  pending,
  type = "button",
  onClick,
  form,
  name,
  value,
  "aria-label": ariaLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || pending;

  if (reduceMotion) {
    return (
      <button
        data-signup-primary
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        form={form}
        name={name}
        value={value}
        aria-label={ariaLabel}
        className={cn(ONBOARDING_PRIMARY_BUTTON, className)}
      >
        {children}
      </button>
    );
  }

  return (
    <motion.button
      data-signup-primary
        type={type}
      disabled={isDisabled}
      onClick={onClick}
      form={form}
      name={name}
      value={value}
      aria-label={ariaLabel}
      className={cn(ONBOARDING_PRIMARY_BUTTON, className)}
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.995, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
    >
      <PrimaryButtonContent showShimmer={false}>
        {children}
      </PrimaryButtonContent>
    </motion.button>
  );
}
