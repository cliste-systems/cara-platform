'use client';
import Image from 'next/image';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight} from 'lucide-react';
import {ClisteLogoMark} from '@/components/cliste-logo-mark';
import {signupBody,signupDisplay} from '@/components/onboarding/brand-fonts';
import signupStyles from '@/components/onboarding/signup-flow.module.css';
import journey from '@/components/onboarding/journey-frame.module.css';
import styles from './setup-business-step.module.css';
import confirmationMotion from '@/components/onboarding/signup-confirmation.module.css';
export function SetupFinished({connected,pending,onDashboard,onPrepareDashboard,feedback,dashboardAction}:{connected:boolean;pending:boolean;onDashboard:()=>void;onPrepareDashboard?:()=>Promise<boolean>;feedback?:ReactNode;dashboardAction?:ReactNode}){
 const title=useRef<HTMLHeadingElement>(null),mounted=useRef(true),busy=useRef(false);
 const [preparing,setPreparing]=useState(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function enterDashboard(){
  if(busy.current||pending)return;
  busy.current=true;setPreparing(true);
  let allowed=false;
  try{allowed=onPrepareDashboard?await onPrepareDashboard():true;}catch{allowed=false;}
  if(!mounted.current)return;
  if(!allowed){busy.current=false;setPreparing(false);return;}
  // Navigation keeps this complete scene visible until the dashboard replaces it.
  // No staged exit that leaves a lone button or an empty page during a slow response.
  if(mounted.current)onDashboard();
 }
 useEffect(()=>{title.current?.focus({preventScroll:true});},[]);
 return <main aria-busy={preparing} className={`${styles.screen} ${signupStyles.frame} ${signupBody.variable} ${signupDisplay.variable}`}>
  <div className={`${styles.frame} ${journey.frame} ${styles.finishedFrame}`}><section data-journey-panel className={`${styles.panel} ${journey.panel} ${styles.finishedPanel}`} aria-labelledby="setup-finished-title">
   <div className={journey.content}><div data-setup-completion-content className={`${styles.finishedBody} ${styles.finishedTransition}`}>
    <div className={`${styles.finishedArt} ${confirmationMotion.graphic}`}>
     <picture><source media="(max-width:639px)" srcSet="/cara-setup-doorway-mobile.webp"/><Image src="/cara-setup-doorway.webp" alt="Cara holding open the door to welcome you into your business workspace" fill sizes="(max-width:759px) 240px, 340px" preload unoptimized/></picture>
    </div>
    <div className={styles.finishedCopy}>
    <div className={styles.finishedIntro}>
    <ClisteLogoMark size={36} priority/>
    <h1 className={confirmationMotion.heading} ref={title} tabIndex={-1} id="setup-finished-title">{connected?"Cara is ready.":"Your setup is saved."}</h1>
    <p className={`${styles.finishedDescription} ${confirmationMotion.description}`}>{connected?'Cara is ready to answer your callers.':'Your business number isn’t connected yet. Finish connecting from your dashboard. Your trial hasn’t started.'}</p>
    </div>
    <div className={`${styles.finishedAction} ${confirmationMotion.action}`}> {dashboardAction??<button type="button" disabled={pending||preparing} onClick={()=>void enterDashboard()} className={`${styles.primary} w-full`}>{pending||preparing?'Opening dashboard…':'Open dashboard'}<ArrowRight size={16}/></button>}</div>
    {feedback}
    </div>
   </div></div>
  </section></div>
 </main>;
}
