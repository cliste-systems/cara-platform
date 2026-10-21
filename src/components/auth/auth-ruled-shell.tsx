"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { OnboardingEnter, OnboardingEnterProvider } from "@/components/onboarding/onboarding-enter";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import styles from "@/components/onboarding/signup-flow.module.css";
import { AuthFormAlert } from "./auth-form-alert";

/** The same ruled, image-free frame as signup, without signup progress. */
export function AuthRuledShell({ title, subtitle, urlError, contentExiting = false, children }: {
  title: string;
  subtitle?: string;
  urlError?: string | null;
  contentExiting?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`${styles.frame} min-h-0 flex-1 overflow-y-auto bg-white text-[#0b1220] antialiased`}>
      <main data-auth-frame className="mx-auto flex min-h-dvh w-[calc(100%-32px)] max-w-[840px] flex-col justify-center border-x border-slate-200/70 py-6 sm:w-[calc(100%-64px)] sm:py-10">
        <div className="border-y border-slate-200/70">
          <OnboardingEnterProvider>
            <section className="px-5 py-8 sm:px-10 sm:py-10">
              <motion.div
                className="mx-auto w-full max-w-[460px]"
                animate={contentExiting && !reduceMotion ? { opacity: 0, y: -16 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.52, ease: ONBOARDING_EASE }}
              >
                <OnboardingEnter className="mb-7 flex flex-col items-center gap-3 text-center">
                  <div className="mb-1"><ClisteLogoMark size={40} priority /></div>
                  <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[36px]">{title}</h1>
                  {subtitle ? <p className="max-w-md text-sm leading-6 text-slate-600">{subtitle}</p> : null}
                </OnboardingEnter>
                {urlError ? <div className="mb-4"><AuthFormAlert message={urlError} /></div> : null}
                {children}
              </motion.div>
            </section>
          </OnboardingEnterProvider>
        </div>
      </main>
    </div>
  );
}
