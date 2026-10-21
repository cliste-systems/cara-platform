"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import type { PUBLIC_ASSETS } from "@/lib/public-assets";
import styles from "./signup-flow.module.css";
import { cn } from "@/lib/utils";
import { OnboardingEnter, OnboardingEnterProvider } from "./onboarding-enter";

export type SignupStage = "signup" | "voice" | "plans" | "billing";
const STAGES = ["Account", "Hear Cara", "Plan", "Billing"];
const INDEX: Record<SignupStage, number> = { signup: 0, voice: 1, plans: 2, billing: 3 };

/** A focused, image-free signup journey within the marketing site's ruled frame. */
export function SignupBrandFrame({ stage, title, description, children, scene, backAction, backDisabled = false }: {
  stage: SignupStage;
  backAction?: () => void;
  backDisabled?: boolean;
  scene?: keyof typeof PUBLIC_ASSETS.signupScenes;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const preview = pathname.startsWith("/dev/");
  const localPreview = pathname.startsWith("/preview/signup/") && pathname.split("/").length === 4;
  const backHref = localPreview
    ? stage === "voice" ? "/signup" : stage === "plans" ? "/preview/signup/voice" : pathname.endsWith("/payment") ? "/preview/signup/billing" : "/preview/signup/plans"
    : pathname.startsWith("/dev/onboarding")
      ? stage === "voice" ? "/signup" : stage === "plans" ? "/dev/onboarding/voice" : "/dev/onboarding/plan"
      : /^\/preview\/signup\/[^/]+\/checkout$/.test(pathname)
        ? pathname.replace(/\/checkout$/, "/plan")
        : stage === "signup" ? "/" : stage === "voice" ? "/signup" : stage === "plans" ? "/signup/voice" : "/signup/plan";
  const backClass = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 justify-self-start rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-default disabled:opacity-50";
  const wide = stage === "plans";
  const compactBilling = stage === "billing" && scene !== "setup";
  const step = INDEX[stage] + 1;

  return (
    <div data-signup-stage={stage} className={`${styles.frame} min-h-0 flex-1 overflow-y-auto bg-white text-[#0b1220] antialiased`}>
      <div data-signup-frame className={cn(
        "mx-auto flex w-[calc(100%-32px)] flex-col justify-center border-x border-slate-200/70 py-6 sm:w-[calc(100%-64px)] sm:py-10",
        wide ? "max-w-[1200px]" : "max-w-[840px]",
        compactBilling && "lg:py-2",
        preview ? "min-h-[calc(100dvh-28px)]" : "min-h-dvh",
      )}>
        <div className="border-y border-slate-200/70">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-3 py-1.5 sm:px-6">
            {stage === "voice" ? <span aria-hidden /> : backAction ? <button type="button" onClick={backAction} disabled={backDisabled} className={backClass}><ArrowLeft className="size-3.5" aria-hidden />Back</button>
              : <Link href={backHref} className={backClass}><ArrowLeft className="size-3.5" aria-hidden />Back</Link>}
            <div aria-label={`Signup progress: ${STAGES[INDEX[stage]]}, step ${step} of ${STAGES.length}`} className="flex items-center gap-3">
              <span aria-hidden="true" className="border-r border-slate-200/70 pr-3 text-[11px] tabular-nums tracking-[0.08em] text-slate-500">
                {String(step).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
              </span>
              <span aria-current="step" className="text-xs font-medium text-slate-800">{STAGES[INDEX[stage]]}</span>
            </div>
          </div>
          <OnboardingEnterProvider>
            <div data-signup-panel className={cn("px-5 py-8 sm:px-10 sm:py-10", compactBilling && "lg:py-3")}>
              <OnboardingEnter key={pathname} className={cn("mx-auto w-full", wide ? "max-w-[1100px]" : stage === "voice" ? "max-w-[460px] md:max-w-[600px] lg:max-w-[680px]" : stage === "signup" ? "max-w-[460px] md:max-w-[600px]" : compactBilling ? "max-w-[460px] lg:max-w-[640px]" : "max-w-[460px]")}>
                {title ? (
                  <div data-signup-heading className={cn("mb-7 flex flex-col items-center gap-3 text-center", compactBilling && "lg:mb-4 lg:gap-2")}>
                    <div data-signup-mark className={cn("mb-1 shrink-0", compactBilling && "lg:mb-0")}><ClisteLogoMark size={40} priority /></div>
                    <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[36px]">{title}</h1>
                    {description ? <p className="max-w-md text-sm leading-6 text-slate-600">{description}</p> : null}
                  </div>
                ) : null}
                {children}
              </OnboardingEnter>
            </div>
          </OnboardingEnterProvider>
        </div>
      </div>
    </div>
  );
}
