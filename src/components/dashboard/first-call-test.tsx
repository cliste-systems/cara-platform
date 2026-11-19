"use client";

import {useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,RefreshCw,Phone,Check,Clock3,Loader2,MessageCircle} from 'lucide-react';
import {retryFirstCallNumber,requestSetupNumberHelp} from '@/app/(dashboard)/dashboard/first-call-actions';
import {SetupHelpConfirmation} from './setup-help-confirmation';
import {SetupSectionTransition} from './setup-section-transition';
import styles from './setup-business-step.module.css';
import interactions from '@/components/onboarding/signup-interactions.module.css';
import {FormFeedback} from '@/components/ui/form-feedback';
import {SetupActions} from './setup-actions';
import {SETUP_PRIMARY,SETUP_SECONDARY} from './first-call-section-form';

export function FirstCallTest({number,ready,previewNumber,preview,complete,pending,onContinue,localTestMode=false,previewUnavailable=false}:{previewUnavailable?:boolean;localTestMode?:boolean;number:string|null;ready:boolean;previewNumber?:boolean;preview:boolean;complete:boolean;pending:boolean;onContinue:()=>void}) {
 const router=useRouter();
 const [preparing,startPreparation]=useTransition();
 const [connectionError,setConnectionError]=useState<string|null>(previewUnavailable?"Your phone line needs setup assistance.":null);
 const [helpSent,setHelpSent]=useState(false),[helpConfirmationOpen,setHelpConfirmationOpen]=useState(false),[sendingHelp,startHelp]=useTransition();
 const [helpError,setHelpError]=useState<string|null>(null);
 const unavailable=Boolean(connectionError&&!ready);
 const callable=Boolean(number&&ready&&!previewNumber&&!preview);
 const waiting=!complete;
 // Prepare a real line on entry, including when resuming an older saved setup.
 useEffect(()=>{
  if(localTestMode||preview||ready||previewNumber)return;
  let cancelled=false;
  startPreparation(async()=>{
   try {
    const result=await retryFirstCallNumber();
    if(cancelled)return;
    if(result.ok)router.refresh();else setConnectionError(result.message);
   }catch{if(!cancelled)setConnectionError('We could not prepare your phone line. Please try again or contact setup help.');}
  });
  return ()=>{cancelled=true;};
 },[localTestMode,preview,ready,previewNumber,router]);
 function retry(){
  setHelpError(null);
  setConnectionError(null);
  startPreparation(async()=>{
   try{const result=await retryFirstCallNumber();if(result.ok)router.refresh();else setConnectionError(result.message);}
   catch{setConnectionError('We could not prepare your phone line. Please try again or contact setup help.');}
  });
 }
 function requestHelp(){
  if(sendingHelp||helpSent)return;
  setHelpError(null);
  startHelp(async()=>{
   try{
    const result=preview?{ok:true as const}:await requestSetupNumberHelp();
    if(result.ok){setHelpSent(true);setHelpConfirmationOpen(true);}else setHelpError(result.message);
   }catch{setHelpError('Your request could not be sent. Please try again.');}
  });
 }
 return <div className={styles.testCall}>
  <SetupSectionTransition animateHeight screenKey={unavailable?(helpSent?"help-requested":"unavailable"):"call"}>
  {unavailable?<section className={styles.connectionCard}>
   <div className={styles.connectionIdentity}><span className={styles.connectionBadge} role="status"><MessageCircle size={14}/>{helpSent?'Help requested':'Phone setup help'}</span></div>
   <div className={styles.connectionBody}><h2>{helpSent?'Our team will help connect your line.':'Let’s get your Cara number ready.'}</h2><p>{helpSent?'We’ll reply in Support in your dashboard. Replies may take up to 24 hours. Your setup is saved.':'Request help and our team will arrange your Cara phone line so you can try your first call. Your setup is saved.'}</p></div>
  </section>:<>

  <section aria-label="Your Cara number" className={styles.testNumberCard}>
   <p className={styles.testNumberLabel}>Your Cara number</p>
   <p data-placeholder={!number||undefined} className={styles.testNumber}>{number??(preview?'Your number appears here':connectionError?'Number not connected':'Preparing your number…')}</p>
   {!preview&&!ready&&<p className={styles.testNumberHint}>{previewNumber?'Test number · not connected':'Your setup is saved while we connect your line.'}</p>}
   <div className={styles.testCallStage} aria-live="polite">
    <SetupSectionTransition animateHeight screenKey={complete?'complete':'waiting'}><div className={styles.testCallStageContent}>
     {complete?<>
      <div className={styles.testSuccessTitle}><span><Check size={16} strokeWidth={2} aria-hidden="true"/></span><h2>Test call complete</h2></div>
      <p className={styles.testSuccessNote}>Next, connect your business number.</p>
      {callable&&<a href={`tel:${number}`} className={styles.testCallAgain}>Call Cara again</a>}
     </>:<>
      <p className={styles.testPrompt}>Call Cara directly to try your greeting and leave a message. Next, we’ll check calls forwarded from your business number.</p>
      {callable?<a href={`tel:${number}`} className={`${styles.testCallButton} ${interactions.primary}`}><Phone size={15} aria-hidden="true"/>Call Cara</a>:<button type="button" disabled className={styles.testCallButton}><Phone size={15} aria-hidden="true"/>{preparing?'Connecting…':'Call Cara'}</button>}
      <div className={styles.testWaitingStatus}>{preparing?<Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>:<Clock3 size={13} aria-hidden="true"/>}<span>{!ready&&!preview?'Connecting your line':'Waiting for your call'}</span></div>
     </>}
    </div></SetupSectionTransition>
   </div>
  </section>
  </>}
  </SetupSectionTransition>
  {helpError&&<FormFeedback title="Request not sent" message={helpError} tone="error"/>}
  <SetupActions className={styles.testActions}>
   {unavailable&&<button type="button" disabled={sendingHelp||preparing} onClick={helpSent?()=>router.push('/dashboard/support'):requestHelp} className={SETUP_PRIMARY}>{sendingHelp?<Loader2 size={15} className="animate-spin motion-reduce:animate-none"/>:<MessageCircle size={15}/>} {sendingHelp?'Sending…':helpSent?'View support':'Get help'}</button>}
   {localTestMode?<button type="button" disabled={pending} onClick={onContinue} className={SETUP_PRIMARY}>Continue without a call (local test)<ArrowRight size={16}/></button>:!preview&&!ready&&!previewNumber?<button type="button" disabled={preparing||sendingHelp} onClick={retry} className={`${unavailable?SETUP_SECONDARY:SETUP_PRIMARY} disabled:cursor-wait`}><RefreshCw size={15} className={preparing?'animate-spin motion-reduce:animate-none':''}/>{preparing?'Preparing your line…':'Try connecting again'}</button>:!unavailable&&<button type="button" disabled={pending||waiting} onClick={onContinue} className={SETUP_PRIMARY}>Continue<ArrowRight size={16} aria-hidden="true"/></button>}
  </SetupActions>
  <SetupHelpConfirmation open={helpConfirmationOpen} onOpenChange={setHelpConfirmationOpen} details="setup" continueLabel="View support" onContinue={()=>router.push('/dashboard/support')}/>
 </div>;
}
