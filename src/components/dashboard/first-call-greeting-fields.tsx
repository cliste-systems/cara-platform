"use client";

import {useEffect,useImperativeHandle,useLayoutEffect,useRef,useState, type Ref, type AriaAttributes, type ReactNode} from 'react';
import {Loader2,LockKeyhole,Play,Square,ShieldAlert,MessageSquareText} from 'lucide-react';
import {buildFullVoiceGreeting,defaultVoiceGreetingIntro,DEFAULT_GREETING_CLOSING,voiceLegalDisclosure} from '@/lib/voice-greeting';
import {speakVoicePreview,stopVoicePreview} from '@/components/onboarding/onboarding-voice-preview';
import {MAX_GREETING_INTRO_LENGTH,MAX_GREETING_CLOSING_LENGTH} from '@/lib/voice-greeting-security';
import {reviewVoiceGreetingStep} from "@/app/(onboarding)/onboarding/actions";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {signupBody,signupDisplay} from "@/components/onboarding/brand-fonts";
import {voiceGreetingSafetyIssue,validateVoiceGreetingGuardrails} from '@/lib/voice-greeting-guardrails';
import {AuthFormAlert} from '@/components/auth/auth-form-alert';
import styles from './setup-business-step.module.css';
import interactions from '@/components/onboarding/signup-interactions.module.css';

const cleanInput=(value:string)=>value.normalize('NFKC').replace(/[\r\n\u2028\u2029]+/g,' ').replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'');

export type GreetingFieldsHandle={review:()=>Promise<boolean>};
type Props={ref?:Ref<GreetingFieldsHandle>;values:Record<string,string>;fieldProps:(name:string)=>AriaAttributes;fieldError:(name:string)=>ReactNode};
export function FirstCallGreetingFields({values,fieldProps,fieldError,ref}:Props){
 const [intro,setIntro]=useState(values.intro??'');
 const [closing,setClosing]=useState(values.closing||DEFAULT_GREETING_CLOSING);
 const [status,setStatus]=useState<'idle'|'loading'|'playing'>('idle');
 const [error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 const [reviewing,setReviewing]=useState(false);
 const reviewingRef=useRef(false),resolveReview=useRef<((approved:boolean)=>void)|null>(null);
 const [notice,setNotice]=useState<{blocked:boolean;message:string;intro:string;closing:string}|null>(null);
 const lastNotice=useRef<typeof notice>(null),reviewTrigger=useRef<HTMLElement|null>(null);
 const shownNotice=notice??lastNotice.current;
 function finishReview(approved:boolean){setNotice(null);resolveReview.current?.(approved);resolveReview.current=null;}
 function suggestion(blocked:boolean,message:string,nextIntro=defaultVoiceGreetingIntro(values.reviewBusinessName||'your business'),nextClosing=DEFAULT_GREETING_CLOSING){
  const next={blocked,message,intro:nextIntro,closing:nextClosing};lastNotice.current=next;setNotice(next);
  return new Promise<boolean>(resolve=>{resolveReview.current=resolve;});
 }
 useImperativeHandle(ref,()=>({async review(){
  if(reviewingRef.current||resolveReview.current)return false;
  if(document.activeElement instanceof HTMLElement)reviewTrigger.current=document.activeElement;
  stop();
  const issue=voiceGreetingSafetyIssue(intro,closing);
  if(issue)return suggestion(true,issue);
  const local=validateVoiceGreetingGuardrails({greetingIntro:intro,greetingClosing:closing,businessName:values.reviewBusinessName||'your business'});
  if(!local.ok)return suggestion(false,'This may sound unclear when the opening, caller notice and closing are read together. Try this version.',local.suggestedIntro||intro,local.suggestedClosing||closing);
  if(values.reviewPreview==='true')return true;
  reviewingRef.current=true;setReviewing(true);
  try{
   const result=await reviewVoiceGreetingStep({greetingIntro:intro,greetingClosing:closing});
   if(!result.ok&&result.blocked)return suggestion(true,result.message);
   if(!result.ok)return suggestion(false,'We couldn’t check how this reads just now. Review the full greeting below before continuing.',intro,closing);
   if(result.status==='suggestions'){
    const nextIntro=result.greetingIntro||intro,nextClosing=result.greetingClosing||closing;
    if(voiceGreetingSafetyIssue(nextIntro,nextClosing))return suggestion(false,'This greeting may read awkwardly. Here is a simpler alternative.');
    return suggestion(false,result.summary,nextIntro,nextClosing);
   }
   return true;
  }catch{return suggestion(false,'We couldn’t check how this reads just now. Review the full greeting below before continuing.',intro,closing);}
  finally{reviewingRef.current=false;setReviewing(false);}
 }}));
 useEffect(()=>()=>{resolveReview.current?.(false);},[]);

 const editor=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const container=editor.current;
  if(!container)return;
  const resize=()=>container.querySelectorAll('textarea').forEach(field=>{
   // Measure an unanimated copy: reading the live field during its height
   // transition retains the old scrollHeight and prevents it shrinking.
   const measure=field.cloneNode(false) as HTMLTextAreaElement;
   measure.removeAttribute('name');measure.removeAttribute('id');
   measure.setAttribute('aria-hidden','true');measure.tabIndex=-1;measure.value=field.value;
   Object.assign(measure.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',height:'0px',minHeight:'0px',maxHeight:'none',width:`${field.clientWidth}px`,transition:'none'});
   container.appendChild(measure);
   const height=Math.max(24,measure.scrollHeight);
   measure.remove();field.style.height=`${height}px`;
  });
  resize();
  let width=container.clientWidth;
  const observer=new ResizeObserver(()=>{if(container.clientWidth!==width){width=container.clientWidth;resize();}});
  observer.observe(container);return ()=>observer.disconnect();
 },[intro,closing]);
 useEffect(()=>()=>{request.current?.abort();stopVoicePreview();},[]);
 function stop(){request.current?.abort();stopVoicePreview();setStatus('idle');}
 function edit(update:()=>void){stop();setError('');update();}
 async function preview(){
  if(status!=='idle'){stop();return;}
  if(!intro.trim()||!closing.trim()){setError('Add your opening line and closing question to hear the greeting.');return;}
  const checked=validateVoiceGreetingGuardrails({greetingIntro:intro,greetingClosing:closing,businessName:''});if(!checked.ok){setError(checked.message);return;}
  const controller=new AbortController();request.current=controller;
  setError('');setStatus('loading');
  const result=await speakVoicePreview(buildFullVoiceGreeting(intro,'Cara',closing),{greetingIntro:intro,greetingClosing:closing},{signal:controller.signal,onEnded:()=>setStatus('idle')});
  if(controller.signal.aborted)return;
  if(result.ok)setStatus('playing');else{setError(result.message);setStatus('idle');}
 }
 return <><div ref={editor} className={styles.greetingEditor}>
  <label className={styles.field}><span>Opening line</span><textarea readOnly={reviewing||!!notice} name="intro" {...fieldProps('intro')} required maxLength={MAX_GREETING_INTRO_LENGTH} rows={1} value={intro} onChange={e=>edit(()=>setIntro(cleanInput(e.target.value).slice(0,MAX_GREETING_INTRO_LENGTH)))} className={styles.input}/><span className={styles.greetingLimit}>{intro.length}/{MAX_GREETING_INTRO_LENGTH}</span>{fieldError('intro')}</label>
  <div className={styles.greetingDisclosure}><div><div className={styles.disclosureBadge}><LockKeyhole size={12} aria-hidden="true"/>Caller disclosure</div><p>{voiceLegalDisclosure('Cara')}</p><span><LockKeyhole className={styles.disclosureInlineLock} size={12} aria-hidden="true"/><span className={styles.disclosureDesktopNote}>Always included for legal compliance and to keep callers informed.</span><span className={styles.disclosureMobileNote}>Included for legal compliance.</span></span></div></div>
  <label className={styles.field}><span>Closing question</span><textarea rows={1} readOnly={reviewing||!!notice} name="closing" {...fieldProps('closing')} required maxLength={MAX_GREETING_CLOSING_LENGTH} value={closing} onChange={e=>edit(()=>setClosing(cleanInput(e.target.value).slice(0,MAX_GREETING_CLOSING_LENGTH)))} className={styles.input}/><span className={styles.greetingLimit}>{closing.length}/{MAX_GREETING_CLOSING_LENGTH}</span>{fieldError('closing')}</label>
  <div className={styles.greetingPreview}>
   <button type="button" aria-busy={status==='loading'} onClick={()=>void preview()} className={`${styles.greetingPlay} ${interactions.secondary}`}>
    <span className={styles.greetingPlayIcon}>{status==='loading'?<Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>:status==='playing'?<Square size={15} aria-hidden="true"/>:<Play size={18} aria-hidden="true"/>}</span>
    <span className={styles.greetingPlayLabel}>{status==='loading'?'Preparing your greeting…':status==='playing'?'Cara is speaking':'Hear your greeting'}<small>{status==='loading'?'Tap to cancel':status==='playing'?'Tap to stop':'Preview how Cara welcomes callers'}</small></span>
    <span className={styles.greetingWave} data-playing={status==='playing'} aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i} style={{height:`${[8,18,12,26,16][i%5]}px`,animationDelay:`${i%7*-.12}s`}}/>)}</span>
   </button>
  </div>
  <span role="status" className="sr-only">{status==='loading'?'Preparing your greeting.':status==='playing'?'Cara is speaking.':''}</span>
  <AuthFormAlert title="Preview unavailable" message={error}/>{reviewing&&<p role="status" className="flex items-center justify-center gap-2 text-xs text-[#626262]"><Loader2 size={14} className="animate-spin"/>Checking your greeting…</p>}
 </div>
 <Dialog open={!!notice} onOpenChange={open=>{if(!open)finishReview(false);}}>
  <DialogContent finalFocus={reviewTrigger} className={`${signupBody.className} gap-0 rounded-[24px] border border-[#dedede] bg-white p-6 text-[#292929] shadow-xl ring-0 duration-200 sm:max-w-[440px] sm:p-8`} overlayClassName="bg-black/25 duration-200">
   <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[#eeeeee]">{shownNotice?.blocked?<ShieldAlert size={26} strokeWidth={1.5}/>:<MessageSquareText size={26} strokeWidth={1.5}/>}</div>
   <DialogTitle className={`${signupDisplay.className} text-2xl font-semibold tracking-tight`}>{shownNotice?.blocked?'This greeting needs changing':'Does this sound right?'}</DialogTitle>
   <DialogDescription className="mt-3 text-sm leading-6 text-[#626262]">{shownNotice?.message}</DialogDescription>
   {shownNotice&&<div className="mt-4 rounded-2xl bg-[#f4f4f4] p-4 text-center text-sm leading-6"><p className="mb-2 text-xs font-medium text-[#737373]">Suggested greeting</p>{buildFullVoiceGreeting(shownNotice.intro,'Cara',shownNotice.closing)}</div>}
   <button type="button" className={`${interactions.primary} mt-5 min-h-11 w-full rounded-full bg-[#292929] px-5 text-sm font-medium text-white`} onClick={()=>{if(!shownNotice)return;setIntro(shownNotice.intro);setClosing(shownNotice.closing);requestAnimationFrame(()=>finishReview(!shownNotice.blocked));}}>Use suggestion</button>
   {!shownNotice?.blocked&&<button type="button" onClick={()=>finishReview(true)} className="mt-2 min-h-11 rounded-full border border-[#dedede] text-sm">Keep mine & continue</button>}
   <button type="button" onClick={()=>finishReview(false)} className="mt-2 min-h-11 text-sm text-[#626262] underline underline-offset-4">Edit greeting</button>
  </DialogContent>
 </Dialog></>;
}
