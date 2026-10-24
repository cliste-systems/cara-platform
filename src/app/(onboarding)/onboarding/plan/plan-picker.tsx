"use client";

import Link from "next/link";
import {AuthFormAlert} from "@/components/auth/auth-form-alert";
import { useActionState, useState, type FormEvent } from "react";
import { ArrowRight, Check, Phone, MessageSquare } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  LegalAcceptanceCheckbox,
  LegalDocLink,
} from "@/components/legal/legal-acceptance-checkbox";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import {
  ONBOARDING_SELECTION_CARD,
  ONBOARDING_SELECTION_CARD_ACTIVE,
  ONBOARDING_PRIMARY_BUTTON,
} from "@/components/onboarding/onboarding-ui";
import { CLISTE_COMPANY, PRODUCT_NAME } from "@/lib/company-details";
import { cn } from "@/lib/utils";
import type { BillingInterval, PlanTier } from "@/lib/cliste-plans";

import { startPlanCheckout } from "../actions";

type PlanRow = {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyCents: number;
  annualCents: number;
  includedMinutes: number;
  includedSms: number;
  overageRateCents: number;
  smsOverageRateCents: number;
  applicationFeeBps: number;
  features: string[];
  recommended: boolean;
  selfServe: boolean;
};

type Props = {
  plans: PlanRow[];
  defaultPlan: PlanTier;
  defaultInterval: BillingInterval;
  initialError?: string | null;
  /** Dev preview — Continue navigates here instead of starting checkout. */
  previewCheckoutPath?: string;
  checkoutAction?: (previous: { ok: false; message: string }, formData: FormData) => Promise<{ ok: false; message: string }>;
  configureAfterCheckout?: boolean;
  requiresDpaAcceptance?: boolean;
};

const INITIAL = { ok: false as const, message: "" };
const CUSTOM_MAILTO =
  `mailto:${CLISTE_COMPANY.helloEmail}?subject=${encodeURIComponent(`${PRODUCT_NAME} Custom plan`)}`;

type LegalHighlight = {
  acceptDpa: boolean;
  acceptCallerPrivacy: boolean;
};

const LEGAL_HIGHLIGHT_INITIAL: LegalHighlight = {
  acceptDpa: false,
  acceptCallerPrivacy: false,
};

function legalHighlightFromMessage(message: string): LegalHighlight {
  return {
    acceptDpa: message.includes("Data Processing Agreement"),
    acceptCallerPrivacy: message.toLowerCase().includes("caller privacy"),
  };
}

const LEGAL_FIELD_ERROR_RING =
  "border-red-300/90 bg-red-50/70 ring-1 ring-red-200";

export function PlanPicker({
  plans,
  defaultPlan,
  defaultInterval,
  initialError,
  previewCheckoutPath,
  checkoutAction = startPlanCheckout,
  configureAfterCheckout = false,
  requiresDpaAcceptance = !configureAfterCheckout,
}: Props) {
  const selfServePlans = plans.filter((p) => p.selfServe);
  const customPlan = plans.find((p) => !p.selfServe);

  const defaultSelfServe =
    selfServePlans.find((p) => p.tier === defaultPlan)?.tier ??
    selfServePlans.find((p) => p.recommended)?.tier ??
    selfServePlans[0]?.tier ??
    "pro";

  const [plan, setPlan] = useState<PlanTier>(defaultSelfServe);
  const [interval, setInterval] = useState<BillingInterval>(configureAfterCheckout ? "month" : defaultInterval);
  const [submittingTier, setSubmittingTier] = useState<PlanTier | null>(null);
  const [legalHighlight, setLegalHighlight] = useState<LegalHighlight>(
    LEGAL_HIGHLIGHT_INITIAL,
  );
  const reduceMotion = useReducedMotion();

  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: false; message: string }, formData: FormData) => {
      const result = await checkoutAction(_prev, formData);
      setLegalHighlight(legalHighlightFromMessage(result.message));
      return result;
    },
    INITIAL,
  );

  const errorMessage =
    (!state.ok && state.message ? state.message : null) ??
    (initialError
      ? "We couldn't confirm your payment. Please try again."
      : null);
  const legalErrorFromMessage = errorMessage
    ? legalHighlightFromMessage(errorMessage)
    : null;
  const isPaymentError =
    Boolean(errorMessage) &&
    !legalErrorFromMessage?.acceptDpa &&
    !legalErrorFromMessage?.acceptCallerPrivacy;


  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const dpaChecked = (
      form.elements.namedItem("acceptDpa") as HTMLInputElement | null
    )?.checked;
    const privacyChecked = (
      form.elements.namedItem("acceptCallerPrivacy") as HTMLInputElement | null
    )?.checked;

    const next: LegalHighlight = {
      acceptDpa: requiresDpaAcceptance && !dpaChecked,
      acceptCallerPrivacy: !configureAfterCheckout && !privacyChecked,
    };

    if (next.acceptDpa || next.acceptCallerPrivacy) {
      event.preventDefault();
      setLegalHighlight(next);
      return;
    }

    setLegalHighlight(LEGAL_HIGHLIGHT_INITIAL);
  }

  if (configureAfterCheckout && !requiresDpaAcceptance) {
    const selectedPlan = selfServePlans.find(p => p.tier === plan);
    const sharedFeatures = selfServePlans[0]?.features.filter(feature => selfServePlans.every(p => p.features.includes(feature))) ?? [];
    return (
      <form action={formAction} onSubmit={handleSubmit} className="w-full space-y-5">
        <input type="hidden" name="interval" value="month" />
        <fieldset disabled={pending} className="min-w-0">
          <legend className="sr-only">Choose your monthly plan</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {selfServePlans.map(p => {
              const selected = plan === p.tier;
              return <label key={p.tier} className={cn("relative flex cursor-pointer flex-col rounded-[20px] border bg-white p-5 text-left transition-[border-color,box-shadow] duration-200 has-[:focus-visible]:border-[#292929] has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#292929]", selected ? "border-[#292929] ring-1 ring-[#292929]" : "border-[#dedede] hover:border-[#929292]", pending && "cursor-wait opacity-70")}>
                <input className="sr-only" type="radio" name="planTier" value={p.tier} checked={selected} onChange={() => setPlan(p.tier)} />
                <div className="flex items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-[#292929]">{p.name}{p.recommended && <span className="rounded-full bg-[#eeeeee] px-2 py-1 text-[10px] font-medium text-[#444444]">Most Popular</span>}</span>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border", selected ? "border-[#292929] bg-[#292929] text-white" : "border-[#b8b8b8]")} aria-hidden>{selected && <Check size={12} strokeWidth={2.5} />}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#626262] md:min-h-[40px]">{p.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1.5"><span className="text-[32px] font-semibold tracking-tight text-[#292929]">{formatEuro(p.monthlyCents)}</span><span className="text-xs text-[#626262]">/ month</span></div>
                <div className="mt-4 space-y-2.5 border-t border-[#e5e5e5] pt-4">
                  <p className="flex items-center gap-2 text-sm text-[#292929]"><Phone size={15} aria-hidden /><strong className="font-medium">{p.includedMinutes.toLocaleString()} minutes</strong><span className="text-xs text-[#626262]">/ month</span></p>
                  <p className="flex items-center gap-2 text-sm text-[#292929]"><MessageSquare size={15} aria-hidden /><strong className="font-medium">{p.includedSms.toLocaleString()} SMS</strong><span className="text-xs text-[#626262]">/ month</span></p>
                  <p className="text-[11px] leading-5 text-[#626262]">Extra usage: {formatEuro(p.overageRateCents)}/min · {formatEuro(p.smsOverageRateCents)}/SMS</p>
                  <p className="text-[11px] leading-5 text-[#626262]">Around {Math.floor(p.includedMinutes / 2).toLocaleString()} calls at 2 minutes each</p>
                </div>
                {p.features.filter(f => !sharedFeatures.includes(f)).map(f => <p key={f} className="mt-2 text-xs text-[#626262]">{f}</p>)}
                <div className="mt-4 space-y-2.5 border-t border-[#e5e5e5] pt-4">
                  {[
                    { text: "Cara answers your calls 24/7" },
                    { text: "Transcripts, summaries & callbacks" },
                    { text: "Knowledge Base & dashboard" },
                    { text: "Keep your number with call forwarding" },
                  ].map(({ text }) => <p key={text} className="flex items-start gap-2 text-xs leading-5 text-[#626262]"><Check size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#292929]" aria-hidden /><span>{text}</span></p>)}
                </div>

              </label>;
            })}
          </div>
        </fieldset>
        <AuthFormAlert title="Plan could not be continued" message={errorMessage} />
        <div className="mx-auto w-full max-w-[600px] space-y-3">
          {previewCheckoutPath ? <Link href={`${previewCheckoutPath}?plan=${plan}`} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#292929] px-5 text-sm font-medium text-white transition-colors hover:bg-[#151515]">Continue to setup options <ArrowRight size={16} aria-hidden /></Link>
            : <OnboardingPrimaryButton type="submit" disabled={pending} pending={pending} className="w-full max-w-none bg-[#292929] shadow-none hover:bg-[#151515]">{pending ? "Continuing…" : "Continue to setup options"}{!pending && <ArrowRight size={16} aria-hidden />}</OnboardingPrimaryButton>}
          <p role="status" className="text-center text-xs text-[#626262]">{selectedPlan?.name} selected · {formatEuro(selectedPlan?.monthlyCents ?? 0)}/month after your trial</p>
        </div>

      </form>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className={cn("flex w-full flex-col items-center text-center", configureAfterCheckout ? "gap-3" : "gap-4 sm:gap-5")}
    >
      <input type="hidden" name="interval" value={interval} />

      {configureAfterCheckout ? null : <>
      <div className="inline-flex rounded-full border border-slate-200/75 bg-white p-1 text-xs font-medium shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={() => setInterval("month")}
          className={cn(
            "cursor-pointer rounded-full px-4 py-1.5 transition",
            interval === "month"
              ? "bg-[#0b1220] text-white"
              : "text-slate-600",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("year")}
          className={cn(
            "cursor-pointer rounded-full px-4 py-1.5 transition",
            interval === "year"
              ? "bg-[#0b1220] text-white"
              : "text-slate-600",
          )}
        >
          Annual{" "}
          <span className="text-[10px] font-normal opacity-80">
            (2 months free)
          </span>
        </button>
      </div>
      </>}

      <div className="grid w-full gap-4 md:grid-cols-3 md:items-stretch">
        {selfServePlans.map((p) => {
          const selected = plan === p.tier;
          const popular = p.recommended;
          const isSubmitting = pending && submittingTier === p.tier;

          return (
            <div
              key={p.tier}
              className={cn(
                "flex min-h-[22rem] flex-col p-5 transition-[border-color,box-shadow,transform,min-height] duration-300 ease-out sm:min-h-[23.5rem] sm:p-6",
                configureAfterCheckout && "min-h-0 sm:min-h-0 sm:p-5",
                ONBOARDING_SELECTION_CARD,
                popular &&
                  "border-[#0b1220]/20 shadow-[0_10px_32px_rgba(11,18,32,0.1)]",
                popular &&
                  selected &&
                  "border-[#0b1220]/30 shadow-[0_14px_40px_rgba(11,18,32,0.14)] ring-1 ring-[#0b1220]/12",
                !popular && selected && ONBOARDING_SELECTION_CARD_ACTIVE,
              )}
            >
              <button
                type="button"
                onClick={() => setPlan(p.tier)}
                aria-pressed={selected}
                className="flex flex-1 flex-col text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-medium text-[#0b1220]">
                    {p.name}
                  </span>
                  {popular ? (
                    <span className="shrink-0 rounded-full bg-[#0b1220] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                      Recommended
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-[12px] font-light leading-snug text-slate-500">
                  {p.tagline}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <motion.span
                    key={`${p.tier}-${interval}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: ONBOARDING_EASE }}
                    className="text-[1.875rem] font-light leading-none tracking-tight text-[#0b1220] sm:text-[2rem]"
                  >
                    {formatEuro(
                      interval === "year" ? p.annualCents / 12 : p.monthlyCents,
                    )}
                  </motion.span>
                  <span className="text-xs font-light text-slate-500">/mo</span>
                </div>

                <AnimatePresence initial={false}>
                  {interval === "year" ? (
                    <motion.div
                      key={`${p.tier}-annual-billed`}
                      initial={
                        reduceMotion
                          ? false
                          : { height: 0, opacity: 0, marginTop: 0 }
                      }
                      animate={{ height: "auto", opacity: 1, marginTop: 4 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                      className="overflow-hidden"
                    >
                      <p className="text-[11px] font-light text-slate-400">
                        Billed {formatEuro(p.annualCents)}/yr
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <motion.div
                  layout={!reduceMotion}
                  transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                  className="mt-4 space-y-2 border-t border-slate-100 pt-4"
                >
                  <p className="text-[12px] font-medium text-slate-600">
                    {p.includedMinutes.toLocaleString()} minutes / month
                    {!configureAfterCheckout ? <> · {p.includedSms.toLocaleString()} SMS</> : null}
                  </p>
                  {configureAfterCheckout ? <p className="text-xs leading-5 text-slate-600">≈{Math.floor(p.includedMinutes / 2).toLocaleString()} calls/month · ≈{Math.round(p.includedMinutes / 60)} calls/day</p> : null}
                  <p className="text-[11px] text-slate-500">
                    {formatEuro(p.overageRateCents)}/min after your allowance
                    {!configureAfterCheckout ? <> · {formatEuro(p.smsOverageRateCents)}/SMS overage</> : null}
                  </p>
                </motion.div>

                <motion.ul
                  layout={!reduceMotion}
                  transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                  className="mt-4 w-full space-y-2 border-t border-slate-100 pl-0 pt-4 text-left text-[12px] font-light leading-snug text-slate-600"
                >
                  {p.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </motion.ul>
              </button>

              <motion.div
                layout={!reduceMotion}
                transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                className="w-full"
              >
              <PlanContinueButton
                tier={p.tier}
                disabled={pending}
                isSubmitting={isSubmitting}
                previewHref={previewCheckoutPath ? `${previewCheckoutPath}?plan=${p.tier}` : undefined}
                onContinue={() => {
                  setPlan(p.tier);
                  setSubmittingTier(p.tier);
                }}
              />
              </motion.div>
            </div>
          );
        })}
      </div>

      {customPlan ? (
        <div className="flex w-full flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200/75 bg-white/85 px-5 py-4 text-left shadow-[0_4px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0 space-y-1 sm:text-left">
            <p className="text-[14px] font-medium text-[#0b1220]">
              {customPlan.name} — talk to our team
            </p>
            <p className="text-[13px] font-light leading-relaxed text-slate-500">
              {customPlan.tagline}
            </p>
          </div>
          <Link
            href={CUSTOM_MAILTO}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-5 text-[13px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-[#0b1220]"
          >
            Talk to our team
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <div className={cn("grid w-full gap-2.5", !configureAfterCheckout && "md:grid-cols-2 md:items-stretch", configureAfterCheckout && !requiresDpaAcceptance && "hidden")}>
        {!configureAfterCheckout ? <>
        <LegalAcceptanceCheckbox
          id="acceptCallerPrivacy"
          name="acceptCallerPrivacy"
          required={false}
          compact
          onCheckedChange={() =>
            setLegalHighlight((prev) => ({ ...prev, acceptCallerPrivacy: false }))
          }
          className={cn(
            "h-full self-stretch",
            legalHighlight.acceptCallerPrivacy && LEGAL_FIELD_ERROR_RING,
          )}
        >
          I confirm I have added (or will display before go-live) caller privacy
          information on my website or in my premises — including that calls may be
          handled by an AI assistant and may be recorded and transcribed.{" "}
          <LegalDocLink href="/dashboard/legal/caller-notice">
            View templates
          </LegalDocLink>
          .
        </LegalAcceptanceCheckbox>

        </> : null}
        {requiresDpaAcceptance ? <>
        <LegalAcceptanceCheckbox
          id="acceptDpa"
          name="acceptDpa"
          required={false}
          compact
          onCheckedChange={() =>
            setLegalHighlight((prev) => ({ ...prev, acceptDpa: false }))
          }
          className={cn(
            "h-full self-stretch",
            legalHighlight.acceptDpa && LEGAL_FIELD_ERROR_RING,
          )}
        >
          I’m authorised to accept the{" "}
          <LegalDocLink href="/legal/dpa">Data Processing Agreement</LegalDocLink>{" "}
          so {PRODUCT_NAME} may process my callers&apos; data when I go live.
        </LegalAcceptanceCheckbox>
        </> : null}
      </div>

      {configureAfterCheckout ? <p className="text-[11px] leading-5 text-slate-500">Call estimates assume 2-minute calls across 30 days; actual call length varies.</p> : null}

      <AuthFormAlert title="Plan could not be continued" message={isPaymentError?errorMessage:null}/>

    </form>
  );
}

function formatEuro(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return `€${value}`;
  return `€${value.toFixed(2)}`;
}

function PlanContinueButton({
  tier,
  disabled,
  isSubmitting,
  previewHref,
  onContinue,
}: {
  tier: PlanTier;
  disabled: boolean;
  isSubmitting: boolean;
  previewHref?: string;
  onContinue: () => void;
}) {
  if (previewHref) {
    return (
      <Link
        href={previewHref}
        onClick={onContinue}
        className={cn(ONBOARDING_PRIMARY_BUTTON, "mt-4 w-full px-4 text-[13px]")}
      >
        Continue
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    );
  }

  return (
    <OnboardingPrimaryButton
      type="submit"
      name="planTier"
      value={tier}
      disabled={disabled}
      pending={isSubmitting}
      onClick={onContinue}
      className="mt-4 w-full px-4 text-[13px]"
    >
      {isSubmitting ? "Continuing…" : "Continue"}
      {!isSubmitting ? <ArrowRight className="size-3.5" aria-hidden /> : null}
    </OnboardingPrimaryButton>
  );
}
