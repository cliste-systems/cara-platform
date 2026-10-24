"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
  type FormEvent,
} from "react";
import { ArrowRight, ChevronDown, Loader2, Lock, Pause, Pencil, Play } from "lucide-react";

import Link from "next/link";
import { SignupVoiceCard } from "@/components/onboarding/signup-voice-card";
import {AuthFormAlert} from "@/components/auth/auth-form-alert";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import {
  OnboardingFieldBox,
  OnboardingFormCard,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingVoiceSuggestionDialog } from "@/components/onboarding/onboarding-voice-suggestion-dialog";
import {
  ONBOARDING_FIELD_INPUT,
  ONBOARDING_FIELD_LABEL,
} from "@/components/onboarding/onboarding-ui";
import {
  DEFAULT_GREETING_CLOSING,
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  resolveVoiceGreetingPreview,
  VOICE_ASSISTANT_DEFAULT_NAME,
  voiceLegalDisclosure,
} from "@/lib/voice-greeting";
import { cn } from "@/lib/utils";

import { speakVoicePreview, stopVoicePreview } from "@/components/onboarding/onboarding-voice-preview";
import {
  reviewVoiceGreetingStep,
  saveVoiceStep,
  validateVoiceGreetingPreviewStep,
  type ReviewVoiceGreetingResult,
  type SaveVoicePayload,
  type SaveVoiceResult,
} from "../actions";

const INITIAL: SaveVoiceResult = { ok: false, message: "" };

type FieldKey = "greetingIntro" | "greetingClosing";
type FieldErrors = Partial<Record<FieldKey, string>>;

type Props = {
  businessName: string;
  defaultGreeting: string;
  visualPreview?: boolean;
  continueLabel?: string;
  allowEditing?: boolean;
  reviewBeforeContinue?: boolean;
};

function validateVoicePayload(payload: SaveVoicePayload): FieldErrors {
  const errors: FieldErrors = {};
  const intro = payload.greetingIntro.trim();
  const closing = payload.greetingClosing.trim();

  if (!intro) {
    errors.greetingIntro = "Add an opening line";
  } else if (intro.length > 200) {
    errors.greetingIntro = "Keep the opening line under 200 characters";
  }

  if (closing.length > 200) {
    errors.greetingClosing = "Keep the closing line under 200 characters";
  }

  return errors;
}

export function VoiceForm({ businessName, defaultGreeting, visualPreview=false, continueLabel="Continue", allowEditing=true, reviewBeforeContinue=true }: Props) {
  const assistantDisplayName = VOICE_ASSISTANT_DEFAULT_NAME;
  const defaultIntro = defaultVoiceGreetingIntro(businessName);
  const parsed = parseGreetingParts(
    defaultGreeting,
    assistantDisplayName,
    defaultIntro,
  );
  const legal = voiceLegalDisclosure(assistantDisplayName);
  const disclosureBreak = legal.indexOf(". ") + 1;

  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [greetingIntro, setGreetingIntro] = useState(parsed.intro);
  const [greetingClosing, setGreetingClosing] = useState(parsed.closing);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [suggestion, setSuggestion] = useState<Extract<
    ReviewVoiceGreetingResult,
    { status: "suggestions" }
  > | null>(null);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const pendingPayloadRef = useRef<SaveVoicePayload | null>(null);
  const playRequestRef = useRef(0);
  const [state, formAction, pending] = useActionState(saveVoiceStep, INITIAL);
  const lastStateRef = useRef(state);

  const previewLine = !allowEditing
    ? `Hi, you’re through to ${businessName.trim() || "our business"}. I’m Cara, your AI receptionist. How can I help?`
    : resolveVoiceGreetingPreview(
    greetingIntro,
    assistantDisplayName,
    greetingClosing,
  );

  const formLevelError =
    submitError ||
    (!state.ok &&
    state.message &&
    !fieldErrors.greetingIntro &&
    !fieldErrors.greetingClosing
      ? state.message
      : null);

  const continuePending = reviewing || pending;

  useEffect(() => {
    return () => { playRequestRef.current += 1; stopVoicePreview(); };
  }, []);

  useEffect(() => {
    if (lastStateRef.current === state) return;
    lastStateRef.current = state;

    if (!state.ok && state.message) {
      const message = state.message.toLowerCase();
      // Surface the server-action error against the field it belongs to.
      if (message.includes("opening") || message.includes("intro")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFieldErrors((current) => ({
          ...current,
          greetingIntro: state.message!,
        }));
      } else if (message.includes("greeting") || message.includes("closing")) {
        setFieldErrors((current) => ({
          ...current,
          greetingClosing: state.message!,
        }));
      }
    }
  }, [state]);

  function clearGreetingErrors() {
    playRequestRef.current += 1;
    stopVoicePreview();
    setPlaying(false);
    setPreviewLoading(false);
    setFieldErrors({});
    setPreviewError(null);
    setSubmitError(null);
  }

  function savePayload(payload: SaveVoicePayload) {
    startTransition(() => {
      formAction(payload);
    });
  }

  async function handlePlayToggle() {
    if (playing || previewLoading) {
      stopVoicePreview();
      setPlaying(false);
      setPreviewLoading(false);
      return;
    }

    const payload: SaveVoicePayload = {
      greetingIntro: greetingIntro.trim(),
      greetingClosing: greetingClosing.trim(),
    };

    const formatErrors = validateVoicePayload(payload);
    if (Object.keys(formatErrors).length > 0) {
      setFieldErrors(formatErrors);
      return;
    }

    const requestId = ++playRequestRef.current;
    setPreviewError(null);
    setPreviewLoading(true);
    setElapsed(0);

    try {
      const check = await validateVoiceGreetingPreviewStep(payload);
      if (requestId !== playRequestRef.current) return;

      if (!check.ok) {
        setPreviewLoading(false);
        setPreviewError(check.message);
        setFieldErrors((current) => ({
          ...current,
          ...(check.introIssue ? { greetingIntro: check.message } : {}),
          ...(check.closingIssue ? { greetingClosing: check.message } : {}),
        }));
        return;
      }

      const result = await speakVoicePreview(previewLine, payload, { onEnded: () => setPlaying(false), onTimeUpdate: setElapsed });
      if (requestId !== playRequestRef.current) return;

      setPreviewLoading(false);

      if (!result.ok) {
        setPreviewError(result.message);
        if (
          result.message.includes("offensive") ||
          result.message.includes("inappropriate") ||
          result.message.includes("legal notice is added") ||
          result.message.includes("just the greeting")
        ) {
          setFieldErrors((current) => ({
            ...current,
            ...(result.introIssue ? { greetingIntro: result.message } : {}),
            ...(result.closingIssue ? { greetingClosing: result.message } : {}),
            ...(!result.introIssue && !result.closingIssue
              ? { greetingClosing: result.message }
              : {}),
          }));
        }
        return;
      }

      setPlaying(true);
    } catch {
      if (requestId !== playRequestRef.current) return;
      setPreviewLoading(false);
      setPlaying(false);
      setPreviewError("Your greeting couldn’t be loaded. Please try again.");
    }

  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: SaveVoicePayload = {
      greetingIntro: greetingIntro.trim(),
      greetingClosing: greetingClosing.trim(),
    };

    const errors = validateVoicePayload(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setPreviewError(null);
    if (!reviewBeforeContinue) {
      savePayload(payload);
      return;
    }
    setReviewing(true);

    const review = await reviewVoiceGreetingStep(payload);
    setReviewing(false);

    if (!review.ok) {
      setFieldErrors({
        ...(review.introIssue ? { greetingIntro: review.message } : {}),
        ...(review.closingIssue ? { greetingClosing: review.message } : {}),
      });
      if (!review.introIssue && !review.closingIssue) {
        setSubmitError(review.message);
      }
      return;
    }

    if (review.status === "suggestions") {
      pendingPayloadRef.current = payload;
      setSuggestion(review);
      setSuggestionOpen(true);
      return;
    }

    savePayload(payload);
  }

  function handleKeepOriginal() {
    const payload = pendingPayloadRef.current;
    setSuggestionOpen(false);
    setSuggestion(null);
    if (payload) {
      savePayload(payload);
    }
  }

  function handleAcceptSuggestion() {
    if (!suggestion) return;

    const nextIntro = suggestion.greetingIntro ?? greetingIntro.trim();
    const nextClosing = suggestion.greetingClosing ?? greetingClosing.trim();
    const payload: SaveVoicePayload = {
      greetingIntro: nextIntro,
      greetingClosing: nextClosing,
    };

    setGreetingIntro(nextIntro);
    setGreetingClosing(nextClosing);
    setSuggestionOpen(false);
    setSuggestion(null);
    savePayload(payload);
  }

  return (
    <>
      <OnboardingFormCard
        fieldSurface="profile"
        noValidate
        onSubmit={handleSubmit}
        error={formLevelError}
        footer={
          visualPreview && !allowEditing ? <Link href="/preview/signup/plans" className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#292929] text-sm font-medium text-white hover:bg-[#151515]">Continue to plans <ArrowRight size={16} aria-hidden /></Link> : <OnboardingPrimaryButton
            type="submit"
            pending={continuePending}
            disabled={visualPreview}
            className={cn("w-full", !allowEditing && "max-w-none bg-[#292929] shadow-none hover:bg-[#151515]")}
          >
            {pending ? "Saving…" : reviewing ? "Checking…" : continueLabel}
            {!continuePending ? (
              <ArrowRight className="size-4" aria-hidden />
            ) : (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
          </OnboardingPrimaryButton>
        }
      >
        <OnboardingEnter tone="profile">
          {!allowEditing ? (
            <SignupVoiceCard
              greeting={highlightBusinessName(previewLine, businessName)}
              playing={playing} loading={previewLoading} error={previewError}
              elapsed={elapsed} onPlay={() => void handlePlayToggle()}
              sample={visualPreview} disabled={continuePending}
            />
          ) : <>
          <section aria-label="Your personalised greeting" className="overflow-hidden rounded-2xl border border-slate-200/75 bg-white">
            <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
              <p className={ONBOARDING_FIELD_LABEL}>Your greeting</p>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-700">
                <p>{highlightBusinessName((greetingIntro.trim() || defaultIntro).replace(/\s*[—–-]\s*$/, ""), businessName)}</p>
                <div className="border-l-2 border-slate-200 pl-3">
                  <p>{legal.slice(0, disclosureBreak)}</p>
                  <p>{legal.slice(disclosureBreak).trim()}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium leading-4 text-slate-500"><Lock className="size-3 shrink-0" aria-hidden />Required disclosure · Not editable</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Included for AI transparency and data protection.</p>
                </div>
                <p>{greetingClosing.trim() || DEFAULT_GREETING_CLOSING}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200/75 px-5 py-5 sm:px-6">
              <button type="button" onClick={() => void handlePlayToggle()} disabled={previewLoading || visualPreview || continuePending} aria-busy={previewLoading} className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-[#0b1220] transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-600 disabled:cursor-default disabled:opacity-50 aria-busy:cursor-wait">
                {previewLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {previewLoading ? "Preparing voice…" : playing ? "Stop playback" : "Hear your greeting"}
              </button>
              <span role="status" className="text-center text-xs text-slate-500">{previewLoading ? "Creating your personalised preview" : playing ? "Playing your greeting" : "Hear exactly what your callers will hear"}</span>
            </div>
            {previewError&&<div className="px-5 pb-4"><AuthFormAlert title="Greeting preview unavailable" message={previewError}/></div>}
          </section>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Business name not sounding quite right? Contact support from your dashboard after signup. Our voice team will fine-tune the pronunciation at no extra cost.
          </p>
          </>}
        </OnboardingEnter>

        {allowEditing ? <>
        <button type="button" aria-expanded={editing || Object.keys(fieldErrors).length > 0} aria-controls="greeting-editor" onClick={() => setEditing(!editing)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-[13px] font-medium text-slate-600 hover:text-[#0b1220] focus-visible:outline-2 focus-visible:outline-slate-600">
          <span className="inline-flex items-center gap-2"><Pencil size={14} aria-hidden />Edit greeting</span>
          <ChevronDown size={15} aria-hidden className={cn("transition-transform", (editing || Object.keys(fieldErrors).length > 0) && "rotate-180")} />
        </button>
        <div id="greeting-editor" hidden={!editing && Object.keys(fieldErrors).length === 0} className="space-y-3">
          <OnboardingFieldBox label="Opening line" htmlFor="greetingIntro" error={fieldErrors.greetingIntro}>
            <input id="greetingIntro" name="greetingIntro" type="text" value={greetingIntro} placeholder={defaultIntro} aria-invalid={Boolean(fieldErrors.greetingIntro)} className={ONBOARDING_FIELD_INPUT} onChange={(event) => { setGreetingIntro(event.target.value); setEditing(true); clearGreetingErrors(); }} />
          </OnboardingFieldBox>
          <OnboardingFieldBox label="Closing line" htmlFor="greetingClosing" error={fieldErrors.greetingClosing}>
            <input id="greetingClosing" name="greetingClosing" type="text" value={greetingClosing} placeholder={DEFAULT_GREETING_CLOSING} aria-invalid={Boolean(fieldErrors.greetingClosing)} className={ONBOARDING_FIELD_INPUT} onChange={(event) => { setGreetingClosing(event.target.value); setEditing(true); clearGreetingErrors(); }} />
          </OnboardingFieldBox>
          <p className="px-2 text-xs leading-5 text-slate-500">Your preview updates as you edit. The required notice stays in place.</p>
        </div>
        </> : null}
      </OnboardingFormCard>

      {suggestion ? (
        <OnboardingVoiceSuggestionDialog
          open={suggestionOpen}
          summary={suggestion.summary}
          introCurrent={greetingIntro.trim()}
          introSuggested={suggestion.greetingIntro}
          closingCurrent={greetingClosing.trim()}
          closingSuggested={suggestion.greetingClosing}
          pending={pending}
          onAccept={handleAcceptSuggestion}
          onKeep={handleKeepOriginal}
        />
      ) : null}
    </>
  );
}

function highlightBusinessName(line: string, businessName: string) {
  const name = businessName.trim();
  const index = name ? line.toLowerCase().indexOf(name.toLowerCase()) : -1;
  if (index < 0) return line;
  return <>{line.slice(0,index)}<strong className="font-semibold">{line.slice(index,index+name.length)}</strong>{line.slice(index+name.length)}</>;
}
