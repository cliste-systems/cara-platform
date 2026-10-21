"use client";
import {useSetupDraft,type RememberSetupDraft} from "./use-setup-draft";
import {SetupActions} from "./setup-actions";
import {FirstCallHoursFields,type HoursFieldsHandle} from "./first-call-hours-fields";
import {BusinessClassificationPicker,type IndustryNavigation} from "./business-classification-picker";
import {classificationFromFields} from "@/lib/business-classification";
import {FirstCallServicesFields,useServiceSelection,type ServiceNavigation} from "./first-call-services-fields";
import {useSetupValidation} from "./use-setup-validation";
import {useCallback,useId,useRef,useState} from "react";
import {ArrowRight,LockKeyhole} from "lucide-react";
import {voiceLegalDisclosure} from "@/lib/voice-greeting";
import type {FirstCallSection} from "@/lib/first-call-setup";
export const SETUP_FIELD="mt-2 min-h-11 w-full rounded-lg border border-[#d9e2dd] bg-white px-3 py-2 text-sm text-[#11181d] shadow-[0_1px_3px_rgba(53,61,66,0.05)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#84938c] focus:ring-2 focus:ring-[#353D42]/10 motion-reduce:transition-none aria-invalid:border-[#a13d35]/60 aria-invalid:focus:ring-[#a13d35]/10";
export const SETUP_PRIMARY="inline-flex cursor-pointer disabled:cursor-not-allowed motion-reduce:transition-none min-h-11 items-center justify-center gap-3 rounded-full bg-[#11181d] px-6 text-sm font-medium text-white transition hover:bg-[#243136] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50";
export const SETUP_SECONDARY="inline-flex cursor-pointer disabled:cursor-not-allowed motion-reduce:transition-none min-h-11 items-center justify-center gap-2 rounded-full border border-[#353D42]/20 bg-white px-5 text-sm font-medium text-[#353D42] transition-colors hover:border-[#353D42]/40 hover:bg-[#353D42]/5 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50";
export function FirstCallSectionForm({section,values,pending,onSave,smsPricing,onIndustryNavigation,onServiceNavigation,draftKey,onDraft}:{onDraft?:RememberSetupDraft;draftKey?:string;onServiceNavigation?:(navigation:ServiceNavigation)=>void;onIndustryNavigation?:(navigation:IndustryNavigation)=>void;smsPricing?:import("@/lib/sms-plan-pricing").SmsPlanPricing|null;section:FirstCallSection;values:Record<string,string>;pending:boolean;onSave:(data:Record<string,string>)=>void}){
 const validation=useSetupValidation();
 const formId=useId(),formRef=useRef<HTMLFormElement>(null);
 useSetupDraft(formRef,section,values.configurationVersion??"",onDraft);
 const hours=useRef<HoursFieldsHandle>(null);
 const [classification,setClassification]=useState(()=>classificationFromFields(values));
 const [classificationError,setClassificationError]=useState("");
 const changeClassification=useCallback((value:ReturnType<typeof classificationFromFields>)=>{setClassification(value);setClassificationError("");},[]);
 const services=useServiceSelection(values,classification,draftKey,section==='services'?onServiceNavigation:undefined);

 const saveAction=<SetupActions className={`flex justify-center bg-transparent ${section==="services"?"py-1":"py-2"}`}><button form={formId} disabled={pending} className={SETUP_PRIMARY}>{pending?"Saving…":section==="services"&&services.stage==="edit"?"Continue":"Save & continue"}<ArrowRight size={16}/></button></SetupActions>;

 return <form ref={formRef} id={formId} noValidate onChange={e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)validation.clear(e.target.name);}} method="post" onSubmit={e=>{
  e.preventDefault();
  if(section==="hours"){if(!hours.current?.validate())return;}
  else {
   if(section==="services"&&!services.validate(e.currentTarget))return;
   if(section==="profile"&&!classification){setClassificationError("Choose your industry and at least one speciality.");return;}
   if(!validation.validate(e.currentTarget))return;
  }
  onSave(Object.fromEntries([...new FormData(e.currentTarget).entries()].map(([key,value])=>[key,String(value)])));
 }} className="space-y-5 text-left"><input type="hidden" name="configurationVersion" value={values.configurationVersion??""}/><fieldset disabled={pending} className={section==="hours"?"space-y-2":section==="services"?"space-y-3":"space-y-5"}>{section!=="hours"&&validation.summary}
 {section==="profile"&&<><BusinessClassificationPicker value={classification} onChange={changeClassification} onIndustryNavigation={onIndustryNavigation} error={classificationError}/></>}

 {section==="hours"&&<FirstCallHoursFields ref={hours} values={values} smsPricing={smsPricing}/>}
 {section==="services"&&<FirstCallServicesFields model={services} classification={classification} pending={pending} action={saveAction}/>}
 {section==="greeting"&&<><label className="block text-xs font-medium text-[#5b6b65]">Opening line<textarea name="intro" {...validation.props("intro")} required maxLength={250} rows={2} defaultValue={values.intro} className={SETUP_FIELD}/>{validation.error("intro")}</label><div data-setup-note className="flex gap-3 border-y border-[#d9e2dd] py-4 text-sm leading-6 text-[#5b6b65]"><LockKeyhole size={16} className="mt-1 shrink-0"/><div><p>{voiceLegalDisclosure("Cara")}</p><p className="mt-2 text-xs text-[#84938c]">This disclosure is included automatically and can’t be changed here.</p></div></div><label className="block text-xs font-medium text-[#5b6b65]">Closing question<input name="closing" {...validation.props("closing")} required maxLength={180} defaultValue={values.closing||"How can I help you today?"} className={SETUP_FIELD}/>{validation.error("closing")}</label></>}
 {section!=="services"&&(section!=="profile"||classification)&&saveAction}
 </fieldset></form>;
}
