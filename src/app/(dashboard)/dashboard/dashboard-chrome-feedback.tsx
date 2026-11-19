"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { Popover } from "@base-ui/react/popover";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { submitDashboardFeedback } from "./support/actions";

const FEEDBACK_TRIGGER =
  "inline-flex h-7 shrink-0 items-center rounded-full border border-[#e5eaf2] bg-white/80 px-2.5 text-[11px] font-medium text-[#64748b] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-[#f8fafc] hover:text-[#0f172a] data-[popup-open]:border-slate-300 data-[popup-open]:bg-white data-[popup-open]:text-[#0f172a]";

export function DashboardChromeFeedback() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setFeedback("");
    setMessage(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleSubmit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitDashboardFeedback({
        body: feedback,
        pagePath: pathname,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setOpen(false);
      resetForm();
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger className={FEEDBACK_TRIGGER}>Feedback</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-[60] outline-none"
          side="bottom"
          align="end"
          sideOffset={8}
        >
          <Popover.Popup
            className={cn(
              "w-[min(calc(100vw-2rem),320px)] origin-[var(--transform-origin)] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.28)] outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <Textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Type your feedback here…"
              rows={4}
              disabled={pending}
              className="min-h-[96px] resize-none rounded-lg border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#0b1220] placeholder:text-slate-400 focus-visible:border-slate-300 focus-visible:ring-0"
              aria-label="Feedback"
            />
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="max-w-[11rem] text-[11px] leading-snug text-slate-400">
                We read every submission and may follow up if we need more
                detail.
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !feedback.trim()}
                className={cn(
                  DASHBOARD_PRIMARY_BUTTON_CLASS,
                  "h-8 shrink-0 rounded-lg px-3.5 text-[12px]",
                )}
              >
                {pending ? "Sending…" : "Submit"}
              </button>
            </div>
            {message ? (
              <FormFeedback message={message} />
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
