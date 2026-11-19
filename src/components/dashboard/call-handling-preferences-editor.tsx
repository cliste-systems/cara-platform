"use client";
import {useState,useTransition} from "react";
import type {OutsideHoursPolicy} from "@/lib/outside-hours-policy";
import {CallHandlingPreferences} from "./call-handling-preferences";
import {UnsavedDraftGuard} from "./unsaved-draft-guard";
import {FormFeedback} from "@/components/ui/form-feedback";
import {Button} from "@/components/ui/button";
import {saveCallHandlingPreferences} from "@/app/(dashboard)/dashboard/settings/call-handling-actions";
export function CallHandlingPreferencesEditor({initial,smsPricing}:{initial:OutsideHoursPolicy;smsPricing?:import("@/lib/sms-plan-pricing").SmsPlanPricing|null}) {
 const [values,setValues]=useState({outsideAvailability:initial.availability,smsAlerts:initial.sms,alertPhone:initial.phone});
 const [saved,setSaved]=useState(values);
 const [pending,start]=useTransition();
 const [error,setError]=useState<string|null>(null);
 const dirty=JSON.stringify(values)!==JSON.stringify(saved);
 return <div className="max-w-xl space-y-4"><UnsavedDraftGuard dirty={dirty&&!pending}/><FormFeedback message={error} focusOnError/><fieldset disabled={pending}><CallHandlingPreferences smsPricing={smsPricing} values={values} onChange={(name,value)=>{setError(null);setValues(previous=>({...previous,[name]:value}));}}/></fieldset><Button type="button" disabled={pending||!dirty} onClick={()=>start(async()=>{setError(null);try {const result=await saveCallHandlingPreferences(values);if(result.ok)setSaved(values);else setError(result.message);} catch {setError("We couldn’t update your preferences. Your changes are still here. Please try again.");}})}>{pending?"Saving…":"Save call preferences"}</Button></div>;
}
