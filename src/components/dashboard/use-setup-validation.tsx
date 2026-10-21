"use client";
import {useId,useState} from "react";
import {AuthFormAlert} from "@/components/auth/auth-form-alert";

const REQUIRED_MESSAGES:Record<string,string>={fullName:"Enter your name.",businessName:"Enter your business name.",legalCompanyName:"Enter your legal company or trading name.",email:"Enter your email address.",password:"Create a password with at least 8 characters.",acceptLegal:"Please accept the terms and Data Processing Agreement to create your account."};

// Use browser constraints as data, without displaying the browser's validation bubbles.
export function useSetupValidation(custom:Record<string,(value:string,field:HTMLInputElement|HTMLTextAreaElement)=>string|undefined>={}){
 const id=useId();
 const [errors,setErrors]=useState<Record<string,string>>({});
 function validate(root:HTMLElement){
  const next:Record<string,string>={};
  let first:HTMLInputElement|HTMLTextAreaElement|null=null;
  for(const field of root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea')){
   if(field.disabled||!field.name||field.type==="radio"||field.type==="hidden")continue;
   const value=field.value.trim(),v=field.validity;
   let error:string|undefined;
   if(field.required&&(!value||(field.type==="checkbox"&&!(field as HTMLInputElement).checked)))error=REQUIRED_MESSAGES[field.name]??(field.type==="checkbox"?"Please confirm this before continuing.":"Please fill in this field.");
   else if(value&&(v.typeMismatch||(field.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))))error=field.type==="email"?"Enter an email address like name@business.ie.":"Please check this value.";
   else if(value&&v.patternMismatch)error=field.name==="eircode"?"Enter an Eircode like D02 X285.":"Please check the format.";
   else if(value&&field.minLength>0&&value.length<field.minLength)error=`Please enter at least ${field.minLength} characters.`;
   else if(field.maxLength>0&&value.length>field.maxLength)error=`Please keep this under ${field.maxLength} characters.`;
   else if(v.badInput||v.rangeUnderflow||v.rangeOverflow||v.stepMismatch)error="Please check this value.";
   if(!error)error=custom[field.name]?.(value,field);
   if(error){next[field.name]=error;first??=field;}
  }
  setErrors(next);
  if(first)requestAnimationFrame(()=>{if(first.isConnected){first.focus({preventScroll:true});first.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});}});
  return !first;
 }
 return {
  validate,
  clear:(name:string)=>setErrors(v=>{if(!v[name])return v;const next={...v};delete next[name];return next;}),
  props:(name:string)=>({"aria-invalid":Boolean(errors[name]),"aria-describedby":errors[name]?`${id}-${name}`:undefined}),
  error:(name:string)=>errors[name]?<span id={`${id}-${name}`} role="alert" className="mt-2 block text-xs font-normal leading-5 text-[#a13d35]">{errors[name]}</span>:null,
  summary:Object.keys(errors).length?<AuthFormAlert message="Please check the marked fields to continue."/>:null,
 };
}
