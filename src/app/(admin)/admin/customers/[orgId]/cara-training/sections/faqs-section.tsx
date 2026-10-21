"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CaraTrainingFieldLabel } from "@/components/admin/cara-training-field";
import { CaraTrainingFeedback, CaraTrainingSectionFooter } from "@/components/admin/cara-training-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RETAIL_FAQ_STARTER_PACK } from "@/lib/retail-faq-starter-pack";

import {
  saveCaraTrainingFaqs,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function FaqsSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [starterAccepted, setStarterAccepted] = useState(false);

  const existingQuestions = useMemo(
    () => new Set(data.agentFaqs.map((f) => f.question.toLowerCase())),
    [data.agentFaqs],
  );

  const seedStarterPack = useCallback(() => {
    const toAdd = RETAIL_FAQ_STARTER_PACK.filter(
      (item) => !existingQuestions.has(item.question.toLowerCase()),
    ).map((item) => ({ question: item.question, answer: item.answer }));
    onChange({ agentFaqs: [...data.agentFaqs, ...toAdd] });
    setStarterAccepted(true);
  }, [data.agentFaqs, existingQuestions, onChange]);

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingFaqs(
        data.organizationId,
        data.agentFaqs,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data.agentFaqs, data.organizationId, onSaved]);

  return (
    <SectionCard
      title="7. Common questions"
      description="Review FAQ answers before save — starter pack seeds drafts only."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={seedStarterPack}>
          Insert retail starter pack
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              agentFaqs: [...data.agentFaqs, { question: "", answer: "" }],
            })
          }
        >
          Add FAQ
        </Button>
      </div>
      {starterAccepted ? (
        <CaraTrainingFeedback tone="warning" variant="block">
          Starter pack inserted as drafts — review each answer before saving.
        </CaraTrainingFeedback>
      ) : null}

      <div className="space-y-3">
        {data.agentFaqs.map((faq, index) => (
          <div
            key={`faq-${index}`}
            className="rounded-lg border border-gray-200/60 bg-gray-50/30 p-3"
          >
            <div className="space-y-2">
              <CaraTrainingFieldLabel label="Question" feed="prompt" />
              <Input
                value={faq.question}
                onChange={(e) => {
                  const next = [...data.agentFaqs];
                  next[index] = { ...faq, question: e.target.value };
                  onChange({ agentFaqs: next });
                }}
              />
            </div>
            <div className="mt-2 space-y-2">
              <CaraTrainingFieldLabel label="Answer" feed="prompt" />
              <Textarea
                value={faq.answer}
                rows={2}
                onChange={(e) => {
                  const next = [...data.agentFaqs];
                  next[index] = { ...faq, answer: e.target.value };
                  onChange({ agentFaqs: next });
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-destructive"
              onClick={() =>
                onChange({
                  agentFaqs: data.agentFaqs.filter((_, i) => i !== index),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <CaraTrainingSectionFooter saved={saved} error={error}>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save FAQs"}
        </Button>
      </CaraTrainingSectionFooter>
    </SectionCard>
  );
}
