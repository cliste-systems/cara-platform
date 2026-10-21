"use client";

import {AuthFormAlert} from "@/components/auth/auth-form-alert";
import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

import {
  ONBOARDING_FIELD_BOX,
  ONBOARDING_FIELD_BOX_INVALID,
  ONBOARDING_FIELD_ERROR,
  ONBOARDING_FIELD_LABEL,
  ONBOARDING_PROFILE_FIELD_BOX,
  ONBOARDING_PROFILE_FIELD_BOX_INVALID,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

import { OnboardingEnter } from "./onboarding-enter";
import { OnboardingStepBackButton } from "./onboarding-step-back-button";

type FieldSurface = "default" | "profile";

type Props = {
  children: ReactNode;
  footer: ReactNode;
  error?: string|null;
  className?: string;
  action?: string | ((formData: FormData) => void | Promise<void>);
  noValidate?: boolean;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  fieldSurface?: FieldSurface;
};

const FieldSurfaceContext = createContext<FieldSurface>("default");

function useFieldSurface() {
  return useContext(FieldSurfaceContext);
}

export function OnboardingFieldSurfaceProvider({
  surface,
  children,
}: {
  surface: FieldSurface;
  children: ReactNode;
}) {
  return (
    <FieldSurfaceContext.Provider value={surface}>
      {children}
    </FieldSurfaceContext.Provider>
  );
}

export function OnboardingFormCard({
  children,
  footer,
  error,
  className,
  action,
  noValidate = false,
  onSubmit,
  fieldSurface = "default",
}: Props) {
  const enterTone = fieldSurface === "profile" ? "profile" : "default";

  return (
    <FieldSurfaceContext.Provider value={fieldSurface}>
      <form
        action={action}
        noValidate={noValidate}
        onSubmit={onSubmit}
        className={cn("w-full space-y-2.5", className)}
      >
        {children}
        <AuthFormAlert message={error}/>
        <OnboardingEnter
          tone={enterTone}
          className="flex items-center justify-center gap-3 pt-4"
        >
          <OnboardingStepBackButton />
          {footer}
        </OnboardingEnter>
      </form>
    </FieldSurfaceContext.Provider>
  );
}

export function OnboardingFieldRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const fieldSurface = useFieldSurface();
  const enterTone = fieldSurface === "profile" ? "profile" : "default";

  return (
    <OnboardingEnter tone={enterTone} className={className}>
      {children}
    </OnboardingEnter>
  );
}

/** Lovable-style labelled field box. */
export function OnboardingFieldBox({
  label,
  htmlFor,
  children,
  className,
  error,
  static: isStatic = false,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  error?: string;
  /** Skip entrance animation — use for tabbed or dynamic forms. */
  static?: boolean;
}) {
  const fieldSurface = useFieldSurface();
  const reduceMotion = useReducedMotion();
  const invalid = Boolean(error);
  const isProfile = fieldSurface === "profile";

  const boxClass = cn(
    isProfile ? ONBOARDING_PROFILE_FIELD_BOX : ONBOARDING_FIELD_BOX,
    invalid &&
      (isProfile
        ? ONBOARDING_PROFILE_FIELD_BOX_INVALID
        : ONBOARDING_FIELD_BOX_INVALID),
    className,
  );

  const field = (
    <>
      <label htmlFor={htmlFor} className={ONBOARDING_FIELD_LABEL}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={ONBOARDING_FIELD_ERROR} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (reduceMotion || isStatic) {
    return <div className={boxClass}>{field}</div>;
  }

  return (
    <OnboardingEnter tone={isProfile ? "profile" : "default"}>
      <motion.div
        className={boxClass}
        animate={invalid ? { x: [0, -4, 4, -2, 2, 0] } : { x: 0 }}
        transition={{ duration: 0.38 }}
        whileHover={
          invalid
            ? undefined
            : {
                y: -2,
                scale: 1.005,
                transition: { type: "spring", stiffness: 420, damping: 28 },
              }
        }
      >
        {field}
      </motion.div>
    </OnboardingEnter>
  );
}
