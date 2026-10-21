"use client";
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState,useSyncExternalStore,useTransition,type ReactNode} from "react";
import Image from "next/image";
import setupAlignment from "./first-call-alignment.module.css";
import {motion,useReducedMotion} from "motion/react";
import Link from "next/link";
import type {ServiceNavigation} from "./first-call-services-fields";
import type {IndustryNavigation} from "./business-classification-picker";
import {classificationFromFields} from "@/lib/business-classification";
import {firstCallResumeStep,readFirstCallCursor,firstCallConfigurationStep} from "@/lib/first-call-progress";
import {SetupActionsProvider} from "./setup-actions";
import {FirstCallTest} from "./first-call-test";
import {FirstCallComplete} from "./first-call-complete";
import {CustomerSetupPreviewBackdrop} from "./customer-setup-preview-backdrop";
import {SetupConfirmationMark} from "./setup-confirmation-mark";
import {SetupSceneArt,isSetupScene} from "./setup-scene-art";
import {SetupSectionTransition} from "./setup-section-transition";
import {FormFeedback,type FeedbackTone} from "@/components/ui/form-feedback";
const primary=`${setupPrimary} mx-auto flex w-fit`;
import {useRouter} from "next/navigation";
import {ArrowLeft,ArrowRight,Check,Clock3,Mail,RefreshCw,MessageCircle} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {firstCallSteps,firstCallSetupComplete,firstCallTestComplete,nextFirstCallReceipts,validateVerificationDetails,type FirstCallSetupState,type FirstCallSection} from "@/lib/first-call-setup";
import {FIRST_CALL_SECTIONS,firstCallConfigPatch} from "@/lib/first-call-config";
import {dismissFirstCallWelcome,saveFirstCallBusiness,saveFirstCallSection} from "@/app/(dashboard)/dashboard/first-call-actions";
import {FirstCallSectionForm,SETUP_PRIMARY as setupPrimary,SETUP_SECONDARY} from "./first-call-section-form";
import {FirstCallBusinessForm,type BusinessVerificationNavigation} from "./first-call-business-form";
import {IrishForwardingGuide,SetupHelp} from "./irish-forwarding-guide";
const descriptions:Record<string,string>={email:"A secure start for your workspace.",business:"Legal details for your Irish phone number.",profile:"Give Cara a clear picture of your business.",hours:"The hours Cara should give to callers.",services:"Add the services your business offers.",greeting:"A familiar welcome for your customers.",test:"Call the number below from your phone.",forwarding:"Keep your number. Let Cara answer."};
function subscribeToSetupCursor(change:()=>void){window.addEventListener("storage",change);return ()=>window.removeEventListener("storage",change);}
export function FirstCallWelcome({state:initialState,initialOpen,readOnly=false,requiredSetup=false,billingSetupComplete=false,previewScreen,dashboardAction}:{state:FirstCallSetupState;initialOpen:boolean;readOnly?:boolean;requiredSetup?:boolean;billingSetupComplete?:boolean;previewScreen?:"forwarding"|"welcome";dashboardAction?:ReactNode}){
 const progressId=useId(),reducedMotion=useReducedMotion();
 const [actionDock,setActionDock]=useState<HTMLDivElement|null>(null);
 const [bodyNode,setBodyNode]=useState<HTMLDivElement|null>(null),[needsActionDock,setNeedsActionDock]=useState(false);
 const [formDrafts,setFormDrafts]=useState<Record<string,{version:string;values:Record<string,string>}>>({});
 const rememberDraft=useCallback((section:string,version:string,values:Record<string,string>)=>setFormDrafts(previous=>({...previous,[section]:{version,values}})),[]);
 const router=useRouter(),[open,setOpen]=useState(initialOpen);
 const [notice,setNotice]=useState<{message:string;tone:FeedbackTone;title:string}|null>(null);
 function setMessage(message:string,tone:FeedbackTone="error",title=tone==="error"?"Something needs attention":"Setup update"){setNotice(message?{message,tone,title}:null);}
 const [businessNavigation,setBusinessNavigation]=useState<BusinessVerificationNavigation>(null);
 const [serviceNavigation,setServiceNavigation]=useState<ServiceNavigation>(null);
 const [industryNavigation,setIndustryNavigation]=useState<IndustryNavigation>(null);
 const [previewState,setPreviewState]=useState(initialState),[draft,setDraft]=useState(initialState.configuration??{}),[previewFinished,setPreviewFinished]=useState(false),[forwardingReady,setForwardingReady]=useState(false),[completionScreen,setCompletionScreen]=useState(false),[help,setHelp]=useState(false),[editBusiness,setEditBusiness]=useState(false);
 const [pending,start]=useTransition(),bodyRef=useRef<HTMLDivElement>(null);
 const bindBody=useCallback((node:HTMLDivElement|null)=>{bodyRef.current=node;setBodyNode(node);},[]);
 useLayoutEffect(()=>{
  if(!bodyNode)return;
  const observer=new ResizeObserver(()=>setNeedsActionDock(bodyNode.scrollHeight>bodyNode.clientHeight+2));
  observer.observe(bodyNode);
  if(bodyNode.firstElementChild)observer.observe(bodyNode.firstElementChild);
  return ()=>observer.disconnect();
 },[bodyNode]);
 const cursorKey=initialState.progressKey?`cara:first-call-cursor:v1:${readOnly?'preview:':''}${initialState.progressKey}`:null;
 const storedCursor=readFirstCallCursor(useSyncExternalStore(subscribeToSetupCursor,()=>{try{return cursorKey?window.localStorage.getItem(cursorKey):null;}catch{return null;}},()=>null));
 const [selectedOverride,setSelected]=useState<string|null|undefined>(readOnly&&previewScreen==="welcome"?null:readOnly&&previewScreen==="forwarding"?"forwarding":undefined);
 const selected=selectedOverride===undefined?(readOnly?(storedCursor??(firstCallSetupComplete(initialState)?"forwarding":null)):firstCallResumeStep(initialState,storedCursor)):selectedOverride;
 useEffect(()=>{
  if(selectedOverride===undefined||!cursorKey)return;
  try{if(selectedOverride)window.localStorage.setItem(cursorKey,JSON.stringify({version:1,step:selectedOverride}));else window.localStorage.removeItem(cursorKey);}catch{/* Browser storage is optional; it never controls completion. */}
 },[selectedOverride,cursorKey]);
 const s=readOnly?previewState:initialState,testComplete=firstCallTestComplete(s),canContinueToForwarding=readOnly||testComplete,guide=selected==="forwarding",steps=firstCallSteps(s).map(step=>readOnly?{...step,unlocked:true}:step),finished=firstCallSetupComplete(s)||(readOnly&&previewFinished),next=steps.find(v=>!v.complete&&v.unlocked&&!(v.id==="business"&&s.verificationStatus==="submitted"))??steps.find(v=>!v.complete&&v.unlocked),completed=finished?steps.length:steps.filter(v=>v.unlocked&&v.complete).length;
 const active=steps.find(v=>v.id===selected&&v.unlocked);
 const configurationNext=firstCallConfigurationStep(s);
 const savedConfiguration=readOnly?draft:s.configuration??{};
 const currentDraft=selected?formDrafts[selected]:undefined;
 const sectionValues=currentDraft?.version===(savedConfiguration.configurationVersion??"")?{...savedConfiguration,...currentDraft.values}:savedConfiguration;
 const businessVersion=JSON.stringify(s.details);
 const businessDraft=formDrafts.business?.version===businessVersion?formDrafts.business.values:undefined;
 useLayoutEffect(()=>{bodyRef.current?.scrollTo({top:0});},[selected,guide,help]);
 const awaitingVerification=open&&!guide&&!help&&((selected==="email"&&!s.emailVerified)||(selected==="business"&&s.verificationStatus==="submitted"&&!editBusiness)||(selected==="test"&&!s.hadConversation));
 useEffect(()=>{
  if(readOnly||!awaitingVerification)return;
  const check=()=>{if(document.visibilityState==="visible")router.refresh();};
  const interval=window.setInterval(check,20000);
  window.addEventListener("focus",check);
  document.addEventListener("visibilitychange",check);
  return ()=>{window.clearInterval(interval);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
 },[readOnly,awaitingVerification,router]);
 function enter(id:string){if(pending)return;if(!steps.find(v=>v.id===id)?.unlocked)return;if(id==="forwarding")setForwardingReady(false);setSelected(id);setMessage("");setHelp(false);setCompletionScreen(false);}
 function refresh(){if(readOnly){setMessage("This preview uses local progress. The customer account is unchanged.","info");return;}router.refresh();}
 function close(){if(pending)return;if(!finished){setMessage("Complete setup, your test call and the forwarding step before opening your dashboard.");return;}setOpen(false);}
 function finishSetup(){
  if(!canContinueToForwarding||!forwardingReady||selected!=="forwarding"){setMessage("Complete your test call and forwarding setup first.");return;}
  setHelp(false);setMessage("");setCompletionScreen(true);
 }
 function openDashboard(){
  if(!completionScreen||!canContinueToForwarding||!forwardingReady||selected!=="forwarding"){setMessage("Complete your test call before opening your dashboard.");return;}
  if(readOnly){setPreviewFinished(true);setOpen(false);setMessage("");return;}
  start(async()=>{try{const result=await dismissFirstCallWelcome();if(result.ok){setOpen(false);router.refresh();}else setMessage("We could not finish setup. Please try again.");}catch{setMessage("We could not finish setup. Please try again.");}});
 }
 function businessSubmit(form:FormData){
  setMessage("");
  if(readOnly){const result=validateVerificationDetails(Object.fromEntries(form));if(result.error){setMessage(result.error);return;}setPreviewState(v=>({...v,details:result.details!,verificationStatus:"submitted"}));setEditBusiness(false);return;}
  start(async()=>{try{const result=await saveFirstCallBusiness(Object.fromEntries(form),form.get("authority")==="on");if(result.ok){setEditBusiness(false);router.refresh();}else setMessage(result.message,"error","Details not submitted");}catch{setMessage("We could not submit your details. Please try again.","error","Details not submitted");}});
 }
 function saveSection(section:FirstCallSection,data:Record<string,string>){
  setMessage("");
  const parsed=firstCallConfigPatch(section,data,s.businessName,classificationFromFields(readOnly?draft:s.configuration??{}));if(!parsed.ok){setMessage(parsed.message);return;}
  const following=section==="greeting"?"test":steps[steps.findIndex(v=>v.id===section)+1]?.id??"test";
  if(readOnly){setDraft(v=>({...v,...data,configurationVersion:new Date().toISOString(),...(section==="services"?{servicesConfigured:"true"}:{})}));const keys={profile:"profileReady",hours:"hoursReady",services:"servicesReady",greeting:"greetingReady"} as const;setPreviewState(v=>{const patch=Object.fromEntries(FIRST_CALL_SECTIONS.slice(FIRST_CALL_SECTIONS.indexOf(section)).map(id=>[keys[id],id===section]));return {...v,...patch,completedSections:nextFirstCallReceipts(v.completedSections??{},section,new Date().toISOString())};});setPreviewFinished(false);setSelected(following);return;}
  start(async()=>{try{const result=await saveFirstCallSection(section,data);if(result.ok){setSelected(following);router.refresh();}else setMessage(result.message,"error","Changes not saved");}catch{setMessage("Your section could not be saved. Please try again.","error","Changes not saved");}});
 }
 const activeIndex=steps.findIndex(step=>step.id===active?.id);
 const businessForm=active?.id==="business"&&!guide&&!help&&(s.verificationStatus==="not_submitted"||s.verificationStatus==="needs_information"||editBusiness);
 const welcome=!active&&!guide&&!help&&!finished;
 const screenKey=completionScreen?"complete":help?"help":guide?"forwarding":active?.id==="business"?`business-${s.verificationStatus}-${editBusiness}`:active?.id==="email"?`email-${s.emailVerified}`:active?.id??"welcome";
 const fullScene=!help&&!completionScreen&&isSetupScene(active?.id)?active.id:null;
 const heading=help?"A hand with setup":guide?"Set up call forwarding":active?.title??"Let’s get ready for your first call.";
 function back(){
  if(pending)return;
  setMessage("");
  if(!help&&active?.id==="business"&&businessNavigation){businessNavigation.back();return;}
  if(!help&&active?.id==="services"&&serviceNavigation){serviceNavigation.back();return;}
  if(!help&&active?.id==="profile"&&industryNavigation){industryNavigation.back();return;}
  if(help){setHelp(false);return;}
  if(guide&&forwardingReady){setForwardingReady(false);return;}
  
  const previous=steps[activeIndex-1];
  setSelected(previous?.unlocked?previous.id:null);
 }
 return <>
 {open&&(readOnly||requiredSetup)&&<CustomerSetupPreviewBackdrop businessName={s.businessName} setupComplete={finished}/>}
 {readOnly&&!open&&<div className="fixed right-6 top-16 z-[45] flex gap-3 rounded-xl border border-[#d9e2dd] bg-white p-3 shadow-sm"><button className={SETUP_SECONDARY} onClick={()=>setOpen(true)}>Review setup</button><Link href="/admin/customers" className={SETUP_SECONDARY}>Return to admin</Link></div>}
 {!requiredSetup&&<section className="flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-xl border border-[#d9e2dd] bg-white px-5 py-4"><div><h2 className="text-sm font-semibold text-[#11181d]">{finished?"Your first-call setup":"Get Cara ready for your first call"}</h2><p className="mt-1 text-xs text-[#5b6b65]">{completed} of {steps.length} sections complete</p></div><button onClick={()=>setOpen(true)} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">{finished?"View setup":"Continue setup"}<ArrowRight size={16}/></button></section>}
 <Dialog open={open} onOpenChange={value=>value?setOpen(true):close()}>
 <SetupActionsProvider target={actionDock} forceDock={needsActionDock}><DialogContent showCloseButton={false} data-full-setup-scene={fullScene||undefined} className={`${setupAlignment.flow} ${setupAlignment.entrance} flex h-[min(820px,calc(100dvh_-_3rem))] w-[calc(100vw_-_3rem)] max-w-[1060px] flex-col gap-0 overflow-hidden rounded-[24px] bg-white p-0 shadow-2xl ring-1 ring-black/5 max-sm:h-[calc(100dvh_-_1rem)] max-sm:w-[calc(100vw_-_1rem)] max-sm:rounded-[20px] sm:max-w-[1060px]`} overlayClassName={`${setupAlignment.backdropEntrance} bg-[#11181d]/20 backdrop-blur-md`}>
 {fullScene&&<SetupSceneArt scene={fullScene}/>}
 {active&&!completionScreen&&<nav data-setup-services-progress={active?.id==="services"||undefined} aria-label="Setup steps" className={`shrink-0 border-b border-[#e3e9e5] px-3 ${guide?"py-2 [@media(min-width:640px)_and_(max-height:800px)]:[&_ol]:hidden [@media(min-width:640px)_and_(max-height:800px)]:[&_p]:mt-0":"py-4 sm:py-5"}`}>
  <div className="mx-auto w-full max-w-[480px]">
   <ol style={{gridTemplateColumns:`repeat(${steps.length},minmax(0,1fr))`}} className="relative grid items-center before:absolute before:inset-x-5 before:top-1/2 before:h-px before:bg-[#d9e2dd]">{steps.map((step,index)=><li key={step.id} className="relative min-w-0"><button aria-label={`Step ${index+1}: ${step.title}`} aria-current={step.id===active.id?"step":undefined} disabled={pending||!step.unlocked} onClick={()=>enter(step.id)} className="flex h-11 w-full items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#b9c8c1] disabled:cursor-not-allowed">
    <span className={`relative flex size-7 items-center justify-center rounded-full border text-[11px] transition-colors motion-reduce:transition-none ${!finished&&step.id===active.id?"border-[#353D42] bg-[#353D42] font-medium text-white shadow-sm":finished||step.complete?"border-[#353D42] bg-[#353D42] text-white":"border-[#d9e2dd] bg-white text-[#63756c]"}`}>{step.id===active.id&&<motion.span aria-hidden="true" layoutId={`${progressId}-active-step`} className="pointer-events-none absolute -inset-1 rounded-full border border-[#353D42]/20 shadow-[0_0_0_3px_rgba(53,61,66,0.025)]" transition={reducedMotion?{duration:0}:{type:"spring",stiffness:300,damping:28}}/>}{finished||step.complete?<Check size={12}/>:index+1}</span>
   </button></li>)}</ol>
   <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[#63756c]">{finished&&active?.id==="forwarding"?"Setup complete":`Step ${activeIndex+1} of ${steps.length}`}</p>
  </div>
 </nav>}
 <div className="relative isolate flex min-h-0 flex-1 flex-col">
 {!welcome&&!completionScreen&&!fullScene&&<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_42%,#f1f0ec_0%,#f7f8f5_37%,#ffffff_78%)]"/>}
 <SetupSectionTransition screenKey={screenKey}>
 {completionScreen?<FirstCallComplete pending={pending} onOpenDashboard={openDashboard} dashboardAction={readOnly?dashboardAction:undefined}/>:welcome?<div data-setup-welcome className="relative isolate min-h-0 flex-1 overflow-hidden bg-[#f3f6f4]">
  <div data-setup-welcome-art className="absolute inset-0 max-sm:top-[55%]" aria-hidden="true"><picture><source media="(max-width:639px)" srcSet="/cara-setup-welcome-mobile.webp"/><Image src="/cara-first-call-client-grey-v5.png" alt="" fill priority sizes="(max-width: 640px) 100vw, 1060px" className="object-cover object-top max-sm:object-right"/></picture></div>
  <div className="pointer-events-none absolute inset-y-0 left-8 w-px bg-[#353D42]/[0.06] max-sm:hidden" aria-hidden="true"/>
  <div data-setup-welcome-copy className="relative z-10 flex h-full max-w-[58%] flex-col justify-center px-14 py-10 max-sm:max-w-none max-sm:justify-start max-sm:px-6 max-sm:pt-7 max-sm:text-center">
   {billingSetupComplete?<p className="mb-5 inline-flex w-fit items-center gap-2 text-xs font-medium text-[#46564f] max-sm:mx-auto max-sm:mb-3"><Check size={14} aria-hidden="true"/>Billing setup complete</p>:<p className="mb-6 text-[10px] font-medium uppercase tracking-[0.22em] text-[#59666a] max-sm:hidden">Your next chapter, with Cara.</p>}
   <DialogTitle className="text-[clamp(36px,4.3vw,54px)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#172125] max-sm:text-[34px]">Let’s get Cara ready for your business.</DialogTitle>
   <DialogDescription className="mt-5 max-w-[320px] text-sm leading-6 text-[#637075] max-sm:mx-auto max-sm:mt-3 max-sm:text-xs max-sm:leading-5">Set up your business, try Cara and connect your number.</DialogDescription>
   <p data-setup-welcome-time className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#353D42] max-sm:mt-3 max-sm:justify-center"><Clock3 size={14} aria-hidden="true"/>About 5–10 minutes</p>
   <p data-setup-welcome-note className="mt-2 max-w-[310px] text-xs leading-5 text-[#637075] max-sm:mx-auto max-sm:text-[11px] max-sm:leading-4">Your progress is saved.</p>
   <button onClick={()=>enter(next?.id??"email")} className={`${setupPrimary} mt-7 w-fit shadow-lg shadow-[#353D42]/10 max-sm:mx-auto max-sm:mt-4`}>{completed&&previewScreen!=="welcome"?"Continue setup":"Set up Cara"}<ArrowRight size={16}/></button>
  </div>
 </div>:<div ref={bindBody} data-first-call-body className={`mx-auto flex min-h-0 w-full max-w-[680px] flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin] ${active?.id==="hours"||active?.id==="services"||active?.id==="test"||guide?"py-2":"py-3 sm:py-4"}`}><motion.div data-setup-content layout={active?.id==="services"&&!reducedMotion?"position":false} transition={{layout:{duration:0.28,ease:[0.22,1,0.36,1]}}} className={`flex w-full shrink-0 flex-col my-auto ${!help&&(active?.id==="test"||guide)?"min-h-[min(500px,100%)]":""}`}>
  {(active?.id!=="services"||help)&&<header data-setup-services-header={active?.id==="services"||undefined} data-setup-hours-header={active?.id==="hours"||undefined} data-setup-forwarding-header={guide||undefined} className="shrink-0 px-5 pb-2 sm:px-8">
   <div className="relative text-center"><Image src="/m8x4p2n7.png" alt="HelloCara" width={48} height={58} className="mx-auto mb-2 h-9 w-auto"/><DialogTitle className="text-[26px] font-semibold leading-tight tracking-[-0.035em] text-[#11181d] sm:text-[30px]">{heading}</DialogTitle><DialogDescription className={`mx-auto mt-2 text-sm leading-6 text-[#5b6b65] ${help?"max-w-[480px]":""}`}>{help?(guide?"We’ll walk you through call forwarding at no extra cost. Your provider may need to enable the feature on your line.":"Tell our team where you’re stuck and we’ll help you with the next step."):guide?"Keep your number. Let Cara answer.":active?descriptions[active.id]:"Complete each section, then make your first call."}</DialogDescription></div>
  </header>}
 {businessForm?<FirstCallBusinessForm onDraft={rememberDraft} draftVersion={businessVersion} initialPage={Number(businessDraft?.draftPage??0)} authorityChecked={businessDraft?.authority==="on"} onNavigation={setBusinessNavigation} state={{...s,details:{...s.details,...businessDraft}}} pending={pending} onSubmit={businessSubmit}/>:<div className={`px-5 pb-2 text-center sm:px-8 ${guide&&!help?"max-sm:px-2 pt-2 max-sm:pt-2 max-sm:pb-0":""} ${help?"pt-5 space-y-5":active?.id==="hours"||active?.id==="services"?"pt-3 space-y-3":guide?"pt-2 space-y-4":active?.id==="test"?"pt-4 space-y-4":"pt-6 space-y-6"}`}>
 {help?<SetupHelp preview={readOnly} forwarding={guide} context={guide?"Call forwarding":"Cara setup"}/>:guide?<IrishForwardingGuide number={s.lineEnabled&&!s.isTestNumber?s.number:null} displayNumber={s.number} preview={readOnly} instructions={forwardingReady} onReadyChange={setForwardingReady} completionAction={forwardingReady?<button type="button" disabled={pending||!canContinueToForwarding} onClick={finishSetup} className={`${setupPrimary} max-sm:w-full`}>Finish setup<ArrowRight size={16}/></button>:undefined}/>:active?<> {active.id==="email"&&<><div className={`rounded-xl border border-[#d9e2dd] p-5 ${s.emailVerified?"bg-white py-7":""}`}>{s.emailVerified?<SetupConfirmationMark/>:<Mail size={22} className="text-[#5b6b65] mx-auto"/>}<h3 className="mt-4 text-base font-semibold">{s.emailVerified?"Email confirmed":"Check your inbox"}</h3><p className="mt-2 break-words text-sm text-[#5b6b65]">{s.email}</p><p className="mt-3 text-sm leading-6 text-[#5b6b65]">{s.emailVerified?"Your email is verified. Continue to your business details.":"Follow the link in your confirmation email, then return here. This screen checks automatically and will show your next step. Check spam or junk if you can’t find the email."}</p></div>{s.emailVerified?<button className={primary} onClick={()=>enter("business")}>Continue to business details<ArrowRight size={16}/></button>:<button className={primary} onClick={refresh}>Check email status<RefreshCw size={15}/></button>}{readOnly&&!s.emailVerified&&<button onClick={()=>{setPreviewState(v=>({...v,emailVerified:true}));setMessage("");}} className="block min-h-11 text-xs text-[#5b6b65] underline underline-offset-4 mx-auto">Preview confirmed email</button>}</>}
 {active.id==="business"&&<><div className="rounded-xl border border-[#d9e2dd] bg-white p-5"><SetupConfirmationMark/><p className="mt-4 text-sm font-semibold text-[#11181d]">Business details received</p><p className="mt-3 text-sm leading-6 text-[#5b6b65]">{configurationNext?"Continue setting up Cara for your business.":"Your business settings are ready. Try Cara, then connect your number."}</p>{s.reviewNote&&<p className="mt-3 text-xs leading-5 text-[#5b6b65]">{s.reviewNote}</p>}</div><div className="flex flex-col items-center justify-center gap-3 sm:flex-row"><button className={`${setupPrimary} max-sm:w-full`} onClick={()=>enter(configurationNext??"test")}>{configurationNext?"Continue to Cara setup":"Try Cara"}<ArrowRight size={16}/></button>{s.verificationStatus!=="verified"&&<button onClick={()=>setEditBusiness(true)} className={`${SETUP_SECONDARY} max-sm:w-full`}>Update business details</button>}</div></>}

 {FIRST_CALL_SECTIONS.includes(active.id as FirstCallSection)&&<FirstCallSectionForm onDraft={rememberDraft} draftKey={`${readOnly?"preview:":""}${s.progressKey??""}`} onIndustryNavigation={setIndustryNavigation} onServiceNavigation={setServiceNavigation} smsPricing={s.smsPricing} key={active.id} section={active.id as FirstCallSection} values={sectionValues} pending={pending} onSave={data=>saveSection(active.id as FirstCallSection,data)}/>}
 {active.id==="test"&&<FirstCallTest number={s.number} ready={s.lineEnabled} previewNumber={s.isTestNumber} preview={readOnly} complete={testComplete} pending={pending} onContinue={()=>{if(canContinueToForwarding)enter("forwarding");}}/>}

 </>:null}
 </div>}
 </motion.div></div>}
 </SetupSectionTransition>
 {notice&&<div data-setup-message className="relative z-10 shrink-0 border-t border-[#e3e9e5] bg-white px-3 py-3 sm:px-6"><FormFeedback message={notice.message} title={notice.title} tone={notice.tone} focusOnError className="mx-auto max-w-[680px]"/></div>}
 <div ref={setActionDock} data-setup-action-dock className="relative z-10 shrink-0 border-t border-[#e3e9e5] bg-white px-5 py-3"/>
 </div>
 {!completionScreen&&<footer className="relative flex min-h-14 shrink-0 items-center justify-between gap-2 border-t border-[#e3e9e5] bg-white px-3 sm:gap-4 sm:px-8">{active||guide||help?<button disabled={pending} onClick={back} aria-label={!help&&guide&&forwardingReady?"Back to phone and provider":undefined} className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-xs text-[#637075] outline-none hover:text-[#11181d] focus-visible:ring-2 focus-visible:ring-[#b9c8c1]"><ArrowLeft size={14}/>{!help&&guide&&forwardingReady?<><span className="sm:hidden">Phone & provider</span><span className="hidden sm:inline">Back to phone and provider</span></>:!help&&active?.id==="business"&&businessNavigation?"Previous details":!help&&active?.id==="services"&&serviceNavigation?serviceNavigation.label:!help&&active?.id==="profile"&&industryNavigation?(industryNavigation.label??"Back to industries"):help?"Back to setup":guide?"Back to test call":activeIndex>0?"Previous step":"Back"}</button>:<span className="text-[11px] text-[#63756c]">First-call setup</span>}<button disabled={pending} onClick={()=>{if(guide)setForwardingReady(false);setHelp(v=>!v);setMessage("");}} className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-xs text-[#637075] outline-none hover:text-[#11181d] focus-visible:ring-2 focus-visible:ring-[#b9c8c1]"><MessageCircle size={14}/><span className="sm:hidden">{guide?"Free setup help":"Setup help"}</span><span className="hidden sm:inline">{guide?"Get free setup help":"Get setup help"}</span></button></footer>}
 </DialogContent></SetupActionsProvider></Dialog>
 {requiredSetup&&<div className="flex min-h-dvh items-center justify-center bg-white p-6"><button className={primary} onClick={()=>setOpen(true)}>Continue setting up Cara<ArrowRight size={16}/></button></div>}
 </>;
}
