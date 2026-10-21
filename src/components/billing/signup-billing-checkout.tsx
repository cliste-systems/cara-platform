"use client";

import { useId, useState, useTransition } from "react";
import { PlanCheckoutFlow } from "./plan-checkout-flow";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import type { PlatformElementsCheckoutSummary } from "@/lib/platform-billing-elements";

export type SetupChoice = "diy" | "remote" | "onsite_dublin";
export type SignupCheckoutData = {clientSecret:string;subscriptionId:string;summary:PlatformElementsCheckoutSummary;returnUrl:string};
export type SetupUpdateResult = ({ok:true} & SignupCheckoutData) | {ok:false;message:string};

export function SignupBillingCheckout({initialCheckout,onSetupChange,onPersist,preview=false,initialPaymentStep=false,previewContinueHref,setupPreviewOnly=false}: {
  initialCheckout:SignupCheckoutData;
  onSetupChange:(choice:SetupChoice)=>Promise<SetupUpdateResult>;
  onPersist?:(subscriptionId:string,setupIntentId?:string)=>Promise<void>;
  preview?:boolean;
  previewContinueHref?:string;
  initialPaymentStep?:boolean;
  /** Local design review: allow setup choices, never initialize payment. */
  setupPreviewOnly?:boolean;
}) {
  const [checkout,setCheckout]=useState(initialCheckout);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const [coverageOpen, setCoverageOpen] = useState(false);
  const coverageId = useId();
  const setupOptions: { value: SetupChoice; label: string; price: string; description: string }[] = [
    { value: "diy", label: "Set up myself", price: "Free", description: "Configure Cara yourself in your dashboard." },
    { value: "remote", label: "Remote setup", price: "€199 once", description: "An online meeting with our engineer to set up Cara remotely and walk you through your dashboard." },
    { value: "onsite_dublin", label: "In-person setup", price: "€399 once", description: "Our engineer visits your business to set up Cara and walk you through your dashboard in person." },
  ];
  const setupControl = <fieldset disabled={pending} aria-busy={pending} className="mt-3 border-t border-slate-200/70 pt-3">
    <legend className="sr-only">Optional setup help</legend>
    <p aria-hidden="true" className="mb-2 text-xs font-medium text-slate-600">Optional setup help</p>
    <div className="divide-y divide-slate-200/70 border-y border-slate-200/70">
      {setupOptions.map((option) => {
        const selected = (checkout.summary.setupTier ?? "diy") === option.value;
        return <label key={option.value} className={`relative flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-500 ${selected ? "bg-slate-50" : "bg-white"} ${pending ? "cursor-wait opacity-60" : ""}`}>
          <input type="radio" name="billing_setup" value={option.value} checked={selected} onChange={() => {
            setError("");
            startTransition(async () => {
              try {
                const result = await onSetupChange(option.value);
                if (result.ok) setCheckout(result);
                else setError(result.message);
              } catch {
                setError("Setup options could not be updated. Please try again.");
              }
            });
          }} className="mt-0.5 size-4 shrink-0 appearance-none rounded-full border border-slate-300 bg-white checked:border-[5px] checked:border-[#0b1220] focus:outline-none" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs leading-5">
              <span className="font-medium text-[#0b1220]">{option.label}</span>
              <span className="shrink-0 text-slate-600">{option.price}</span>
            </span>
            <span className="mt-1 block text-xs leading-[1.5] text-slate-500">{option.description}</span>
          </span>
        </label>;
      })}
    </div>
    <div className="mt-3 text-[11px] leading-[1.6] text-slate-500">
      <button type="button" aria-expanded={coverageOpen} aria-controls={coverageId} onClick={() => setCoverageOpen((open) => !open)} className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600 underline decoration-slate-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-500">
        View in-person coverage
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`size-3 transition-transform duration-300 motion-reduce:transition-none ${coverageOpen ? "rotate-180" : ""}`}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id={coverageId} aria-hidden={!coverageOpen} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${coverageOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <p className="pt-2">Donegal, Sligo, Leitrim, Mayo, Roscommon, Longford, Cavan, Monaghan, Westmeath, Meath, Louth, Dublin and Galway. Your location will be confirmed before your in-person setup booking is finalised.</p>
        </div>
      </div>
    </div>
    {pending ? <p role="status" className="mt-2 text-xs text-slate-500">Updating billing…</p> : null}
    <AuthFormAlert message={error}/>
  </fieldset>;
  return <PlanCheckoutFlow key={`${checkout.subscriptionId}-${initialPaymentStep}`} initialPaymentStep={!setupPreviewOnly && preview && initialPaymentStep} {...checkout} continueHref={previewContinueHref??"/dashboard?welcome=1"} onPersist={onPersist} configureAfterCheckout={!preview||Boolean(previewContinueHref)} setupControl={setupControl} setupBusy={pending || setupPreviewOnly} />;
}
