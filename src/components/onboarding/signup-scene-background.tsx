"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useOnboardingAnimateIn } from "./onboarding-enter";
import { cn } from "@/lib/utils";
import { onboardingProfileBgEnterTransition } from "./onboarding-motion";

export type SignupSceneAsset = {jpg:string;webp:string;smallWebp:string;blend:true};

/** Keep the original photographs intact; blend them into the page with CSS. */
export function SignupSceneBackground({asset, portraitHeader = false, framed = false}: {asset:SignupSceneAsset; portraitHeader?:boolean; framed?:boolean}) {
  const ready = useOnboardingAnimateIn();
  const reduceMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, []);
  return <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-white", portraitHeader && "bottom-auto h-[220px] md:bottom-0 md:h-full")} style={{"--scene-position":"74% center"} as CSSProperties}>
    <picture className={framed ? "absolute inset-0 block" : portraitHeader ? "absolute inset-0 md:left-auto md:top-[12%] md:bottom-auto md:h-[65%] md:w-[36%]" : undefined}>
      <source type="image/webp" srcSet={`${asset.smallWebp} 960w, ${asset.webp} 1672w`} sizes="(max-width: 767px) 1672px, 100vw" />
      <motion.img ref={imageRef} key={asset.jpg} initial={{opacity:0,y:24,scale:1.035}} animate={reduceMotion ? {opacity:1,y:0,scale:1} : ready && loaded ? {opacity:1,y:0,scale:1} : {opacity:0,y:24,scale:1.035}} transition={reduceMotion ? {duration:0} : onboardingProfileBgEnterTransition} onLoad={() => setLoaded(true)} style={framed ? {objectPosition:"74% 20%"} : undefined} src={asset.jpg} alt="" draggable={false} decoding="async" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[var(--scene-position)]" />
    </picture>
    {!framed && <><div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,0.97)_24%,rgba(255,255,255,0.87)_48%,rgba(255,255,255,0.4)_70%,rgba(255,255,255,0.12)_100%)] md:block" />
    <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,transparent_22%,transparent_65%,#fff_100%)] md:block" />
    <div className={cn("absolute inset-0 md:hidden", portraitHeader ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_55%,#fff_100%)]" : "bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.76)_22%,rgba(255,255,255,0.94)_48%,#fff_90%)]")} />
    {!portraitHeader && <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.65)_0%,transparent_100%)] md:hidden" />}
    </>}

  </div>;
}
