"use client";
import {useState,useTransition} from 'react';
import type {OutsideHoursPolicy} from '@/lib/outside-hours-policy';
import {CallHandlingPreferences} from './call-handling-preferences';
import {saveCallHandlingPreferences} from '@/app/(dashboard)/dashboard/settings/call-handling-actions';
export function CallHandlingPreferencesEditor({initial,smsPricing}:{initial:OutsideHoursPolicy;smsPricing?:import("@/lib/sms-plan-pricing").SmsPlanPricing|null}) {
 const [values,setValues]=useState({outsideAvailability:initial.availability,smsAlerts:initial.sms,alertPhone:initial.phone});
 const [pending,start]=useTransition();
 const [message,setMessage]=useState('');
 return <div className="max-w-xl space-y-4"><fieldset disabled={pending}><CallHandlingPreferences smsPricing={smsPricing} values={values} onChange={(name,value)=>{setMessage('');setValues(previous=>({...previous,[name]:value}));}}/></fieldset><button type="button" disabled={pending} onClick={()=>start(async()=>{const result=await saveCallHandlingPreferences(values);setMessage(result.ok?'Call preferences saved.':result.message);})} className="min-h-10 rounded-full bg-[#353D42] px-5 text-xs font-medium text-white disabled:opacity-50">{pending?'Saving…':'Save call preferences'}</button>{message&&<p role="status" className="text-xs text-[#5b6b65]">{message}</p>}</div>;
}
