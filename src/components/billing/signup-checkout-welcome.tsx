"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import {Dialog,DialogContent,DialogTitle} from "@/components/ui/dialog";
import { PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans.data";

/** Shown only after the server has confirmed payment setup, or in the local preview. */
export function SignupCheckoutWelcome({ continueHref = "/dashboard?welcome=1" }: { continueHref?: string }) {
  const reduceMotion = useReducedMotion();
  return <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-white px-6 py-8 text-[#0b1220]">
    <motion.section aria-labelledby="signup-welcome-title" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
      <div className="relative mt-2 h-[240px] w-full sm:h-[min(38vh,340px)]">
        <picture>
          <source srcSet="/cara-welcome-grey.webp" type="image/webp" />
          <img src="/cara-welcome-grey.png" alt="Cara welcoming you to your workspace" width={1122} height={1402} className="h-full w-full object-contain [mask-image:linear-gradient(to_bottom,black_84%,transparent_100%)]" fetchPriority="high" />
        </picture>
      </div>
      <h1 id="signup-welcome-title" className="mt-3 text-[36px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[46px]">Welcome to HelloCara.</h1>
      <p className="mt-4 max-w-sm text-[15px] leading-6 text-slate-500">Your {PLATFORM_TRIAL_DAYS}-day free trial has started. Set up your business in the dashboard and get Cara ready to answer calls.</p>
      <Link href={continueHref} className="mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#0b1220] px-8 text-sm font-medium text-white transition hover:bg-[#182233] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-500">Open your dashboard <ArrowRight size={16} aria-hidden="true" /></Link>
    </motion.section>
  </main>;
}

/** Protected staff-only visual review; never starts a trial or payment. */
export function SignupCheckoutWelcomePreview({continueHref}:{continueHref:string}) {
 return <Dialog open><DialogContent showCloseButton={false} className="flex h-dvh w-screen max-w-none rounded-none p-0 sm:max-w-none" overlayClassName="bg-white"><DialogTitle className="sr-only">Confirmation preview</DialogTitle><SignupCheckoutWelcome continueHref={continueHref}/></DialogContent></Dialog>;
}
