"use client";

import { useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AUTH_FORM_ALERT } from "@/components/auth/auth-ui";
import { cn } from "@/lib/utils";

export type FeedbackTone = "error" | "success" | "info";

/** One visual and accessible feedback treatment across signup, billing and setup. */
export function FormFeedback({ message, title = "Please check this", tone = "error", focusOnError = false, className }: {
  message: string | null | undefined;
  title?: string;
  tone?: FeedbackTone;
  focusOnError?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message && tone === "error" && focusOnError) {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" });
    }
  }, [message, tone, focusOnError, reduced]);
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return <AnimatePresence initial={false}>
    {message ? <motion.div key="feedback" data-feedback-slot initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
    <div ref={ref} data-feedback-tone={tone}
      role={tone === "error" ? "alert" : "status"} aria-label={title} aria-atomic="true"
      tabIndex={focusOnError && tone === "error" ? -1 : undefined}
      className={cn(AUTH_FORM_ALERT, tone !== "error" && "border-[#d6e3dc] border-l-[#5d796c] bg-[#f2f7f4] text-[#304e40]", className)}>
      <span aria-hidden className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fbe0d9] text-[#a13d35]", tone !== "error" && "bg-[#e3eee7] text-[#486957]")}><Icon size={17}/></span>
      <div className="min-w-0 flex-1 text-left"><p className="text-[13px] font-semibold leading-5">{title}</p><p className={cn("mt-0.5 text-xs leading-5 text-[#783e36]", tone !== "error" && "text-[#52695d]")}>{message}</p></div>
    </div></motion.div> : null}
  </AnimatePresence>;
}
