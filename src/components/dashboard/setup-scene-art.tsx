"use client";

import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import styles from "./setup-scene-art.module.css";

export const SETUP_SCENES={email:"email",business:"verification",profile:"profile",hours:"hours",greeting:"greeting",test:"test",forwarding:"forwarding"} as const;
export type SetupScene=keyof typeof SETUP_SCENES;
export function isSetupScene(value:string|undefined):value is SetupScene{return Boolean(value&&Object.hasOwn(SETUP_SCENES,value));}

/** Decorative, full-canvas art stays fixed while the form scrolls independently. */
export function SetupSceneArt({scene}:{scene:SetupScene}){
 const reduced=useReducedMotion();
 return <div aria-hidden="true" className={styles.art} data-setup-art={scene}>
  <AnimatePresence mode="wait" initial={false}>
   <motion.div key={scene} className={styles.image} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:0.2}}>
    <picture>
     <source media="(min-width:900px)" srcSet={`/setup-scenes/${SETUP_SCENES[scene]}-full-desktop-v2.webp`}/>
     <img src={`/setup-scenes/${SETUP_SCENES[scene]}-full-desktop-v2.webp`} alt="" width={1536} height={1024} decoding="async" fetchPriority="high"/>
    </picture>
   </motion.div>
  </AnimatePresence>
 </div>;
}
