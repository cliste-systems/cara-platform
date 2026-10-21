"use client";

import { useCallback, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { CaraTrainingField, CaraTrainingFieldLabel } from "@/components/admin/cara-training-field";
import { CaraTrainingSectionFooter } from "@/components/admin/cara-training-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyWeekSchedule } from "@/lib/business-hours";

import {
  saveCaraTrainingStoreFacts,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function StoreFactsSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingStoreFacts(data.organizationId, {
        agentBusinessType: data.agentBusinessType,
        businessKnowledgeSummary: data.businessKnowledgeSummary,
        agentLocationAddress: data.agentLocationAddress,
        agentLocationEircode: data.agentLocationEircode,
        agentLocationCounty: data.agentLocationCounty,
        agentBaseTown: data.agentBaseTown,
        openingHoursSchedule: data.openingHoursSchedule,
        open24_7: data.open24_7,
        bankHolidays: data.bankHolidays,
        hoursOverrides: data.hoursOverrides,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data, onSaved]);

  const addOverride = useCallback(() => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    onChange({
      hoursOverrides: [
        ...data.hoursOverrides,
        {
          id: "",
          label: "",
          schedule: emptyWeekSchedule(),
          expiresAt: expires.toISOString(),
        },
      ],
    });
  }, [data.hoursOverrides, onChange]);

  return (
    <SectionCard
      title="2. Store facts"
      description="Address, opening hours, bank holidays, and knowledge summary."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CaraTrainingField label="Business type" feed="prompt">
          <Input
            value={data.agentBusinessType}
            onChange={(e) => onChange({ agentBusinessType: e.target.value })}
            placeholder="Supermarket"
          />
        </CaraTrainingField>
        <CaraTrainingField label="Base town" feed="prompt">
          <Input
            value={data.agentBaseTown}
            onChange={(e) => onChange({ agentBaseTown: e.target.value })}
          />
        </CaraTrainingField>
        <CaraTrainingField label="Address" feed="prompt" className="sm:col-span-2">
          <Input
            value={data.agentLocationAddress}
            onChange={(e) => onChange({ agentLocationAddress: e.target.value })}
          />
        </CaraTrainingField>
        <CaraTrainingField label="Eircode" feed="prompt">
          <Input
            value={data.agentLocationEircode}
            onChange={(e) => onChange({ agentLocationEircode: e.target.value })}
          />
        </CaraTrainingField>
        <CaraTrainingField label="County" feed="prompt">
          <Input
            value={data.agentLocationCounty}
            onChange={(e) => onChange({ agentLocationCounty: e.target.value })}
          />
        </CaraTrainingField>
      </div>
      <CaraTrainingField label="Knowledge summary" feed="prompt">
        <Textarea
          value={data.businessKnowledgeSummary}
          onChange={(e) => onChange({ businessKnowledgeSummary: e.target.value })}
          rows={4}
        />
      </CaraTrainingField>
      <CaraTrainingField label="Opening hours" feed="prompt">
        <OpeningHoursEditor
          value={data.openingHoursSchedule}
          onChange={(schedule) => onChange({ openingHoursSchedule: schedule })}
          open24_7={data.open24_7}
          onOpen24_7Change={(open24_7) => onChange({ open24_7 })}
          bankHolidays={data.bankHolidays}
          onBankHolidaysChange={(bankHolidays) => onChange({ bankHolidays })}
        />
      </CaraTrainingField>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CaraTrainingFieldLabel
            label="Temporary hours overrides"
            feed="prompt"
          />
          <Button type="button" variant="outline" size="sm" onClick={addOverride}>
            <Plus className="size-3.5" aria-hidden />
            Add override
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Active overrides replace normal hours in Cara&apos;s prompt until they expire.
        </p>
        {data.hoursOverrides.map((override, index) => (
          <div
            key={override.id || `override-${index}`}
            className="rounded-lg border border-gray-200/60 bg-gray-50/30 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={override.label}
                  onChange={(e) => {
                    const next = [...data.hoursOverrides];
                    next[index] = { ...override, label: e.target.value };
                    onChange({ hoursOverrides: next });
                  }}
                  placeholder="Christmas hours"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expires</Label>
                <Input
                  type="datetime-local"
                  value={override.expiresAt.slice(0, 16)}
                  onChange={(e) => {
                    const next = [...data.hoursOverrides];
                    next[index] = {
                      ...override,
                      expiresAt: new Date(e.target.value).toISOString(),
                    };
                    onChange({ hoursOverrides: next });
                  }}
                />
              </div>
            </div>
            <OpeningHoursEditor
              value={override.schedule}
              onChange={(schedule) => {
                const next = [...data.hoursOverrides];
                next[index] = { ...override, schedule };
                onChange({ hoursOverrides: next });
              }}
              open24_7={false}
              bankHolidays={data.bankHolidays}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-destructive"
              onClick={() =>
                onChange({
                  hoursOverrides: data.hoursOverrides.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove override
            </Button>
          </div>
        ))}
      </div>

      <CaraTrainingSectionFooter saved={saved} error={error}>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save store facts"}
        </Button>
      </CaraTrainingSectionFooter>
    </SectionCard>
  );
}
