"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  saveCaraTrainingAdminNotes,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";
import { CaraTrainingField } from "@/components/admin/cara-training-field";
import {
  CaraTrainingFeedback,
  CaraTrainingSectionFooter,
} from "@/components/admin/cara-training-feedback";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function ReviewPublishSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const saveNotes = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingAdminNotes(
        data.organizationId,
        data.adminNotes,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data.adminNotes, data.organizationId, onSaved]);

  const warnings = Array.isArray(data.promptCompileWarnings)
    ? data.promptCompileWarnings
    : [];

  return (
    <SectionCard
      title="11. Review & publish"
      description="Internal notes never appear in the compiled prompt. Recompile happens on each section save."
    >
      <CaraTrainingField label="Admin notes" feed="internal">
        <Textarea
          value={data.adminNotes}
          onChange={(e) => onChange({ adminNotes: e.target.value })}
          rows={3}
          placeholder="Provisioning notes, hardware quirks, escalation contacts…"
        />
      </CaraTrainingField>
      <CaraTrainingSectionFooter saved={saved} error={error}>
        <Button type="button" variant="outline" disabled={pending} onClick={saveNotes}>
          {pending ? "Saving…" : "Save admin notes"}
        </Button>
      </CaraTrainingSectionFooter>

      {warnings.length > 0 ? (
        <CaraTrainingFeedback tone="warning" variant="block">
          <span className="font-medium">Compile warnings</span>
          <pre className="mt-1 overflow-auto text-xs font-normal">
            {JSON.stringify(warnings, null, 2)}
          </pre>
        </CaraTrainingFeedback>
      ) : null}

      <CaraTrainingField
        label="Compiled prompt"
        feed="prompt"
        hint="Read-only output saved to Supabase — rebuilt when you save any section above."
      >
        <pre className="max-h-72 overflow-auto rounded-md border border-gray-100 bg-slate-950 p-3 text-xs text-slate-100">
          {data.customPrompt || "— not compiled yet —"}
        </pre>
      </CaraTrainingField>

    </SectionCard>
  );
}
