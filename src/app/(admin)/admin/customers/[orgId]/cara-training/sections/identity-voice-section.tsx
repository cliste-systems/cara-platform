"use client";

import { useCallback, useState, useTransition } from "react";
import { Volume2 } from "lucide-react";

import {
  CaraTrainingField,
} from "@/components/admin/cara-training-field";
import {
  CaraTrainingFeedback,
  CaraTrainingSectionFooter,
} from "@/components/admin/cara-training-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { greetingDisclosesAi } from "@/lib/greeting-discloses-ai";
import {
  VOICE_ASSISTANT_DEFAULT_NAME,
  voiceLegalDisclosure,
} from "@/lib/voice-greeting";

import {
  saveCaraTrainingIdentity,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function IdentityVoiceSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewPending, setPreviewPending] = useState(false);

  const assistantName = VOICE_ASSISTANT_DEFAULT_NAME;

  const greetingPreview = [
    data.greetingIntro.trim(),
    voiceLegalDisclosure(assistantName),
    data.greetingClosing.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const greetingWarning = !greetingDisclosesAi(greetingPreview, assistantName);

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingIdentity(data.organizationId, {
        assistantDisplayName: assistantName,
        greetingIntro: data.greetingIntro,
        greetingClosing: data.greetingClosing,
        agentVoiceId: data.agentVoiceId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [assistantName, data.agentVoiceId, data.greetingClosing, data.greetingIntro, data.organizationId, onSaved]);

  const playSample = useCallback(async () => {
    setPreviewPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: greetingPreview,
          voiceId: data.agentVoiceId,
          assistantDisplayName: assistantName,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Preview failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewPending(false);
    }
  }, [assistantName, data.agentVoiceId, greetingPreview]);

  return (
    <SectionCard
      title="1. Identity & voice"
      description="Greeting is spoken on every call. Voice ID controls how Cara sounds, not what she says."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CaraTrainingField
          label="Caller-facing name"
          feed="prompt"
          hint="Fixed as Cara on every call."
        >
          <div
            id="cara-assistant-name"
            className="border-input bg-background flex h-9 items-center rounded-md border px-3 text-sm font-medium"
            aria-readonly="true"
          >
            {assistantName}
          </div>
        </CaraTrainingField>
        <CaraTrainingField
          label="Voice ID (ElevenLabs)"
          feed="internal"
          hint="Worker voice synthesis only — not part of the text prompt."
        >
          <Input
            value={data.agentVoiceId}
            onChange={(e) => onChange({ agentVoiceId: e.target.value })}
            className="font-mono text-sm"
          />
          {data.resolvedVoiceName ? (
            <p className="text-muted-foreground text-xs">
              Resolved: {data.resolvedVoiceName}
            </p>
          ) : data.agentVoiceId ? (
            <CaraTrainingFeedback tone="warning" variant="block" className="mt-1.5">
              Voice name could not be resolved — check the ID before save.
            </CaraTrainingFeedback>
          ) : null}
        </CaraTrainingField>
      </div>
      <CaraTrainingField label="Greeting intro" feed="prompt">
        <Input
          value={data.greetingIntro}
          onChange={(e) => onChange({ greetingIntro: e.target.value })}
        />
      </CaraTrainingField>
      <CaraTrainingField label="Greeting closing" feed="prompt">
        <Input
          value={data.greetingClosing}
          onChange={(e) => onChange({ greetingClosing: e.target.value })}
        />
      </CaraTrainingField>
      <CaraTrainingField
        label="Full greeting preview"
        feed="prompt"
        hint="Includes the locked AI and recording disclosure."
      >
        <p className="rounded-md border border-gray-100 bg-white/80 px-3 py-2 text-sm text-slate-700">
          {greetingPreview}
        </p>
      </CaraTrainingField>
      {greetingWarning ? (
        <CaraTrainingFeedback tone="warning" variant="block">
          Greeting must include AI and recording disclosure.
        </CaraTrainingFeedback>
      ) : null}
      <CaraTrainingSectionFooter saved={saved} error={error}>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save identity & voice"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={previewPending || !data.agentVoiceId}
          onClick={playSample}
        >
          <Volume2 className="size-4" aria-hidden />
          {previewPending ? "Playing…" : "Play sample"}
        </Button>
      </CaraTrainingSectionFooter>
    </SectionCard>
  );
}
