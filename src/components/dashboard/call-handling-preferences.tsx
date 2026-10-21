"use client";
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {smsPricingNotice,type SmsPlanPricing} from "@/lib/sms-plan-pricing";
import {Check} from 'lucide-react';
import type {InputHTMLAttributes,ReactNode} from 'react';
export function CallHandlingPreferences({values,onChange,smsPricing,alertPhoneProps,alertPhoneError}:{alertPhoneProps?:InputHTMLAttributes<HTMLInputElement>;alertPhoneError?:ReactNode;values:Record<string,string>;onChange:(name:string,value:string)=>void;smsPricing?:SmsPlanPricing|null}) {
 const reduced=useReducedMotion();
 function options(name:string,label:string,items:[string,string][]) {return <fieldset className="space-y-2"><legend className="mb-2 text-xs font-medium text-[#353D42]">{label}</legend><div className="flex gap-2">{items.map(([value,text])=>{const checked=values[name]===value;return <button data-setup-toggle type="button" key={value} aria-pressed={checked} onClick={()=>onChange(name,value)} className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${checked?'border-[#353D42] bg-[#f3f6f4] text-[#11181d]':'border-[#d9e2dd] bg-white text-[#5b6b65] hover:border-[#84938c]'}`}>{checked&&<Check size={12} aria-hidden="true"/>}{text}</button>;})}</div></fieldset>;}
 return <div data-call-handling className="flex flex-col gap-2 text-left">
  {options('outsideAvailability','Outside-hours availability',[['closed','No service'],['urgent_only','Urgent enquiries'],['normal','Normal service']])}
  {options('smsAlerts','SMS alerts for caller messages',[['off','Off'],['urgent','Urgent only'],['all_messages','Every message']])}
  <div>
   <AnimatePresence mode="wait" initial={false}>{values.smsAlerts!=='off'?<motion.label key="phone" initial={{opacity:0,y:reduced?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-4}} transition={{duration:reduced?0:0.2}} className="block space-y-1.5 text-xs text-[#5b6b65]"><span>Mobile number for alerts</span><input {...alertPhoneProps} type="tel" aria-label="Mobile number for alerts" autoComplete="tel" inputMode="tel" maxLength={24} value={values.alertPhone} onChange={e=>onChange('alertPhone',e.target.value)} placeholder="087 123 4567" className="h-10 w-full rounded-xl border border-[#d9e2dd] bg-white px-3 text-sm text-[#11181d] outline-none focus:ring-2 focus:ring-[#353D42]/10 aria-invalid:border-[#a13d35]"/>{alertPhoneError}</motion.label>:<motion.p key="automatic" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:0.2}} className="rounded-xl bg-[#f7f9f8] px-3 py-3 text-center text-xs leading-5 text-[#5b6b65] sm:text-left">Messages and urgent enquiries are automatically recorded in your dashboard.</motion.p>}</AnimatePresence>
  </div>
  {values.smsAlerts!=='off'&&<p data-call-handling-note className="mx-auto mt-1 w-full max-w-[440px] self-center whitespace-pre-line text-center text-[11px] leading-4 text-[#63756c]">{values.smsAlerts==='all_messages'?smsPricingNotice(smsPricing):'Alerts are sent after the call. Your alert number stays private.'}</p>}
 </div>;
}
