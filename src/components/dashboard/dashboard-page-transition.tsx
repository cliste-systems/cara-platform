"use client";

import { createContext, useContext } from "react";
import { useServiceTheme } from "./service-theme-context";
import { motion, useReducedMotion } from "motion/react";

import styles from "./dashboard-page-transition.module.css";
import { cn } from "@/lib/utils";

const TransitionDepth = createContext(0);

type DashboardPageTransitionProps = {
  children: React.ReactNode;
  animateKey: string;
  className?: string;
};

/** Soft enter when switching dashboard sections — no exit animation (avoids DOM teardown races). */
export function DashboardPageTransition({
  children,
  animateKey,
  className,
}: DashboardPageTransitionProps) {
  const reduceMotion = useReducedMotion();
  const serviceTheme = useServiceTheme();
  const depth = useContext(TransitionDepth);

  if (reduceMotion || (serviceTheme && depth > 0)) {
    return <div className={cn("w-full min-w-0", className)}>{children}</div>;
  }

  return (
    <TransitionDepth.Provider value={depth + 1}><motion.div
      key={animateKey}
      initial={{ opacity: 0.96, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("w-full min-w-0", styles.frame, className)}
    >
      {children}
    </motion.div></TransitionDepth.Provider>
  );
}
