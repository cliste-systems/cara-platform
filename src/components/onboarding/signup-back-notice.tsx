"use client";

import type {ReactNode} from "react";

import {ArrowLeft,ArrowRight,MailCheck,FileCheck2,Check} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose,DialogTrigger} from "@/components/ui/dialog";
import {signupBody,signupDisplay} from "./brand-fonts";
import interactions from "./signup-interactions.module.css";
import {cn} from "@/lib/utils";

/** Shared notice for completed steps that cannot be reopened from Back. */
export function SignupBackNotice({accountEmail,signupComplete=false,submittedBusiness=false,setupFinished=false,onDashboard,dashboardAction,className,disabled=false}:{accountEmail?:string;signupComplete?:boolean;submittedBusiness?:boolean;setupFinished?:boolean;onDashboard?:()=>void;dashboardAction?:ReactNode;className?:string;disabled?:boolean}) {
 const Icon=setupFinished?Check:submittedBusiness?FileCheck2:signupComplete?Check:MailCheck;
 return <Dialog>
  <DialogTrigger render={<button type="button" className={className} disabled={disabled}/>}><ArrowLeft size={14} aria-hidden/>Back</DialogTrigger>
  <DialogContent className={cn(signupBody.className,"gap-0 rounded-[24px] border border-[#dedede] bg-white p-6 text-[#292929] shadow-xl ring-0 duration-200 sm:max-w-[420px] sm:p-8 motion-reduce:animate-none motion-reduce:duration-0")} overlayClassName="bg-black/25 duration-200 motion-reduce:animate-none motion-reduce:duration-0">
   <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[#eeeeee]"><Icon size={26} strokeWidth={1.5} aria-hidden/></div>
   <DialogTitle className={cn(signupDisplay.className,"text-2xl font-semibold tracking-tight")}>{setupFinished?"Your setup is saved":submittedBusiness?"Your details are submitted":signupComplete?"Signup is complete":"Your email is already linked"}</DialogTitle>
   <DialogDescription className="mt-3 text-sm leading-6 text-[#626262]">
    {setupFinished?"Your setup details are saved, so you can’t return to the earlier steps from here. Continue to your dashboard to manage Cara.":submittedBusiness?"Your business details are with our team for review and can’t be edited here.":signupComplete?"Your account is ready, so you can’t return to the signup steps. Continue setting up Cara for your business.":<>Your account has been created{accountEmail?<> with <strong className="break-words font-semibold text-[#292929]">{accountEmail}</strong></>:" with the email you provided"}. You can’t go back to the account creation step from here.</>}
   </DialogDescription>
   {!setupFinished&&(!signupComplete||submittedBusiness)&&<p className="mt-3 text-sm leading-6 text-[#626262]">{submittedBusiness?"You can keep setting up Cara. We’ll contact you if anything else is needed.":"Need to use a different email? Finish setup first, then change your email address in your dashboard."}</p>}
   {setupFinished&&dashboardAction?<div className="mt-6">{dashboardAction}</div>:<DialogClose onClick={setupFinished?onDashboard:undefined} render={<button type="button" disabled={disabled} className={cn(interactions.primary,"mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#292929] px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#626262]")}/>}>{setupFinished?"Open dashboard":"Continue setup"} <ArrowRight size={16} aria-hidden/></DialogClose>}

  </DialogContent>
 </Dialog>;
}
