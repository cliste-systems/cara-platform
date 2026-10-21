"use client";

import {createContext,useContext,useSyncExternalStore,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {motion,useIsPresent,useReducedMotion} from "motion/react";

const ActionTarget=createContext<HTMLElement|null>(null);
const mobileQuery="(max-width: 899px)";
function subscribe(change:()=>void){const query=window.matchMedia(mobileQuery);query.addEventListener("change",change);return ()=>query.removeEventListener("change",change);}

/** Keep actions visible in mobile and overflowing panels; spacious desktops retain inline actions. */
export function SetupActionsProvider({target,children,forceDock=false}:{target:HTMLElement|null;children:ReactNode;forceDock?:boolean}){
 const mobile=useSyncExternalStore(subscribe,()=>window.matchMedia(mobileQuery).matches,()=>false);
 return <ActionTarget.Provider value={mobile||forceDock?target:null}>{children}</ActionTarget.Provider>;
}
export function SetupActions({children,className=""}:{children:ReactNode;className?:string}){
 const target=useContext(ActionTarget),present=useIsPresent(),reduced=useReducedMotion();
 const content=<motion.div data-setup-actions inert={!present} aria-hidden={!present||undefined} initial={false} animate={{opacity:present?1:0}} transition={{duration:reduced?0:0.16}} className={className}>{children}</motion.div>;
 return target?createPortal(content,target):content;
}
