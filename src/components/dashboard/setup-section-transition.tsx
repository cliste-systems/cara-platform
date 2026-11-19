"use client";

import {useLayoutEffect, useRef, useState, type ReactNode} from "react";
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from "motion/react";

/** Keeps the panel fixed while the outgoing section finishes before the next enters. */
export function SetupSectionTransition({screenKey, children, animateHeight=false}:{screenKey:string;children:ReactNode;animateHeight?:boolean}) {
 const reduced=useReducedMotion();
 const content=useRef<HTMLDivElement>(null);
 const [height,setHeight]=useState<number>();
 useLayoutEffect(()=>{
  if(!animateHeight||!content.current)return;
  const node=content.current;
  const observer=new ResizeObserver(()=>setHeight(node.getBoundingClientRect().height));
  observer.observe(node);
  return ()=>observer.disconnect();
 },[animateHeight]);
 const sections=<AnimatePresence mode="wait" initial={false}>
  <Section key={screenKey}>{children}</Section>
 </AnimatePresence>;
 if(!animateHeight)return sections;
 return <motion.div initial={false} animate={{height:height??"auto"}}
  transition={{duration:reduced?0:.28,ease:[.22,1,.36,1]}} style={{overflow:"clip"}}>
  <div ref={content}>{sections}</div>
 </motion.div>;
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
