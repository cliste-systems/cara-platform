"use client";

import {useEffect,useRef,type ReactNode} from "react";
import Image from "next/image";
import {ArrowRight} from "lucide-react";
import {DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {SETUP_PRIMARY} from "./first-call-section-form";

export function FirstCallComplete({pending,onOpenDashboard,dashboardAction}:{pending:boolean;onOpenDashboard:()=>void;dashboardAction?:ReactNode}){
 const titleRef=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{titleRef.current?.focus({preventScroll:true});},[]);
 return <div className="relative isolate flex min-h-0 flex-1 overflow-hidden bg-[#f3f6f4]">
  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_40%,#e1e7e3_0%,#f3f6f4_55%,#ffffff_100%)]"/>
  <div className="pointer-events-none absolute inset-0 max-sm:bottom-auto max-sm:h-[68%]">
   <Image src="/cara-setup-complete-v1.png" alt="" fill sizes="(max-width:640px) 100vw,1060px" className="object-cover object-top [mask-image:linear-gradient(to_bottom,black_0%,black_46%,transparent_90%)]"/>
  </div>
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#ffffff_0%,#ffffff_20%,rgba(255,255,255,0.95)_35%,rgba(255,255,255,0)_67%)] max-sm:bg-[linear-gradient(0deg,#ffffff_0%,#ffffff_27%,rgba(255,255,255,0.95)_41%,rgba(255,255,255,0)_68%)]"/>
  <div className="relative z-10 mt-auto flex w-full flex-col items-center px-8 pb-14 pt-8 text-center max-sm:px-6 max-sm:pb-12 [@media(max-height:700px)]:pb-8">
   <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-[#637075]">You’re all set</p>
   <DialogTitle ref={titleRef} tabIndex={-1} className="max-w-[640px] text-[48px] font-semibold leading-[1.06] tracking-[-0.045em] text-[#11181d] outline-none max-sm:mx-auto max-sm:text-[36px]">Welcome to HelloCara</DialogTitle>
   <DialogDescription className="mt-4 max-w-[380px] text-base leading-7 text-[#637075] max-sm:mx-auto max-sm:mt-3 max-sm:text-sm max-sm:leading-6">Cara is set up for your business. Let’s get started.</DialogDescription>
   {dashboardAction?<div className="mt-8 max-sm:mt-6">{dashboardAction}</div>:<button type="button" disabled={pending} onClick={onOpenDashboard} className={`${SETUP_PRIMARY} mt-8 w-fit max-sm:mx-auto max-sm:mt-6`}>{pending?"Opening dashboard…":"Open dashboard"}<ArrowRight size={16} aria-hidden="true"/></button>}
  </div>
 </div>;
}
