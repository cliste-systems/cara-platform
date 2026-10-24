"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import {
  ClisteCheckoutSubmitButton,
  type CheckoutSubmitPhase,
} from "@/components/billing/cliste-checkout-submit-button";
import {
  ONBOARDING_FIELD_LABEL,
  ONBOARDING_SELECTION_CARD,
} from "@/components/onboarding/onboarding-ui";
import type { PlatformElementsCheckoutSummary } from "@/lib/platform-billing-elements";
import {
  CLISTE_STRIPE_APPEARANCE,
  CLISTE_STRIPE_FONTS,
} from "@/lib/stripe-elements-theme";
import { getStripeJs } from "@/lib/stripe-publishable";
import { cn } from "@/lib/utils";
import { checkoutFeedback, type CheckoutFeedback as Feedback } from "@/lib/checkout-feedback";
import { CheckoutFeedback } from "./checkout-feedback";
import { FormFeedback } from "@/components/ui/form-feedback";

const SUCCESS_HOLD_MS = 900;

type Props = {
  initialFeedback?: Feedback;
  openingSetup?: boolean;
  paymentOnly?: boolean;
  onBusyChange?: (busy: boolean) => void;
  setupControl?:ReactNode;
  setupBusy?:boolean;
  clientSecret: string;
  subscriptionId: string;
  summary: PlatformElementsCheckoutSummary;
  returnUrl: string;
  onPersist?: (subscriptionId: string, setupIntentId?: string) => Promise<void>;
  onActivated: () => void;
};

export function ClisteStripeCheckoutForm({
  clientSecret,
  subscriptionId,
  summary,
  returnUrl,
  onPersist,
  onActivated,
  setupControl,
  setupBusy,
  paymentOnly,
  onBusyChange,
  openingSetup,
}: Props) {
  return (
    <Elements
      stripe={getStripeJs()}
      options={{
        clientSecret,
        appearance: CLISTE_STRIPE_APPEARANCE,
        fonts: CLISTE_STRIPE_FONTS,
      }}
    >
      <CheckoutFormInner
        setupControl={setupControl}
        setupBusy={setupBusy}
        openingSetup={openingSetup}
        paymentOnly={paymentOnly}
        onBusyChange={onBusyChange}
        subscriptionId={subscriptionId}
        summary={summary}
        returnUrl={returnUrl}
        onPersist={onPersist}
        onActivated={onActivated}
      />
    </Elements>
  );
}

export function CheckoutFormInner({
  initialFeedback,
  subscriptionId,
  summary,
  returnUrl,
  onPersist,
  onActivated,
  setupControl,
  setupBusy,
  paymentOnly,
  onBusyChange,
  openingSetup = false,
}: Omit<Props, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitPhase, setSubmitPhase] = useState<CheckoutSubmitPhase>("idle");
  const [error, setError] = useState<Feedback | null>(initialFeedback ?? null);
  useEffect(() => { onBusyChange?.(submitPhase !== "idle"); }, [onBusyChange, submitPhase]);
  const confirmedIntentId = useRef<string | null>(null);
  const paymentFieldsRef = useRef<HTMLDivElement>(null);
  const [paymentInvalid, setPaymentInvalid] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [elementStatus, setElementStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [elementAttempt, setElementAttempt] = useState(0);
  const elementReady = elementStatus === "ready";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || setupBusy || submitPhase !== "idle") return;

    setSubmitPhase("loading");
    setError(null);

    try {
      if (!confirmedIntentId.current) {
        const { error: submitError } = await elements.submit();
        if (submitError) {
          setPaymentInvalid(true);
          paymentFieldsRef.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
          setSubmitPhase("idle");
          return;
        }

        const { error: confirmError, setupIntent } = await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: "if_required",
        });
        if (confirmError) {
          setError(checkoutFeedback("confirmation", confirmError));
          setSubmitPhase("idle");
          return;
        }
        if (setupIntent?.status !== "succeeded") {
          setError({title:"We’re confirming your card",message:"Your payment method hasn’t been confirmed yet. Please try again to continue.",retryLabel:"Try again"});
          setSubmitPhase("idle");
          return;
        }
        confirmedIntentId.current = setupIntent.id;
        setCardSaved(true);
      }
      await onPersist?.(subscriptionId, confirmedIntentId.current);
      setSubmitPhase("success");
      window.setTimeout(() => {
        onActivated();
      }, SUCCESS_HOLD_MS);
    } catch {
      setError(checkoutFeedback(confirmedIntentId.current ? "workspace" : "connection"));
      setSubmitPhase("idle");
    }
  }

  return (
    <form data-payment-only={paymentOnly || undefined} noValidate onSubmit={handleSubmit} className={cn("w-full space-y-3", paymentOnly && "lg:space-y-2")}>
      {paymentOnly ? <CheckoutPaymentSummary summary={summary} /> : <CheckoutPlanSummary summary={summary} setupControl={setupControl} />}

      <div ref={paymentFieldsRef} data-payment-invalid={paymentInvalid || undefined} data-payment-fields className="w-full py-2">
        <p className={ONBOARDING_FIELD_LABEL}>Payment method</p>
        <div aria-busy={elementStatus === "loading"} className="cliste-stripe-payment-element relative mt-3 min-h-[220px]">
          {!elementReady && <div role={elementStatus === "failed" ? undefined : "status"} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white px-4 text-center text-xs text-[#626262]">
            {elementStatus === "failed" ? <><FormFeedback title="Payment form unavailable" message="We couldn’t load the secure payment form. Please try again."/><button type="button" className="min-h-11 cursor-pointer rounded-full border border-slate-200 px-5 text-[#292929] transition-colors hover:bg-slate-50" onClick={() => { setElementStatus("loading"); setElementAttempt(value => value + 1); }}>Try again</button></> : <p className="flex items-center gap-2"><Loader2 size={16} className="animate-spin motion-reduce:animate-none"/>Preparing your secure payment form…</p>}
          </div>}
          <PaymentElement
            key={elementAttempt}
            onReady={() => setElementStatus("ready")}
            onChange={() => setPaymentInvalid(false)}
            onLoadError={() => setElementStatus("failed")}
            options={{
              paymentMethodOrder: ["card"],
              layout: paymentOnly ? { type: "tabs" } : {
                type: "accordion",
                defaultCollapsed: false,
                radios: "always",
                spacedAccordionItems: true,
                visibleAccordionItemsCount: 1,
              },
              wallets: {
                applePay: "never",
                googlePay: "never",
                link: "never",
              },
            }}
          />
        </div>
      </div>

      <CheckoutFeedback feedback={error} cardSaved={cardSaved} onEditPayment={() => {
        setError(null);
        elements?.getElement("payment")?.focus();
        paymentFieldsRef.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }} />

      <ClisteCheckoutSubmitButton
        phase={openingSetup ? "loading" : submitPhase}
        idleLabel={error?.retryLabel}
        loadingLabel={openingSetup ? "Opening Cara setup…" : cardSaved ? "Finishing your signup…" : undefined}
        trialDays={summary.trialDays}
        disabled={!stripe || !elements || !elementReady || setupBusy || openingSetup}
      />

      <p data-checkout-postscript className="pb-3 text-center text-[11px] leading-snug text-slate-500">
        Cancel anytime in Settings. Payment details are securely handled by Stripe.
      </p>
    </form>
  );
}

export function CheckoutPaymentSummary({summary}:{summary:PlatformElementsCheckoutSummary}) {
  const [setupName, setupCharge] = summary.setupLabel?.split(" · ") ?? [];
  const setupPrice = setupCharge?.split(",")[0]?.replace(/ once$/, "");
  return (
    <section data-checkout-payment-summary aria-label="Your billing summary" className="rounded-[20px] bg-[#f5f5f5] px-4 pt-4 pb-3 text-left text-[#292929]">
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-medium">{summary.planName} plan</dt>
          <dd className="shrink-0 text-right"><span className="text-base font-semibold">{summary.amountLabel}</span><span className="ml-1 text-xs text-[#626262]">/ {summary.intervalLabel}</span></dd>
        </div>
        {setupName && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-medium">{setupName}</dt>
            <dd className="shrink-0 text-right"><span className="text-base font-semibold">{setupPrice}</span><span className="ml-1 text-xs text-[#626262]">one-off</span></dd>
          </div>
        )}
      </dl>
      <div className="mt-3 border-t border-[#dedede] pt-3 text-xs leading-5">
        <p>{setupName ? "Both charges are" : "Your first payment is"} due when your {summary.trialDays}-day free trial ends.</p>
      </div>
    </section>
  );
}

export function CheckoutPlanSummary({
  summary,
  setupControl,
}: {
  summary: PlatformElementsCheckoutSummary;
  setupControl?:ReactNode;
}) {
  return (
    <div className={cn(ONBOARDING_SELECTION_CARD, setupControl ? "px-5 py-3 sm:px-6" : "px-5 py-4 sm:px-6")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={ONBOARDING_FIELD_LABEL}>Your plan</p>
          <p className="mt-1.5 text-[1.125rem] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[1.25rem]">
            {summary.planName}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-slate-500">
            {summary.amountLabel}/{summary.intervalLabel} after your trial
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-medium leading-none text-[#0b1220]">
          {summary.trialDays} days free
        </span>
      </div>

      {setupControl}
      {summary.setupLabel ? <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-4 text-slate-600">{summary.setupLabel}</p> : null}
      <div className={setupControl ? "mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-slate-200/70 pt-3" : "mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3"}>
        <p className={ONBOARDING_FIELD_LABEL}>Billing email</p>
        <p
          className={setupControl ? "min-w-0 truncate text-xs font-medium text-[#0b1220]" : "mt-1 truncate text-[14px] font-medium text-[#0b1220]"}
          title={summary.email}
        >
          {summary.email}
        </p>
      </div>
    </div>
  );
}
