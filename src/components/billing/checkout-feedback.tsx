"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert } from "lucide-react";
import type { CheckoutFeedback as Feedback } from "@/lib/checkout-feedback";

export function CheckoutFeedback({ feedback }: {
  feedback: Feedback | null;
  cardSaved: boolean;
  onEditPayment?: () => void;
}) {
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!feedback) return;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" });
  }, [feedback, reduced]);
  return <AnimatePresence initial={false}>
    {feedback && <motion.div key="checkout-feedback" data-feedback-slot
      initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : .24, ease: [.22, 1, .36, 1] }} className="overflow-hidden">
      <div ref={panel} role="alert" aria-atomic="true" tabIndex={-1} aria-label={feedback.title}
        className="my-2 rounded-xl border border-[#e5c9c5] bg-[#fffafa] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#b7473f]/25">
        <div className="flex items-start gap-2.5 px-3.5 py-3">
          <CircleAlert size={16} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0 text-[#a13d35]" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-5 text-[#943e37]">{feedback.title}</p>
            <p className="mt-0.5 text-xs leading-[18px] text-[#68605f]">{feedback.message}</p>
          </div>
        </div>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
