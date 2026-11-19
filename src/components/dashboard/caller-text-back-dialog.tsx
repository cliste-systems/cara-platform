"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MessageSquare, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  reviewCallerTextBackMessage,
  sendCallerTextBackMessage,
} from "@/app/(dashboard)/dashboard/action-inbox/caller-text-back-actions";
import {
  composeCallerTextBackMessage,
} from "@/lib/caller-text-back-content";
import { callerSmsEligibility } from "@/lib/caller-line-sms";
import { finalizeCallerTextBackMiddle } from "@/lib/caller-text-back-sanitize";
import { cn } from "@/lib/utils";
import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";

const SUCCESS_DISMISS_MS = 3200;

type CallerTextBackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  callerName: string;
  callerDisplay: string;
  callerNumber: string;
};

type DialogStep = "draft" | "review" | "ready" | "sent";

export function CallerTextBackDialog({
  open,
  onOpenChange,
  ticketId,
  callerName,
  callerDisplay,
  callerNumber,
}: CallerTextBackDialogProps) {
  const [middle, setMiddle] = useState("");
  const [draftMiddle, setDraftMiddle] = useState("");
  const [suggestedMiddle, setSuggestedMiddle] = useState<string | null>(null);
  const [usedAiReview, setUsedAiReview] = useState(false);
  const [step, setStep] = useState<DialogStep>("draft");
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, startReview] = useTransition();
  const [pendingSend, startSend] = useTransition();
  const { businessName, storePhoneE164 } = useDashboardVertical();

  const preview = useMemo(
    () =>
      composeCallerTextBackMessage({
        callerName,
        businessName,
        middle,
        storePhoneE164,
      }),
    [callerName, businessName, middle, storePhoneE164],
  );

  const draftKey = JSON.stringify([open, callerNumber, ticketId]);
  const [lastDraftKey, setLastDraftKey] = useState<typeof draftKey | undefined>(undefined);
  if (lastDraftKey !== draftKey) {
    setLastDraftKey(draftKey);
    if (open) {
      setMiddle("");
      setDraftMiddle("");
      setSuggestedMiddle(null);
      setUsedAiReview(false);
      setStep("draft");
      const eligibility = callerSmsEligibility(callerNumber);
      setError(eligibility.canText ? null : eligibility.reason);
    }
  }

  useEffect(() => {
    if (step !== "sent") return;
    const timer = window.setTimeout(() => onOpenChange(false), SUCCESS_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [step, onOpenChange]);

  function resetToDraft() {
    setStep("draft");
    setSuggestedMiddle(null);
    setUsedAiReview(false);
    setMiddle(draftMiddle);
    setError(null);
  }

  function onReview() {
    const eligibility = callerSmsEligibility(callerNumber);
    if (!eligibility.canText) {
      setError(eligibility.reason);
      return;
    }

    const trimmed = middle.trim();
    if (!trimmed) {
      setError("Add a short message for the customer before review.");
      return;
    }

    setDraftMiddle(trimmed);
    setError(null);
    startReview(async () => {
      const result = await reviewCallerTextBackMessage(trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSuggestedMiddle(result.suggested);
      setUsedAiReview(result.usedAi);
      setStep("review");

      if (result.suggested === result.original) {
        setMiddle(finalizeCallerTextBackMiddle(result.suggested));
        setStep("ready");
      }
    });
  }

  function acceptSuggested() {
    if (!suggestedMiddle) return;
    setMiddle(finalizeCallerTextBackMiddle(suggestedMiddle));
    setStep("ready");
    setError(null);
  }

  function keepOriginal() {
    setMiddle(finalizeCallerTextBackMiddle(draftMiddle));
    setStep("ready");
    setError(null);
  }

  function onSend() {
    const eligibility = callerSmsEligibility(callerNumber);
    if (!eligibility.canText) {
      setError(eligibility.reason);
      return;
    }

    const trimmed = finalizeCallerTextBackMiddle(middle);
    if (!trimmed) {
      setError("Add a short message for the customer before sending.");
      return;
    }

    const message = composeCallerTextBackMessage({
      callerName,
      businessName,
      middle: trimmed,
      storePhoneE164,
    }).trim();

    setError(null);
    startSend(async () => {
      const result = await sendCallerTextBackMessage({
        ticketId,
        message,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMiddle(trimmed);
      setStep("sent");
    });
  }

  const showDraftEditor = step === "draft" || step === "ready";
  const showReviewPanel = step === "review" && suggestedMiddle != null;
  const showSent = step === "sent";
  const smsBlocked = !callerSmsEligibility(callerNumber).canText;
  const callerLabel = hasKnownCallerLabel(callerName, callerDisplay);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!showSent && !pendingSend}
        className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-lg"
      >
        {showSent ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-[#f6faf7] ring-1 ring-[#cfd9d4]">
              <CheckCircle2
                className="size-10 text-[#35443f] animate-in zoom-in-95 duration-500"
                aria-hidden
              />
            </div>
            <p className="mt-6 text-[20px] font-semibold tracking-tight text-[#0b1220] animate-in fade-in slide-in-from-bottom-2 duration-500">
              Text sent
            </p>
            <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-slate-600 animate-in fade-in slide-in-from-bottom-2 duration-700">
              Your message was sent to {callerLabel}.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-0 px-5 pt-5 text-left">
              <DialogTitle className="text-[17px] font-semibold tracking-tight text-[#0b1220]">
                Text back
              </DialogTitle>
              <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
                Message for{" "}
                <span className="font-semibold text-[#0b1220]">{callerLabel}</span>
                {callerDisplay.trim() ? (
                  <>
                    {" "}
                    at{" "}
                    <span className="font-semibold tabular-nums text-[#0b1220]">
                      {callerDisplay}
                    </span>
                  </>
                ) : null}
                . Write your reply — we add the intro and footer for you.
              </DialogDescription>

              <div className="mt-4 space-y-3 pb-1">
                <div className="rounded-2xl border border-[#e8eeea] bg-[#f3f4f6] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Customer will see
                  </p>
                  <div className="mt-2 flex justify-start">
                    <p className="max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-[#0b1220] shadow-sm ring-1 ring-[#e5e7eb]">
                      {preview.trim() || "Your reply will appear here."}
                    </p>
                  </div>
                </div>

                {showDraftEditor && !smsBlocked ? (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label
                        htmlFor="caller-text-back-middle"
                        className="block text-[12px] font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Your message
                      </label>
                      {step === "ready" ? (
                        <button
                          type="button"
                          onClick={resetToDraft}
                          disabled={pendingSend}
                          className="text-[12px] font-medium text-[#353D42] underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                    <Textarea
                      id="caller-text-back-middle"
                      value={middle}
                      readOnly={step === "ready"}
                      disabled={pendingSend}
                      onChange={(event) => {
                        setMiddle(event.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Add your reply here. For example, we can have that ready for collection tomorrow."
                      rows={4}
                      className={cn(
                        "min-h-28 border-[#b9c8c1] text-[14px] leading-relaxed",
                        step === "ready"
                          ? "cursor-default bg-[#fbfcfb] text-[#0b1220]"
                          : "bg-white",
                      )}
                    />
                  </div>
                ) : null}

                {showReviewPanel ? (
                  <div className="space-y-3 rounded-lg border border-[#dfe7e2] bg-[#fbfcfb] p-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Suggested edit
                      </p>
                      <p className="mt-2 text-[14px] leading-relaxed text-[#0b1220]">
                        {suggestedMiddle}
                      </p>
                      {!usedAiReview ? (
                        <p className="mt-2 text-[12px] text-slate-500">
                          AI review unavailable. Basic cleanup applied.
                        </p>
                      ) : null}
                    </div>
                    {draftMiddle !== suggestedMiddle ? (
                      <div className="rounded-md border border-dashed border-[#d9e2dd] bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Your version
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                          {draftMiddle}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={acceptSuggested}
                        className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 px-3 text-[13px]")}
                      >
                        Use suggested
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={keepOriginal}
                        className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9 px-3 text-[13px]")}
                      >
                        Keep mine
                      </Button>
                    </div>
                  </div>
                ) : null}

                {error ? <FormFeedback message={error} /> : null}
              </div>
            </DialogHeader>

            <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 bg-white px-5 py-5 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pendingReview || pendingSend}
                className={DASHBOARD_SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </Button>
              {step === "ready" && !smsBlocked ? (
                <Button
                  type="button"
                  onClick={onSend}
                  disabled={pendingSend}
                  className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "gap-1.5")}
                >
                  {pendingSend ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <MessageSquare className="size-4" aria-hidden />
                  )}
                  {pendingSend ? "Sending…" : "Send message"}
                </Button>
              ) : step === "draft" && !smsBlocked ? (
                <Button
                  type="button"
                  onClick={onReview}
                  disabled={pendingReview || !middle.trim()}
                  className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "gap-1.5")}
                >
                  {pendingReview ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  {pendingReview ? "Reviewing…" : "Review"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function hasKnownCallerLabel(callerName: string, callerDisplay: string): string {
  const name = callerName.trim();
  if (name && name.toLowerCase() !== "unknown caller" && name.toLowerCase() !== "there") {
    return name;
  }
  return callerDisplay.trim() || "the caller";
}
