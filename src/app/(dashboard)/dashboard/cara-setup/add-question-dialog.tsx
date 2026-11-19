"use client";

import { useId, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  detectCanonicalQuestion,
} from "@/lib/answers-boundary";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import { cleanBusinessRules } from "@/lib/agent-business-rules";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import { weekScheduleHasOpenDay } from "@/lib/business-hours";
import { cn } from "@/lib/utils";

import type { AgentFaq } from "../agent-setup/agent-faqs";
import { CanonicalQuestionBlocked } from "./canonical-question-blocked";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (faq: AgentFaq) => void;
  existingFaqs: AgentFaq[];
  routes?: RoutingActionSummary[];
  transferNumber?: string;
  openingHours?: string;
  businessRules?: string[];
  serviceCatalog?: ServiceCatalogItem[];
  initialQuestion?: string;
  initialAnswer?: string;
};

export function AddQuestionDialog({
  open,
  onOpenChange,
  onAdd,
  existingFaqs,
  routes,
  transferNumber,
  openingHours,
  businessRules,
  serviceCatalog,
  initialQuestion = "",
  initialAnswer = "",
}: Props) {
  const questionId = useId();
  const answerId = useId();
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState(initialAnswer);
  const [canonicalStep, setCanonicalStep] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuestion("");
      setAnswer("");
      setCanonicalStep(false);
    }
    onOpenChange(next);
  };

  const draftKey = JSON.stringify([open, initialQuestion, initialAnswer]);
  const [lastDraftKey, setLastDraftKey] = useState<typeof draftKey | undefined>(undefined);
  if (lastDraftKey !== draftKey) {
    setLastDraftKey(draftKey);
    if (open) {
      setQuestion(initialQuestion);
      setAnswer(initialAnswer);
    }
  }

  const canonicalMatch = useMemo(() => {
    const q = question.trim();
    if (!q) return null;
    return detectCanonicalQuestion(q);
  }, [question]);

  function submit() {
    const q = question.trim();
    if (!q) return;

    if (detectCanonicalQuestion(q)) {
      setCanonicalStep(true);
      return;
    }

    onAdd({ question: q, answer: answer.trim() });
    handleOpenChange(false);
  }

  const showingCanonical = canonicalStep && canonicalMatch;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/30 backdrop-blur-sm"
        className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-lg"
      >
        {showingCanonical && canonicalMatch ? (
          <CanonicalQuestionBlocked
            question={question.trim()}
            match={canonicalMatch}
            onBack={() => setCanonicalStep(false)}
          />
        ) : (
          <>
            <DialogHeader className="space-y-0 border-b border-slate-100 px-5 pt-5 pb-4 text-left">
              <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
                Add a question
              </DialogTitle>
              <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
                What callers ask, and what Cara should say out loud. Services,
                hours, and location are already covered elsewhere.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label
                  htmlFor={questionId}
                  className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                >
                  Question
                </label>
                <Input
                  id={questionId}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Do you offer free quotes?"
                  className={DASHBOARD_INPUT_CLASS}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById(answerId)?.focus();
                    }
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor={answerId}
                  className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                >
                  Answer
                </label>
                <Textarea
                  id={answerId}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="What Cara should say when someone asks this."
                  rows={4}
                  className={cn(DASHBOARD_INPUT_CLASS, "min-h-[6rem] resize-none")}
                />
              </div>
            </div>

            <DialogFooter className="mb-0 flex-row justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-white px-5 pt-4 pb-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!question.trim()}
                onClick={() => submit()}
                className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS)}
              >
                Add question
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
