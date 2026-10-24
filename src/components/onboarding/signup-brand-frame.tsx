"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import type { PUBLIC_ASSETS } from "@/lib/public-assets";
import styles from "./signup-flow.module.css";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { signupBody, signupDisplay } from "./brand-fonts";

export type SignupStage = "signup" | "voice" | "plans" | "setup" | "billing";
const STAGES = ["Account", "Hear Cara", "Plan", "Setup options", "Billing"];
const INDEX: Record<SignupStage, number> = { signup: 0, voice: 1, plans: 2, setup: 3, billing: 4 };

/** A focused, image-free signup journey within the marketing site's ruled frame. */
export function SignupBrandFrame({ stage, title, description, children, scene, backAction, backDisabled = false, accountEmail }: {
  stage: SignupStage;
  accountEmail?: string;
  backAction?: () => void;
  backDisabled?: boolean;
  scene?: keyof typeof PUBLIC_ASSETS.signupScenes;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [accountNoticeOpen, setAccountNoticeOpen] = useState(false);
  const reducedMotion = useReducedMotion();
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
    <div data-signup-stage={stage} className={`${styles.frame} ${signupBody.variable} ${signupDisplay.variable} min-h-0 flex-1 overflow-y-auto bg-white text-[#202020] antialiased`}>
      <div data-signup-frame className={cn(
        "mx-auto flex w-[calc(100%-32px)] flex-col justify-start border-x border-slate-200/70 py-6 sm:w-[calc(100%-64px)] sm:py-10",
        wide ? "max-w-[1200px]" : "max-w-[840px]",
        compactBilling && "lg:py-2",
        preview ? "min-h-[calc(100dvh-28px)]" : "min-h-dvh",
      )}>
        <div className={cn("shrink-0 border-y border-slate-200/70 lg:my-auto", pathname === "/signup/check-email" && "my-auto")}>
          <div className="flex items-center justify-between border-b border-slate-200/70 px-3 py-1.5 sm:px-6">
            {stage === "voice" ? (
              <Dialog open={accountNoticeOpen} onOpenChange={setAccountNoticeOpen}>
                <DialogTrigger render={<button type="button" className={backClass} />}><ArrowLeft className="size-3.5" aria-hidden />Back</DialogTrigger>
                <DialogContent className={cn(signupBody.className, "gap-0 rounded-[24px] border border-[#dedede] bg-white p-6 text-[#292929] shadow-xl ring-0 duration-200 sm:max-w-[420px] sm:p-8 motion-reduce:animate-none motion-reduce:duration-0")} overlayClassName="bg-black/25 duration-200 motion-reduce:animate-none motion-reduce:duration-0">
                  <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[#eeeeee]"><MailCheck size={26} strokeWidth={1.5} aria-hidden /></div>
                  <DialogTitle className={cn(signupDisplay.className, "text-2xl font-semibold tracking-tight")}>Your email is already linked</DialogTitle>
                  <DialogDescription className="mt-3 text-sm leading-6 text-[#626262]">
                    Your account has been created{accountEmail ? <> with <strong className="break-words font-semibold text-[#292929]">{accountEmail}</strong></> : " with the email you provided"}. You can’t go back to the account creation step from here.
                  </DialogDescription>
                  <p className="mt-3 text-sm leading-6 text-[#626262]">Need to use a different email? Finish setup first, then change your email address in your dashboard.</p>
                  <DialogClose render={<button type="button" className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#292929] px-5 text-sm font-medium text-white transition-colors hover:bg-[#151515] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#626262]" />}>Continue setup <ArrowRight size={16} aria-hidden /></DialogClose>
                </DialogContent>
              </Dialog>
            ) : backAction ? <button type="button" onClick={backAction} disabled={backDisabled} className={backClass}><ArrowLeft className="size-3.5" aria-hidden />Back</button>
              : <Link href={backHref} className={backClass}><ArrowLeft className="size-3.5" aria-hidden />Back</Link>}
            <div aria-label={`Signup progress: ${STAGES[INDEX[stage]]}, step ${step} of ${STAGES.length}`} className="flex items-center gap-3">
              <span aria-hidden="true" className="border-r border-slate-200/70 pr-3 text-[11px] tabular-nums tracking-[0.08em] text-slate-500">
                {String(step).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
              </span>
              <span aria-current="step" className="text-xs font-medium text-slate-800">{STAGES[INDEX[stage]]}</span>
            </div>
          </div>
          <>
            <div data-signup-panel className={cn("px-5 py-8 sm:px-10 sm:py-10", compactBilling && "lg:pt-10 lg:pb-3")}>
              <motion.div key={pathname} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className={cn("mx-auto w-full", wide ? "max-w-[1100px]" : stage === "voice" ? "max-w-[460px] md:max-w-[600px] lg:max-w-[680px]" : stage === "signup" ? "max-w-[460px] md:max-w-[600px]" : compactBilling ? "max-w-[460px] lg:max-w-[640px]" : "max-w-[460px]")}>
                {title ? (
                  <div data-signup-heading className={cn("mb-7 flex flex-col items-center gap-3 text-center", compactBilling && "mb-5 gap-2 lg:mb-4")}>
                    <div data-signup-mark className={cn("mb-1 shrink-0", compactBilling && "lg:mb-0")}><ClisteLogoMark size={40} priority /></div>
                    <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[36px]">{title}</h1>
                    {description ? <p className="max-w-md text-sm leading-6 text-slate-600">{description}</p> : null}
                  </div>
                ) : null}
                {children}
              </motion.div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
}
