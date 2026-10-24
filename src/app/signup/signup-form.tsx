"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { AuthTurnstileField } from "@/components/auth/auth-turnstile-field";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { OnboardingFieldBox, OnboardingFieldSurfaceProvider } from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { ONBOARDING_FIELD_INPUT } from "@/components/onboarding/onboarding-ui";
import { LegalAcceptanceCheckbox, LegalDocLink } from "@/components/legal/legal-acceptance-checkbox";
import type { BillingInterval, PlanTier } from "@/lib/cliste-plans.data";
import { cn } from "@/lib/utils";
import { startSignup } from "./actions";
import { useSetupValidation } from "@/components/dashboard/use-setup-validation";

const subscribeToClientReady=()=>()=>{};

type Props = {
  planTier: PlanTier | null; billingInterval: BillingInterval;
  selectedPlanName: string | null; selectedPlanPriceCents: number | null;
  billingIntervalLabel: "monthly" | "annual";
  skipTurnstile?: boolean; onTransitionStart?: () => void;
};

export function SignupForm({ planTier, billingInterval, skipTurnstile = false }: Props) {
  const router = useRouter();
  const clientReady=useSyncExternalStore(subscribeToClientReady,()=>true,()=>false);
  const validation = useSetupValidation();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const [openingNextStep, setOpeningNextStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState(false);
  const turnstile = useRef<TurnstileInstance | null>(null);
  const siteKey = skipTurnstile ? "" : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !validation.validate(event.currentTarget)) return;
    const data = new FormData(event.currentTarget);
    setError(null);
    setOpeningNextStep(false);
    const token = turnstile.current?.getResponse();
    if (siteKey && (!token || turnstile.current?.isExpired())) {
      setSecurityError(true);
      setError("The security check hasn’t finished. Please retry the check below.");
      turnstile.current?.reset();
      return;
    }
    if (token) data.set("turnstileToken", token);
    setPending(true);
    try {
      const result = await startSignup(null, data);
      if (!result.ok) {
        setError(result.message);
        turnstile.current?.reset();
        setPending(false);
        return;
      }
      setOpeningNextStep(true);
      router.push(result.redirectTo);
    } catch {
      setError("We couldn’t create your account. Please try again.");
      turnstile.current?.reset();
      setPending(false);
    }
  }

  return <OnboardingFieldSurfaceProvider surface="default">
    <form data-signup-form method="post" noValidate onChange={event => { if (event.target instanceof HTMLInputElement) validation.clear(event.target.name); }} onSubmit={submit} className="space-y-3">
      <input type="hidden" name="planTier" value={planTier ?? ""} />
      <input type="hidden" name="billingInterval" value={billingInterval} />
      <fieldset disabled={pending||!clientReady} className="min-w-0 space-y-3">
        <div data-signup-identity className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <OnboardingFieldBox label="Your name" htmlFor="signup-name" static className="signup-account-field rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 [&>label]:text-slate-500">
          <input id="signup-name" name="fullName" {...validation.props("fullName")} autoComplete="name" placeholder="Full name" required minLength={2} maxLength={120} className={ONBOARDING_FIELD_INPUT} />
        {validation.error("fullName")}</OnboardingFieldBox>
        <OnboardingFieldBox label="Business name" htmlFor="signup-business" static className="signup-account-field rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 [&>label]:text-slate-500">
          <input id="signup-business" name="businessName" {...validation.props("businessName")} autoComplete="organization" placeholder="Your business name" required minLength={2} maxLength={120} className={ONBOARDING_FIELD_INPUT} />
        {validation.error("businessName")}</OnboardingFieldBox>
        </div>
        <OnboardingFieldBox label="Legal company name" htmlFor="signup-company" static className="signup-account-field rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 [&>label]:text-slate-500">
          <input id="signup-company" name="legalCompanyName" {...validation.props("legalCompanyName")} autoComplete="off" placeholder="e.g. Murphy Services Limited" required minLength={2} maxLength={200} className={ONBOARDING_FIELD_INPUT} />
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Your registered company name, or legal trading name if not incorporated.</p>
        {validation.error("legalCompanyName")}</OnboardingFieldBox>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <OnboardingFieldBox label="Work email" htmlFor="signup-email" static className="signup-account-field rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 [&>label]:text-slate-500">
          <input id="signup-email" name="email" {...validation.props("email")} type="email" autoComplete="email" placeholder="you@business.ie" required className={ONBOARDING_FIELD_INPUT} />
        {validation.error("email")}</OnboardingFieldBox>
        <OnboardingFieldBox label="Password" htmlFor="signup-password" static className="signup-account-field rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 [&>label]:text-slate-500">
          <div className="relative">
            <input id="signup-password" name="password" {...validation.props("password")} type={visible ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" required minLength={8} maxLength={128} className={cn(ONBOARDING_FIELD_INPUT, "pr-12")} />
            <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-500">
              {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </div>
        {validation.error("password")}</OnboardingFieldBox>
        </div>
        <LegalAcceptanceCheckbox id="signup-legal" name="acceptLegal" className="shadow-none border-slate-200 bg-white" inputProps={validation.props("acceptLegal")} required compact>
          I’m authorised to accept the <LegalDocLink href="/legal/terms">Terms of Service</LegalDocLink> and <LegalDocLink href="/legal/dpa">Data Processing Agreement</LegalDocLink> for this business, and acknowledge the <LegalDocLink href="/legal/privacy">Privacy Notice</LegalDocLink>.
          {validation.error("acceptLegal")}
        </LegalAcceptanceCheckbox>
      </fieldset>
      {siteKey ? <AuthTurnstileField ref={turnstile} siteKey={siteKey} onSuccess={() => { setSecurityError(false); setError(null); }} onExpire={() => turnstile.current?.reset()} onError={() => { setSecurityError(true); setError("The security check couldn’t load. Retry it, or refresh this page if the problem continues."); }} /> : null}
      <AuthFormAlert message={error} />
      {securityError ? <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => { setSecurityError(false); setError(null); turnstile.current?.reset(); }}>Retry security check</button> : null}
      <OnboardingPrimaryButton type="submit" pending={pending} disabled={pending||!clientReady} className="w-full max-w-none shadow-none">
        {pending ? openingNextStep ? "Opening the next step…" : "Creating your account…" : "Create account"}<ArrowRight size={16} aria-hidden />
      </OnboardingPrimaryButton>
    </form>
  </OnboardingFieldSurfaceProvider>;
}
