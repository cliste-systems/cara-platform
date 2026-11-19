"use client";

import { Children, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useOnboardingAnimateIn } from "@/components/onboarding/onboarding-enter";
import {
  onboardingEnterItemVariants,
  onboardingStaggerVariants,
} from "@/components/onboarding/onboarding-motion";
import { DASHBOARD_FORM_STACK } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import { useServiceTheme } from "./service-theme-context";

type DashboardAnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  /** Last child fills remaining viewport height (fill-page layouts). */
  growLast?: boolean;
};

function visibleChildren(children: ReactNode) {
  return Children.toArray(children).filter(
    (child) => child !== null && child !== undefined,
  );
}

/** Staggered fade-in for sibling sections (headers, cards, form blocks). */
export function DashboardAnimatedGroup({
  children,
  className,
  growLast = false,
}: DashboardAnimatedGroupProps) {
  const reduceMotion = useReducedMotion();
  const serviceTheme = useServiceTheme();
  const ready = useOnboardingAnimateIn();
  const items = visibleChildren(children);

  if (reduceMotion || serviceTheme) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={onboardingStaggerVariants}
      initial="hidden"
      animate={ready ? "show" : "hidden"}
    >
      {items.map((child, index) => (
        <motion.div
          key={index}
          variants={onboardingEnterItemVariants}
          className={cn(
            "min-w-0",
            growLast &&
              index === items.length - 1 &&
              "flex min-h-0 flex-1 flex-col overflow-hidden",
          )}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** `DASHBOARD_FORM_STACK` with staggered section entrances. */
export function DashboardAnimatedStack({
  children,
  className,
  /** Inside `DashboardFormScrollRegion` — omits outer border (parent provides frame). */
  embedded = false,
}: DashboardAnimatedGroupProps & { embedded?: boolean }) {
  return (
    <DashboardAnimatedGroup
      className={cn(
        embedded ? "divide-y divide-slate-100" : DASHBOARD_FORM_STACK,
        className,
      )}
    >
      {children}
    </DashboardAnimatedGroup>
  );
}

/** Common fill-page column: header, then scrollable body. */
export function DashboardAnimatedPageSections({
  children,
  className,
}: DashboardAnimatedGroupProps) {
  return (
    <DashboardAnimatedGroup
      growLast
      className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}
    >
      {children}
    </DashboardAnimatedGroup>
  );
}
