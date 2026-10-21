"use client";

import {motion,useReducedMotion} from "motion/react";

/** A brief charcoal confirmation flourish; stays still when reduced motion is preferred. */
export function SetupConfirmationMark(){
 const reduced=useReducedMotion();
 return <span aria-hidden="true" className="relative mx-auto my-2 flex size-16 items-center justify-center">
  {!reduced&&<motion.span className="absolute inset-0 rounded-full border border-[#353D42]/25" initial={{scale:0.85,opacity:0.4}} animate={{scale:1.5,opacity:0}} transition={{duration:0.8,ease:"easeOut"}}/>}
  <span className="absolute -inset-2 rounded-full border border-[#353D42]/10"/>
  <motion.span className="flex size-16 items-center justify-center rounded-full bg-[#353D42] shadow-[0_6px_18px_rgba(57,66,71,0.16)]" initial={reduced?false:{scale:0.85}} animate={{scale:1}} transition={reduced?{duration:0}:{type:"spring",stiffness:320,damping:22}}>
   <svg viewBox="0 0 32 32" fill="none" className="size-8 text-white"><motion.path d="m8 16 5.5 5.5L25 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={reduced?false:{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:reduced?0:0.38,delay:reduced?0:0.12,ease:"easeOut"}}/></svg>
  </motion.span>
 </span>;
}
