"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
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
  const setupOptions: { value: SetupChoice; label: string; price: string; description: string }[] = [
    { value: "diy", label: "Set up myself", price: "Free", description: "Follow our guided setup." },
    { value: "remote", label: "Remote setup", price: "€199", description: "An engineer fully sets up Cara for your business over a video call." },
    { value: "onsite_dublin", label: "In-person setup", price: "€399", description: "An engineer visits your business, fully sets up Cara and trains your team to use it." },
  ];
  const setupControl = <fieldset disabled={pending} aria-busy={pending} className="min-w-0 text-left">
    <legend className="sr-only">Optional setup help</legend>
    <p aria-hidden="true" className="mb-3 text-sm font-medium text-[#292929]">Optional setup help</p>
    <div className="space-y-5">
      {setupOptions.map((option) => {
        const selected = (checkout.summary.setupTier ?? "diy") === option.value;
        return <label key={option.value} className={`relative flex cursor-pointer items-start gap-3 rounded-[20px] border p-4 sm:p-5 transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none has-[:focus-visible]:border-[#292929] has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#292929] ${selected ? "border-[#292929] ring-1 ring-[#292929]" : "border-[#dedede] hover:border-[#929292]"} bg-white ${pending ? "cursor-wait" : ""}`}>
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
          }} className="sr-only" />
          <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 motion-reduce:transition-none ${selected ? "border-[#292929] bg-[#292929] text-white" : "border-[#b8b8b8]"}`}><Check size={12} strokeWidth={2.5} className={`transition-[opacity,transform] duration-200 motion-reduce:transition-none ${selected ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} /></span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium leading-5 text-[#292929]">{option.label}{option.value === "remote" && <span className="absolute -top-2.5 left-4 rounded-full bg-[#eeeeee] px-2.5 py-0.5 text-[10px] font-medium leading-4 text-[#444444]">Recommended</span>}</span>
            <span className="mt-1.5 block text-xs leading-5 text-[#626262]">{option.description}</span>
          </span>
          <span className="flex min-w-[66px] shrink-0 flex-col items-end gap-1 pl-1">
            <span className="text-xl font-semibold leading-6 tracking-tight text-[#292929]">{option.price}</span>
            <span className="text-[11px] text-[#626262]">{option.value === "diy" ? "No setup fee" : "One-off"}</span>
          </span>
        </label>;
      })}
    </div>
    {pending ? <p role="status" className="sr-only">Updating billing…</p> : null}
    <AuthFormAlert message={error}/>
  </fieldset>;
  return <PlanCheckoutFlow initialPaymentStep={!setupPreviewOnly && preview && initialPaymentStep} {...checkout} continueHref={previewContinueHref??"/dashboard?welcome=1"} onPersist={onPersist} configureAfterCheckout={!preview||Boolean(previewContinueHref)} setupControl={setupControl} setupBusy={pending || setupPreviewOnly} />;
}
