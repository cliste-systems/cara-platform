"use client";

import Image from "next/image";
import {useState,type ReactNode} from "react";
import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import {ArrowLeft} from "lucide-react";
import {ClisteLogoMark} from "@/components/cliste-logo-mark";
import {signupBody,signupDisplay} from "@/components/onboarding/brand-fonts";
import signupStyles from "@/components/onboarding/signup-flow.module.css";
import journey from "@/components/onboarding/journey-frame.module.css";
import {SignupBackNotice} from "@/components/onboarding/signup-back-notice";
import styles from "./setup-business-step.module.css";

/** Setup keeps signup’s ruled frame, with its own Cara-led layout. */
export function SetupBusinessStep({children,onBack,pending,feedback,accountEmail,submittedBusiness=false,step=1,title="Verify your business",description="A few legal details for your Irish phone number."}:{children:ReactNode;step?:1|2|3|4|5|6;accountEmail?:string;submittedBusiness?:boolean;onBack?:()=>void;pending:boolean;feedback?:ReactNode;title?:string;description?:string}) {
 const reduced=useReducedMotion();
 const [loadedImages,setLoadedImages]=useState<Record<string,boolean>>({});
 const loaded=(src:string)=>setLoadedImages(previous=>previous[src]?previous:{...previous,[src]:true});
 const profile=step===2;
 const hours=step===3;
 const greeting=step===4;
 const test=step===5;
 const forwarding=step===6;
 const art=forwarding?"/cara-connect-number.webp":test?"/cara-test-call.webp":greeting?"/cara-greeting-desktop-v2.webp":hours?"/cara-opening-hours.webp":profile?"/cara-business-profile.webp":"/cara-business-verification-v2.webp";
 const mobileArt=forwarding?"/cara-connect-number-mobile.webp":test?"/cara-test-call-mobile.webp":greeting?"/cara-greeting-mobile.webp":hours?"/cara-opening-hours-mobile-v2.webp":profile?"/cara-business-profile-mobile.webp":"/cara-business-verification-mobile-v2.webp";
 const label=forwarding?"Connect your number":test?"Try Cara":greeting?"Your greeting":hours?"Opening hours":profile?"Your business":"Verify your business";
 return <main className={`${styles.screen} ${signupStyles.frame} ${signupBody.variable} ${signupDisplay.variable}`}>
  <div className={`${styles.frame} ${journey.frame}`}>
   <section data-journey-panel className={`${styles.panel} ${journey.panel}`} aria-labelledby="setup-business-title">
    <nav data-journey-nav className={`${styles.nav} ${journey.nav}`} aria-label="Setup navigation">
     {onBack?<button type="button" onClick={onBack} disabled={pending}><ArrowLeft size={14} aria-hidden/>Back</button>:<SignupBackNotice signupComplete accountEmail={accountEmail} submittedBusiness={submittedBusiness} disabled={pending}/>}
     <div className={styles.stepLabel} aria-label={`Step ${step} of 6: ${label}`}><span>0{step} / 06</span><span>{label}</span></div>
    </nav>
    <AnimatePresence mode="wait">
    <motion.div key={`${step}-${submittedBusiness}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.32}} className={`${styles.stage} ${submittedBusiness?styles.confirmationStage:""}`}>
     {!submittedBusiness&&<motion.aside key={art} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.45,ease:[.22,1,.36,1]}} className={styles.portrait} aria-label="Welcome to Cara setup">
      <Image src={art} onLoad={()=>loaded(art)} className={`${styles.artImage} ${loadedImages[art]?styles.artLoaded:""}`} alt={forwarding?"Cara checking call settings on a mobile at business reception":test?"Cara listening attentively to a caller through her headset":greeting?"Cara welcoming a caller through her headset":hours?"Cara planning the week at her desk":profile?"Cara listening and taking notes":"Cara reviewing business details beside her laptop"} fill unoptimized={greeting||test||forwarding} sizes="(min-width:900px) 440px, 112px" preload/>
      <div className={styles.portraitCopy}><p>{forwarding?<>Your number.<br/>Cara answers.</>:test?<>Your first call.<br/>Meet Cara.</>:greeting?<>Your business.<br/>Cara’s welcome.</>:hours?<>Let Cara know<br/>when you’re open.</>:profile?<>Help Cara understand<br/>your business.</>:<>Let’s make<br/>Cara yours.</>}</p><span>{forwarding?"Keep the number your customers already know.":test?"Hear how Cara looks after your callers.":greeting?"Give every caller a warm first hello.":hours?"Let callers know when you’re available.":profile?"Start with your industry and specialities.":"First, a few details about your business."}</span></div>
     </motion.aside>}
    <div className={`${journey.content} ${styles.formPane}`}>
    <motion.div key={`${step}-${title}`} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.45,ease:[.22,1,.36,1]}} className={`${styles.body} ${journey.inner}`}>
     <header className={styles.heading}>
      <ClisteLogoMark size={40} priority/>
      <h1 id="setup-business-title">{title}</h1>
      <p>{description}</p>
     </header>
     {!submittedBusiness&&<aside className={styles.mobileBanner} aria-label="Welcome to Cara setup">
      <div className={styles.mobilePortrait}><Image src={mobileArt} onLoad={()=>loaded(mobileArt)} className={`${styles.artImage} ${loadedImages[mobileArt]?styles.artLoaded:""}`} alt={forwarding?"Cara checking call settings on a mobile at business reception":test?"Cara listening attentively to a caller through her headset":greeting?"Cara welcoming a caller through her headset":hours?"Cara planning the week at her desk":profile?"Cara listening and taking notes":"Cara reviewing business details"} fill sizes="(max-width: 639px) calc(100vw - 80px), 560px"/></div>
      <div className={styles.mobileBannerCopy}><p>{forwarding?<>Your number.<br/>Cara answers.</>:test?<>Your first call.<br/>Meet Cara.</>:greeting?<>Your business.<br/>Cara’s welcome.</>:hours?<>Let Cara know<br/>when you’re open.</>:profile?<>Help Cara understand<br/>your business.</>:<>Let’s make<br/>Cara yours.</>}</p></div>
     </aside>}
     {children}
     {feedback}
    </motion.div>
    </div>
    </motion.div>
    </AnimatePresence>
   </section>
  </div>
 </main>;
}
