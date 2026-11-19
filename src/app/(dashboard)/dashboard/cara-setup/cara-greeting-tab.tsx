"use client";
import {CaptureFieldsChipEditor} from "@/components/agent-knowledge/capture-fields-chip-editor";
import {FormFeedback} from "@/components/ui/form-feedback";

import { useState } from "react";
import { Loader2, Pause, PhoneCall, Play } from "lucide-react";

import { DashboardAnimatedGroup } from "@/components/dashboard/dashboard-animated-group";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { speakVoicePreview, stopVoicePreview } from "@/components/onboarding/onboarding-voice-preview";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_GREETING_CLOSING,
  defaultVoiceGreetingIntro,
  resolveVoiceGreetingPreview,
  voiceLegalDisclosure,
  VOICE_ASSISTANT_DEFAULT_NAME,
  VOICE_LEGAL_NOTICE_HINT,
} from "@/lib/voice-greeting";
import { cn } from "@/lib/utils";

import { useCaraSetupForm } from "./cara-setup-form-context";
import { useDashboardVertical } from "../dashboard-vertical-context";

export function CaraGreetingTab() {
  const form = useCaraSetupForm();
  const { copy } = useDashboardVertical();
  const defaultIntro = defaultVoiceGreetingIntro(form.businessName);
  const assistantName = VOICE_ASSISTANT_DEFAULT_NAME;
  const legal = voiceLegalDisclosure(assistantName);
  const previewLine = resolveVoiceGreetingPreview(
    form.greetingIntro,
    assistantName,
    form.greetingClosing,
  );

  const [playing, setPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  async function handlePlayToggle() {
    if (playing || previewLoading) {
      stopVoicePreview();
      setPlaying(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    const result = await speakVoicePreview(
      previewLine,
      {
        greetingIntro: form.greetingIntro,
        greetingClosing: form.greetingClosing,
      },
      { onEnded: () => setPlaying(false) },
    );
    setPreviewLoading(false);
    if (result.ok) {
      setPlaying(true);
      return;
    }
    setPreviewError(result.message);
  }

  return (
    <DashboardAnimatedGroup className="space-y-6">
      <SectionCard
        flat
        icon={PhoneCall}
        title="Voice & greeting"
        description="What callers hear the moment your line is answered."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Caller-facing name"
            htmlFor="cara-assistant-name"
            hint="Cara is your phone assistant on every call — this can't be changed."
          >
            <div
              id="cara-assistant-name"
              className="flex h-10 items-center rounded-lg border border-slate-200/90 bg-slate-50 px-3 text-[13px] font-medium text-[#0b1220]"
              aria-readonly="true"
            >
              {assistantName}
            </div>
          </Field>
          <Field
            label="Opening line"
            htmlFor="cara-greeting-intro"
            hint={copy.caraSetup.greetingHint}
          >
            <Input
              id="cara-greeting-intro"
              value={form.greetingIntro}
              placeholder={defaultIntro}
              onChange={(e) => form.setGreetingIntro(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Required notice
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
            {legal}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            {VOICE_LEGAL_NOTICE_HINT}
          </p>
        </div>

        <Field
          label="Closing line"
          htmlFor="cara-greeting-closing"
          hint="A short invitation after the notice, e.g. “How can I help you today?”"
        >
          <Input
            id="cara-greeting-closing"
            value={form.greetingClosing}
            placeholder={DEFAULT_GREETING_CLOSING}
            onChange={(e) => form.setGreetingClosing(e.target.value)}
            className={DASHBOARD_INPUT_CLASS}
          />
        </Field>

        <GreetingPreviewRow
          line={previewLine}
          playing={playing}
          loading={previewLoading}
          error={previewError}
          onPlayToggle={() => void handlePlayToggle()}
        />
      </SectionCard>
      {form.niche!=="retail"&&<SectionCard flat title="Details to capture" description="Choose what Cara should ask when taking an enquiry. She asks only for details relevant to the call."><CaptureFieldsChipEditor captureFields={form.captureFields} onCaptureFieldsChange={form.setCaptureFields} businessType={form.businessType} niche={form.niche} disabled={!form.canManage||form.pending}/></SectionCard>}
    </DashboardAnimatedGroup>
  );
}

function GreetingPreviewRow({
  line,
  playing,
  loading,
  error,
  onPlayToggle,
}: {
  line: string;
  playing: boolean;
  loading: boolean;
  error: string | null;
  onPlayToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <p className="min-w-0 flex-1 truncate text-[13px] text-[#0b1220]">
        &ldquo;{line}&rdquo;
      </p>
      <button
        type="button"
        onClick={onPlayToggle}
        disabled={loading}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className={cn(
          "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
          "bg-[#0b1220] text-white transition-colors hover:bg-[#05070b]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : playing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-4" aria-hidden />
        )}
      </button>
      </div>
      <FormFeedback message={error}/>
    </div>
  );
}
