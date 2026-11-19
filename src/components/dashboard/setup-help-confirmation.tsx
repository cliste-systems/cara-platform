"use client";

import {Check,ArrowRight} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {SETUP_SECONDARY} from './first-call-section-form';
import styles from './setup-business-step.module.css';

export function SetupHelpConfirmation({open,onOpenChange,onContinue,continueLabel='Continue',details='connection'}:{open:boolean;onOpenChange:(open:boolean)=>void;onContinue:()=>void;continueLabel?:string;details?:'connection'|'setup'}){
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md rounded-[24px] border-[#dedede] bg-white p-6 text-center" overlayClassName="bg-black/20 backdrop-blur-sm">
  <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#292929] text-white"><Check size={23}/></div>
  <DialogTitle className="text-[24px] font-semibold leading-tight tracking-tight">Help request sent</DialogTitle>
  <DialogDescription className="text-sm leading-6 text-[#626262]">Our team has your {details} details. We’ll reply in Support in your dashboard. Replies may take up to 24 hours.</DialogDescription>
  <button type="button" onClick={()=>{onOpenChange(false);onContinue();}} className={`${styles.primary} w-full`}>{continueLabel}<ArrowRight size={16}/></button>
  <button type="button" onClick={()=>onOpenChange(false)} className={`${SETUP_SECONDARY} w-full`}>Stay here</button>
 </DialogContent></Dialog>;
}
