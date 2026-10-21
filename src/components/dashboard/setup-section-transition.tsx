"use client";

import type {ReactNode} from "react";
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from "motion/react";

/** Keeps the panel fixed while the outgoing section finishes before the next enters. */
export function SetupSectionTransition({screenKey, children}:{screenKey:string;children:ReactNode}) {
 return <AnimatePresence mode="wait">
  <Section key={screenKey}>{children}</Section>
 </AnimatePresence>;
}

function Section({children}:{children:ReactNode}) {
 const reduced=useReducedMotion();
 const present=useIsPresent();
 return <motion.div
  inert={!present}
  aria-hidden={!present || undefined}
  className="flex min-h-0 flex-1 flex-col"
  initial={{opacity:0,y:reduced?0:8}}
  animate={{opacity:1,y:0}}
  exit={{opacity:0,y:reduced?0:-6}}
  transition={{duration:reduced?0:0.24,ease:[0.22,1,0.36,1]}}
 >{children}</motion.div>;
}
