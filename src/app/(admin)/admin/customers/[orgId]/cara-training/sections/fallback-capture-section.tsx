"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CaraTrainingField } from "@/components/admin/cara-training-field";
import { CaraTrainingSectionFooter } from "@/components/admin/cara-training-feedback";
import { Textarea } from "@/components/ui/textarea";
import type { DetailsCollectMode } from "@/lib/details-collect-mode";
import { buildDetailsCollectionPromptSection } from "@/lib/details-collect-mode";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";

import {
  saveCaraTrainingFallback,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function FallbackCaptureSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const collectItems = parseAgentKnowledgeList(data.agentDetailsToCollect);
  const preview = buildDetailsCollectionPromptSection(
    collectItems,
    data.detailsCollectMode,
  );

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingFallback(data.organizationId, {
        agentDetailsToCollect: data.agentDetailsToCollect,
        detailsCollectMode: data.detailsCollectMode,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data, onSaved]);

  return (
    <SectionCard
      title="8. When Cara can't answer"
      description="What Cara collects before creating an action ticket."
    >
      <CaraTrainingField label="Details to collect" feed="prompt">
        <Textarea
          value={data.agentDetailsToCollect}
          onChange={(e) => onChange({ agentDetailsToCollect: e.target.value })}
          rows={3}
          placeholder="Name, callback number, order reference"
        />
      </CaraTrainingField>
      <CaraTrainingField label="Collection mode" feed="prompt">
        <select
          className="border-input bg-background flex h-9 w-full max-w-xs rounded-md border px-3 text-sm"
          value={data.detailsCollectMode}
          onChange={(e) =>
            onChange({
              detailsCollectMode: e.target.value as DetailsCollectMode,
            })
          }
        >
          <option value="conversational">Conversational</option>
          <option value="fixed">Fixed order</option>
        </select>
      </CaraTrainingField>
      {preview ? (
        <CaraTrainingField
          label="Compiled fallback instructions"
          feed="prompt"
          hint="This is what Cara sees after save."
        >
          <pre className="max-h-40 overflow-auto rounded-md border border-gray-100 bg-slate-950 p-3 text-xs text-slate-100">
            {preview}
          </pre>
        </CaraTrainingField>
      ) : null}
      <CaraTrainingSectionFooter saved={saved} error={error}>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save fallback capture"}
        </Button>
      </CaraTrainingSectionFooter>
    </SectionCard>
  );
}
