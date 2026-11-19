'use client';
import {useEffect,useState,useTransition,useRef,useId} from 'react';
import {ArrowRight,Check,Clock3,Copy,Phone,MessageCircle,Settings2,LockKeyhole} from 'lucide-react';
import {IrishForwardingGuide} from './irish-forwarding-guide';
import {SetupSectionTransition} from './setup-section-transition';
import {SetupHelpConfirmation} from './setup-help-confirmation';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {FormFeedback} from '@/components/ui/form-feedback';
import styles from './setup-business-step.module.css';
import {SETUP_SECONDARY} from './first-call-section-form';
import {checkMyPhoneConnection,savePhoneConnection,requestPhoneConnectionHelp,inspectPhoneConnectionNumber} from '@/app/(dashboard)/dashboard/first-call-actions';
import {needsProviderAssistance,normalizeConnectionNumber,connectionNumberDetails,connectionNumberIssue,type ConnectionNumberDetails,type PhoneConnection} from '@/lib/phone-connection';

type Props={number:string|null;connection?:PhoneConnection|null;preview:boolean;instructions:boolean;onReadyChange:(ready:boolean)=>void;onContinue:(connected:boolean,connection:PhoneConnection|null)=>void};
export function ForwardingConnection({number,connection:initial,preview,instructions,onReadyChange,onContinue}:Props){
 const [connection,setConnection]=useState(initial??null),[phase,setPhase]=useState<'guide'|'checking'|'pending'|'connected'>(initial?.verified_at&&initial.trial_activated_at?'connected':initial?'pending':'guide');
 const [phoneType,setPhoneType]=useState(initial?.phone_type??''),[provider,setProvider]=useState(initial?.provider??''),[businessNumber,setBusinessNumber]=useState(initial?.business_number??'');
 const [message,setMessage]=useState(''),[helpSent,setHelpSent]=useState(Boolean(initial?.support_ticket_id)),[copied,setCopied]=useState(false),[requestOpen,setRequestOpen]=useState(false),[helpConfirmationOpen,setHelpConfirmationOpen]=useState(false),[sendingHelp,setSendingHelp]=useState(false),[busy,start]=useTransition();
 const inputRef=useRef<HTMLInputElement>(null),confirmationResolver=useRef<((value:boolean)=>void)|null>(null),numberErrorId=useId();
 const [numberError,setNumberError]=useState('');
 const [needsAssistedReview,setNeedsAssistedReview]=useState(false);
 const [numberConfirmation,setNumberConfirmation]=useState<(ConnectionNumberDetails&{lookup:'checked'|'unavailable'|'local'})|null>(null);
 function answerNumberConfirmation(confirmed:boolean){setNumberConfirmation(null);const resolve=confirmationResolver.current;confirmationResolver.current=null;resolve?.(confirmed);if(!confirmed)requestAnimationFrame(()=>inputRef.current?.focus({preventScroll:true}));}
 async function prepareInstructions(type:string,network:string){
  setMessage('');setNumberError('');
  const issue=connectionNumberIssue(businessNumber,type,number);
  if(issue){setNumberError(issue);requestAnimationFrame(()=>inputRef.current?.focus({preventScroll:true}));return false;}
  let details=connectionNumberDetails(businessNumber)!;
  let lookup:'checked'|'unavailable'|'local'='local';
  if(!preview){
   try{const result=await inspectPhoneConnectionNumber(businessNumber,type);if(!result.ok){setNumberError(result.message);return false;}details=result.details;lookup=result.lookup;}
   catch{lookup='unavailable';}
  }
  const accepted=await new Promise<boolean>(resolve=>{confirmationResolver.current=resolve;setNumberConfirmation({...details,lookup});});
  if(!accepted)return false;
  try{const saved=await save(type,network,details.number);if(saved)setBusinessNumber(details.national);return saved;}
  catch{setMessage('Your details could not be saved. Please try again.');return false;}
 }
 const assistance=needsProviderAssistance(phoneType,provider);
 const displayNumber=connectionNumberDetails(connection?.business_number??businessNumber)?.national??businessNumber;
 const phoneLabel=phoneType==='hosted'?'Cloud / PBX':phoneType==='iphone'?'iPhone':phoneType==='android'?'Android':'Landline';
 const [lastActivation,setLastActivation]=useState(initial?.trial_activated_at);
 if(initial?.verified_at&&initial.trial_activated_at&&initial.trial_activated_at!==lastActivation){setLastActivation(initial.trial_activated_at);setConnection(initial);setPhase('connected');}
 async function save(type=phoneType,network=provider,rawNumber=businessNumber){
  const value=normalizeConnectionNumber(rawNumber);
  if(!value||value===number){setMessage('Enter your existing Irish business number, not your Cara number.');return false;}
  if(preview){setConnection({business_number:value,phone_type:type,provider:network,requested_at:new Date().toISOString(),verified_at:null,verified_call_sid:null,trial_activated_at:null,support_ticket_id:null});return true;}
  const result=await savePhoneConnection({businessNumber:value,phoneType:type,provider:network});
  if(!result.ok){setMessage(result.message);return false;}
  setConnection(result.connection);return true;
 }
 function beginCheck(){setMessage('');start(async()=>{try{if(!await save())return;setPhase('checking');if(preview)return;const result=await checkMyPhoneConnection();if(result.ok&&result.connected)setPhase('connected');else if(!result.ok)setMessage(result.message);else setNeedsAssistedReview(Boolean(result.needsAssistedReview));}catch{setMessage('Your details could not be saved. Please try again.');}});}
 useEffect(()=>{
  if(preview||phase!=='checking')return;
  let stopped=false,running=false;
  const check=async()=>{if(running||document.visibilityState!=='visible')return;running=true;try{const result=await checkMyPhoneConnection();if(!stopped&&result.ok)setNeedsAssistedReview(Boolean(result.needsAssistedReview));if(!stopped&&result.ok&&result.connected){setPhase('connected');setMessage('');}}finally{running=false;}};
  const timer=window.setInterval(()=>{void check().catch(()=>{});},20000);
  return ()=>{stopped=true;window.clearInterval(timer);};
 },[preview,phase]);
 function keepPending(){setMessage('');start(async()=>{try{if(await save())setPhase('pending');}catch{setMessage('Your details could not be saved. Please try again.');}});}
 function requestHelp(){
  if(sendingHelp)return;
  setMessage('');setSendingHelp(true);
  start(async()=>{try{
   if(!connection&&!await save())return;
   if(preview){setHelpSent(true);setPhase('pending');setHelpConfirmationOpen(true);return;}
   const result=await requestPhoneConnectionHelp();
   if(result.ok){setHelpSent(true);setPhase('pending');setHelpConfirmationOpen(true);}else setMessage(result.message);
  }catch{setMessage('Your request could not be sent. Please try again.');}finally{setSendingHelp(false);}});
 }
 const providerRequest=`Please enable call forwarding from ${connection?.business_number??businessNumber} to ${number??'[my Cara number]'}. Please confirm any forwarding charges and how I can switch it off.`;
 return <div className="space-y-4">
  <SetupSectionTransition animateHeight screenKey={phase}>
   {phase==='guide'?<div className="space-y-4">
    <IrishForwardingGuide number={number} preview={preview} instructions={instructions} onReadyChange={onReadyChange} initialPhoneType={phoneType} initialProvider={provider} hideDestinationUntilInstructions deferConnectionCheck
     selectionContent={<label className={styles.field}>Business number to connect<input ref={inputRef} value={businessNumber} onChange={e=>{setBusinessNumber(e.target.value);setMessage('');setNumberError('');}} autoComplete="tel" inputMode="tel" maxLength={24} placeholder="e.g. 01 234 5678" aria-invalid={Boolean(numberError)||undefined} aria-describedby={numberError?numberErrorId:undefined} className={styles.input}/><span className={styles.hint}>The number your customers already call.</span>{numberError&&<span id={numberErrorId} role="alert" className="mt-2 block text-xs leading-5 text-[#b7473f]">{numberError}</span>}</label>}
     onPrepareInstructions={prepareInstructions} onSelectionChange={(type,network)=>{setPhoneType(type);setProvider(network);}}/>
    {instructions&&<div className={styles.connectionActions}>
     {assistance&&<div className="rounded-2xl bg-[#f5f5f5] p-4 text-center"><h3 className="text-sm font-medium">Your provider needs to enable forwarding</h3><p className="mt-2 text-xs leading-5 text-[#626262]">We’ll keep your next steps in your dashboard while you get connected.</p></div>}
     <button type="button" disabled={busy} onClick={assistance?keepPending:beginCheck} className={`${styles.primary} w-full`}>{busy?'Saving…':assistance?'Save connection details':'Check my connection'}<ArrowRight size={16}/></button>
     {!assistance&&<button type="button" disabled={busy} onClick={keepPending} className={`${SETUP_SECONDARY} w-full`}>Connect later</button>}
    </div>}
   </div>:<div className="space-y-4">
    <section className={styles.connectionCard}>
     <div className={styles.connectionIdentity}>
      <span className={styles.connectionBadge} role="status">{phase==='connected'?<Check size={14}/>:phase==='pending'&&helpSent?<MessageCircle size={14}/>:<Clock3 size={14}/>}<span>{phase==='connected'?'Connected':phase==='checking'?'Checking your connection':helpSent?'Help requested':'Connection pending'}</span></span>
      <p className={styles.connectionNumber}>{displayNumber}</p>
      <p className={styles.connectionDevice}>{provider}<span aria-hidden="true">·</span>{phoneLabel}</p>
     </div>
     <div className={styles.connectionBody}>
      <h2>{phase==='connected'?'Cara is ready to answer.':phase==='checking'?'Make one quick test call.':helpSent?'Our team will help you connect.':'Finish connecting your number.'}</h2>
      {phase==='checking'&&needsAssistedReview&&<p role="status">We received a call, but your network didn’t include forwarding details. Choose Get help so our team can verify the connection. Your trial hasn’t started.</p>}{phase==='checking'?<ol className={styles.connectionSteps}><li><span>1</span>Call this business number from another phone.</li><li><span>2</span>Talk to Cara for over 10 seconds, then hang up.</li><li><span>3</span>We’ll update this page automatically.</li></ol>:<p>{phase==='connected'?'Your forwarded call reached Cara successfully.':helpSent?'We’ll reply in Support in your dashboard. Your phone settings are saved.':'Follow your provider’s steps, then come back to check the connection.'}</p>}
      {phase==='pending'&&assistance&&!helpSent&&<button type="button" onClick={()=>setRequestOpen(true)} className={`${SETUP_SECONDARY} w-full`}>View provider request<ArrowRight size={14}/></button>}
     </div>
     {phase!=='connected'&&<div className={styles.connectionTrial}><LockKeyhole size={13}/><span>Your 7-day trial starts when you’re connected.</span></div>}
    </section>
    <div className={styles.connectionButtons}>
     <button type="button" disabled={busy} onClick={phase==='pending'?beginCheck:()=>onContinue(phase==='connected',connection)} className={`${styles.primary} w-full`}>{phase==='pending'?<><Phone size={15}/>Check connection</>:<>Continue<ArrowRight size={16}/></>}</button>
     {phase!=='connected'&&<>
      {phase==='pending'&&<button type="button" disabled={busy} onClick={()=>onContinue(false,connection)} className={`${SETUP_SECONDARY} w-full`}>Continue<ArrowRight size={16}/></button>}
      <div className={styles.connectionTools}>
       <button type="button" disabled={busy} onClick={()=>{setMessage('');setPhase('guide');onReadyChange(false);}} className={SETUP_SECONDARY}><Settings2 size={15}/>Phone settings</button>
       {!helpSent&&<button type="button" disabled={busy} onClick={requestHelp} className={SETUP_SECONDARY}><MessageCircle size={15}/>{sendingHelp?'Sending…':'Get help'}</button>}
      </div>
     </>}
    </div>
   </div>}
  </SetupSectionTransition>
  <SetupHelpConfirmation open={helpConfirmationOpen} onOpenChange={setHelpConfirmationOpen} onContinue={()=>onContinue(false,connection)}/>
  <Dialog open={Boolean(numberConfirmation)} onOpenChange={open=>{if(!open)answerNumberConfirmation(false);}}><DialogContent className="max-w-md rounded-[24px] border-[#dedede] bg-white p-6 text-center" overlayClassName="bg-black/20 backdrop-blur-sm">
   <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f5f5f5] text-[#353D42]"><Phone size={22}/></div>
   <DialogTitle className="text-[24px] font-semibold leading-tight tracking-tight">Is this the right number?</DialogTitle>
   <DialogDescription className="text-sm leading-6 text-[#626262]">This is the number your customers already call.</DialogDescription>
   <div className="rounded-2xl border border-[#dedede] bg-[#fafafa] px-4 py-5"><p className="text-[26px] font-semibold tracking-tight tabular-nums">{numberConfirmation?.national}</p><p className="mt-1 text-xs tabular-nums text-[#626262]">{numberConfirmation?.number}</p><p className="mt-3 text-xs text-[#626262]">Ireland · {numberConfirmation?.lineType}</p></div>
   <p className="text-xs leading-5 text-[#626262]">{numberConfirmation?.lookup==='unavailable'?'The number lookup is unavailable. Please check every digit before continuing. We’ll confirm the connection with a forwarded call.':'Please check every digit. We’ll confirm the connection with a forwarded call.'}</p>
   <button type="button" onClick={()=>answerNumberConfirmation(true)} className={styles.primary}>Yes, continue<ArrowRight size={16}/></button>
   <button type="button" onClick={()=>answerNumberConfirmation(false)} className={`${SETUP_SECONDARY} w-full`}>Edit number</button>
  </DialogContent></Dialog>
  <Dialog open={requestOpen} onOpenChange={setRequestOpen}><DialogContent className="max-w-md rounded-[24px] border-[#dedede] bg-white p-6 text-center" overlayClassName="bg-black/20 backdrop-blur-sm"><DialogTitle className="text-xl font-semibold tracking-tight">Send this to your provider</DialogTitle><DialogDescription className="text-sm leading-6 text-[#626262]">Ask {provider} to connect your existing number to Cara.</DialogDescription><p className="rounded-2xl bg-[#f5f5f5] p-4 text-left text-sm leading-6 text-[#626262]">{providerRequest}</p><button type="button" disabled={!number} onClick={async()=>{try{await navigator.clipboard.writeText(providerRequest);setCopied(true);}catch{setMessage('Copy is unavailable. Select the request text to copy it.');}}} className={`${styles.primary} w-full`}><Copy size={14}/>{copied?'Copied':'Copy request'}</button>{!number&&<p className="text-xs text-[#626262]">Your assigned Cara number will appear here in your account.</p>}</DialogContent></Dialog>
  {message&&<FormFeedback title="Connection update" message={message}/>}
 </div>;
}
