"use client";

import {useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,RefreshCw} from 'lucide-react';
import {retryFirstCallNumber} from '@/app/(dashboard)/dashboard/first-call-actions';
import {FormFeedback} from '@/components/ui/form-feedback';
import {SetupActions} from './setup-actions';
import {SETUP_PRIMARY} from './first-call-section-form';

export function FirstCallTest({number,ready,previewNumber,preview,complete,pending,onContinue}:{number:string|null;ready:boolean;previewNumber?:boolean;preview:boolean;complete:boolean;pending:boolean;onContinue:()=>void}) {
 const router=useRouter();
 const [preparing,startPreparation]=useTransition();
 const [connectionError,setConnectionError]=useState<string|null>(null);
 const waiting=!preview&&!complete;
 // Prepare a real line on entry, including when resuming an older saved setup.
 useEffect(()=>{
  if(preview||ready||previewNumber)return;
  let cancelled=false;
  startPreparation(async()=>{
   try {
    const result=await retryFirstCallNumber();
    if(cancelled)return;
    if(result.ok)router.refresh();else setConnectionError(result.message);
   }catch{if(!cancelled)setConnectionError('We could not prepare your phone line. Please try again or contact setup help.');}
  });
  return ()=>{cancelled=true;};
 },[preview,ready,previewNumber,router]);
 function retry(){
  setConnectionError(null);
  startPreparation(async()=>{
   try{const result=await retryFirstCallNumber();if(result.ok)router.refresh();else setConnectionError(result.message);}
   catch{setConnectionError('We could not prepare your phone line. Please try again or contact setup help.');}
  });
 }
 return <div className="space-y-6">
  <section aria-label="Your Cara number" className="overflow-hidden rounded-2xl border border-[#d9e2dd] bg-white text-center">
   <div className="bg-[#f3f6f4] px-5 py-6 sm:px-7">
    <p className="text-xs font-medium text-[#5b6b65]">Your Cara number</p>
    <p className={`mt-3 break-words font-semibold leading-tight tracking-[-0.035em] text-[#11181d] ${number?'text-[28px] tabular-nums sm:text-[36px]':'text-xl'}`}>{number??(connectionError?'Number not connected':'Preparing your number')}</p>
    {previewNumber?<p className="mt-2 text-xs leading-5 text-[#5b6b65]">Preview number · not connected</p>:!ready&&!connectionError?<p className="mt-2 text-xs leading-5 text-[#5b6b65]">Your number is being prepared. Your setup is saved.</p>:null}
   </div>
   {(ready||preview)&&<div className="border-t border-[#d9e2dd] px-5 py-5 sm:px-7">
    <h3 className="text-sm font-medium text-[#353D42]">Try a few questions</h3>
    <p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-[#5b6b65]">Ask about your opening hours, then leave a message or request a callback.</p>
   </div>}
  </section>
  {connectionError&&!ready&&<FormFeedback title="Phone line not connected" message={connectionError} tone="error"/>}
  <SetupActions className="space-y-3 text-center">
  {!preview&&!ready&&!previewNumber?<button type="button" disabled={preparing} onClick={retry} className={`${SETUP_PRIMARY} disabled:cursor-wait`}><RefreshCw size={15} className={preparing?'animate-spin motion-reduce:animate-none':''}/>{preparing?'Preparing your line…':'Try connecting again'}</button>:<>
   <button type="button" disabled={pending||waiting} onClick={onContinue} className={SETUP_PRIMARY}>Continue to call forwarding<ArrowRight size={16} aria-hidden="true"/></button>
   {waiting?<p role="status" className="mx-auto max-w-[420px] text-xs leading-5 text-[#5b6b65]">{ready&&!previewNumber?'This page updates automatically after your phone call.':'Your connected Cara number is needed before you can make your test call.'}</p>:null}
  </>}
  </SetupActions>
 </div>;
}
