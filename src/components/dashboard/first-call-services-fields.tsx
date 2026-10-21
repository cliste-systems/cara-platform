"use client";
import {AuthFormAlert} from "@/components/auth/auth-form-alert";

import {useEffect,useId,useMemo,useRef,useState,useSyncExternalStore,type SetStateAction,type ReactNode} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Check, Plus, X, Info} from 'lucide-react';
import Image from 'next/image';
import {DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {BusinessClassification} from '@/lib/business-classification';
import {businessServiceExamples} from '@/lib/business-service-examples';
import {businessSetupIssue,offeredServicesScopeIssue} from '@/lib/business-onboarding-scope';
import {classificationKey,missingStarterProfiles,selectedServiceRecipes,starterExtras,starterServiceKey,uniqueStarterServices} from '@/lib/service-starter';
import {changeStarterProfile,initialStarterDraft,readStarterDraft,type StarterDraft,type ServiceEntry} from '@/lib/service-starter-draft';
import {ServiceStarterControls} from './service-starter-controls';
import {SetupSectionTransition} from './setup-section-transition';
import {serviceItems, serviceItemsWithDraft, serviceSelectionIssue, type ServiceListField} from '@/lib/service-selection';
import {acknowledgeServiceReview,firstServiceReview,serviceIdentity} from '@/lib/service-entry-safety';

export type ServiceNavigation={label:string;back:()=>void}|null;
type Entry = ServiceEntry;
function subscribeDrafts(change:()=>void){window.addEventListener("storage",change);window.addEventListener("cara:services-draft",change);return()=>{window.removeEventListener("storage",change);window.removeEventListener("cara:services-draft",change);};}
const initialEntry = (raw: string): Entry => ({items: serviceItems(raw), draft: '', editing: null});

type Notice = {field: ServiceListField; kind: 'error' | 'info' | 'spelling' | 'similar'; message: string; suggestion?: string; approvalKey?:string; item?:string; index?:number};
export function useServiceSelection(values: Record<string, string>, classification: BusinessClassification | null = null,draftKey?:string,onNavigation?:(navigation:ServiceNavigation)=>void) {
 const initial=useMemo(()=>initialStarterDraft(values,classification),[values,classification]);
 const storageKey=draftKey?`cara:service-draft:v1:${draftKey}:${values.configurationVersion??'initial'}:${classificationKey(classification)}`:null;
 const stored=useSyncExternalStore(subscribeDrafts,()=>{try{return storageKey?window.localStorage.getItem(storageKey):null;}catch{return null;}},()=>null);
 const cached=useMemo(()=>readStarterDraft(stored,classification),[stored,classification]);
 const [edited,setEdited]=useState<StarterDraft|null>(null);
 const [addedRevision,setAddedRevision]=useState({services:0,notOffered:0});
 function revealAddition(field:ServiceListField){setAddedRevision(previous=>({...previous,[field]:previous[field]+1}));}
 const snapshot=edited??cached??initial;
 const [stageOverride,setStageOverride]=useState<'choose'|'profiles'|'edit'|'excluded'|'suggestions'|null>(null);
 const hasDraft=Boolean(edited||cached||values.services?.trim()||values.servicesConfigured==='true');
 const missingProfiles=missingStarterProfiles(classification,snapshot.metadata.profiles);
 const stage=stageOverride??(!hasDraft?'choose':snapshot.metadata.mode==='suggested'&&missingProfiles.length?'profiles':'edit');
 function chooseStartingList(mode:'suggested'|'fresh'){changeMode(mode);setStageOverride(mode==='suggested'&&missingProfiles.length?'profiles':'edit');}
 function reviewProfiles(){if(missingProfiles.length){showProblem({field:'services',message:'Choose at least one option for each service type.'});return;}setNotice(null);setStageOverride('edit');}

 const entries={services:snapshot.banks[snapshot.metadata.mode],notOffered:snapshot.notOffered};
 function updateSnapshot(updater:(previous:StarterDraft)=>StarterDraft){setEdited(previous=>updater(previous??snapshot));}
 function setEntries(updater:SetStateAction<typeof entries>){updateSnapshot(previous=>{const before={services:previous.banks[previous.metadata.mode],notOffered:previous.notOffered};const next=typeof updater==='function'?updater(before):updater;const nextKeys=new Set(next.services.items.map(starterServiceKey));const removed=[...new Set([...previous.metadata.removed,...before.services.items.filter(item=>!nextKeys.has(starterServiceKey(item))).map(starterServiceKey)])].filter(key=>!nextKeys.has(key));return {...previous,metadata:{...previous.metadata,removed},banks:{...previous.banks,[previous.metadata.mode]:next.services},notOffered:next.notOffered};});}
 const persisted=JSON.stringify(snapshot);
 useEffect(()=>{if(!storageKey||!edited)return;try{if(window.localStorage.getItem(storageKey)!==persisted){window.localStorage.setItem(storageKey,persisted);window.dispatchEvent(new Event('cara:services-draft'));}}catch{/* An unavailable browser cache never prevents server saving. */}},[storageKey,persisted,edited]);
 function changeMode(mode:'suggested'|'fresh'){updateSnapshot(previous=>({...previous,metadata:{...previous.metadata,mode}}));setNotice(null);}
 function changeProfile(specialtyId:string,optionId:string){if(entries.services.draft.trim()){setNotice({field:'services',kind:'info',message:'Add or update the current service before changing service types.'});return;}setStageOverride('profiles');updateSnapshot(previous=>changeStarterProfile(previous,classification,specialtyId,optionId));setNotice(null);}
 function addSuggestion(label:string){
  const items=uniqueStarterServices([...entries.services.items,label]);
  const issue=serviceSelectionIssue(items.join('\n'),serializedValues.notOffered,false);
  if(issue){showProblem(issue);return;}
  const scope=offeredServicesScopeIssue(items);if(scope){showProblem({field:'services',message:scope});return;}
  updateSnapshot(previous=>({...previous,metadata:{...previous.metadata,removed:previous.metadata.removed.filter(id=>id!==starterServiceKey(label))},banks:{...previous.banks,[previous.metadata.mode]:{...previous.banks[previous.metadata.mode],items}}}));revealAddition('services');setNotice(null);
 }
 function removeService(field:ServiceListField,index:number){
  const entry=entries[field],item=entry.items[index];setLastRemoval({field,item,index,mode:snapshot.metadata.mode});
  change(field,{items:entry.items.filter((_,i)=>i!==index),draft:entry.editing===index?'':entry.draft,editing:entry.editing===null||entry.editing===index?null:entry.editing>index?entry.editing-1:entry.editing});
  if(field==='services')updateSnapshot(previous=>({...previous,metadata:{...previous.metadata,removed:[...new Set([...previous.metadata.removed,starterServiceKey(item)])]}}));
 }

 const [lastRemoval,setLastRemoval]=useState<{field:ServiceListField;item:string;index:number;mode:"suggested"|"fresh"}|null>(null);
 const [notice, setNotice] = useState<Notice | null>(null);
 function chooseAgain(){setNotice(null);setStageOverride('choose');}
 function returnToEditor(){setNotice(null);setStageOverride('edit');}
 const hasProfileChoices=selectedServiceRecipes(classification).some(recipe=>recipe.options?.length);
 useEffect(()=>{
  const destination=stage==='excluded'||stage==='suggestions'?'edit':stage==='edit'?(snapshot.metadata.mode==='suggested'&&hasProfileChoices?'profiles':'choose'):stage==='profiles'?'choose':null;
  onNavigation?.(destination?{label:destination==='choose'?'Back to starting list':destination==='profiles'?'Back to service types':'Back to services',back:()=>{setNotice(null);setStageOverride(destination);}}:null);
  return()=>onNavigation?.(null);
 },[stage,hasProfileChoices,snapshot.metadata.mode,onNavigation]);
 const [approvals,setApprovals]=useState<Set<string>>(()=>new Set());
 const [beforeRestore, setBeforeRestore] = useState<typeof entries | null>(null);
 const serialized = (field: ServiceListField) => serviceItemsWithDraft(entries[field].items, entries[field].draft, entries[field].editing).join('\n');
 const serializedValues = {services: serialized('services'), notOffered: serialized('notOffered'),serviceReviewApprovals:JSON.stringify([...approvals]),serviceStarter:JSON.stringify(snapshot.metadata)};
 function change(field: ServiceListField, value: Entry) {setEntries(previous => ({...previous, [field]: value})); setNotice(null);}
 function showProblem(issue: {field: ServiceListField; message: string}) {setNotice({...issue, kind: 'error'});if(stage==='edit'||stage==='excluded')setStageOverride(issue.field==='services'?'edit':'excluded');}
 function checkReview(field: ServiceListField, draft: string) {
  const entry=entries[field],otherItems=entry.items.filter((_,index)=>index!==entry.editing),draftItems=serviceItems(draft);
  const review=firstServiceReview(field==='services'?[...otherItems,...draftItems]:[],field==='notOffered'?[...otherItems,...draftItems]:[],approvals,classification);
  if(review){const index=entry.items.findIndex((item,i)=>i!==entry.editing&&serviceIdentity(item)===serviceIdentity(review.item));setNotice({...review,field,index:index>=0?index:undefined});return true;}
  return false;
 }
 function validate(root: HTMLFormElement) {
  if(stage!=='edit'&&stage!=='excluded')return false;
  const scope=businessSetupIssue(classification)??offeredServicesScopeIssue(serviceItems(serializedValues.services));
  if(scope){showProblem({field:'services',message:scope});return false;}
  const missing=snapshot.metadata.mode==='suggested'?missingStarterProfiles(classification,snapshot.metadata.profiles):[];
  if(missing.length){showProblem({field:'services',message:`Choose service types for ${missing.join(', ')} or choose Start fresh.`});return false;}

  const issue=serviceSelectionIssue(serializedValues.services,serializedValues.notOffered);
  if(issue){showProblem(issue);root.querySelector<HTMLInputElement>(`[data-service-field="${issue.field}"]`)?.focus();return false;}
  for(const field of ['services','notOffered'] as const) {
   if(checkReview(field,entries[field].draft)){setStageOverride(field==='services'?'edit':'excluded');root.querySelector<HTMLInputElement>(`[data-service-field="${field}"]`)?.focus();return false;}
  }
  setNotice(null);
  if(stage==='edit'){setStageOverride('excluded');return false;}
  return true;
 }
 function commit(field: ServiceListField) {
  const entry=entries[field],draft=entry.draft;
  if(!draft.trim())return;
  const items=serviceItemsWithDraft(entry.items,draft,entry.editing),next={...serializedValues,[field]:items.join('\n')};
  const issue=serviceSelectionIssue(next.services,next.notOffered,field==='services'||Boolean(next.services));
  if(issue){showProblem(issue);return;}
  if(field==='services'){const scope=offeredServicesScopeIssue(items);if(scope){showProblem({field,message:scope});return;}}
  if(entry.editing===null&&serviceItems(draft).every(item=>entry.items.some(existing=>serviceIdentity(existing)===serviceIdentity(item)))) {
   change(field,{...entry,draft:''});setNotice({field,kind:'info',message:'This service is already added.'});return;
  }
  if(checkReview(field,draft))return;
  change(field,{items,draft:'',editing:null});
  if(entry.editing===null&&items.length>entry.items.length)revealAddition(field);
 }
 function resolveReview(replacement?:string) {
  if(!notice?.item||!notice.approvalKey)return;
  const {field,index,item}=notice,entry=entries[field];
  const revisedApprovals=acknowledgeServiceReview(approvals,notice.approvalKey,replacement);
  let updated:Entry;
  if(index!==undefined) {
   const items=[...entry.items];items[index]=replacement??item;
   updated={...entry,items};
  } else {
   // Keep other pasted entries and any edit target while reviewing one service.
   const reviewedDraft=serviceItems(entry.draft).map(value=>serviceIdentity(value)===serviceIdentity(item)?replacement??value:value).join('\n');
   updated={...entry,draft:reviewedDraft};
  }
  const next={...serializedValues,[field]:serviceItemsWithDraft(updated.items,updated.draft,updated.editing).join('\n')};
  const issue=serviceSelectionIssue(next.services,next.notOffered,field==='services'||Boolean(next.services));
  if(issue){showProblem(issue);return;}
  setApprovals(revisedApprovals);
  const items=serviceItemsWithDraft(updated.items,updated.draft,updated.editing);
  const following=firstServiceReview(field==='services'?items:[],field==='notOffered'?items:[],revisedApprovals,classification);
  if(following){setEntries(previous=>({...previous,[field]:updated}));const targetIndex=updated.items.findIndex((value,i)=>i!==updated.editing&&serviceIdentity(value)===serviceIdentity(following.item));setNotice({...following,field,index:targetIndex>=0?targetIndex:undefined});return;}
  change(field,{items,draft:'',editing:null});
  if(entry.editing===null&&items.length>entry.items.length)revealAddition(field);
 }
 function beginEdit(field: ServiceListField, index: number) {
  const entry = entries[field];
  if (entry.editing === index) return;
  if (entry.draft.trim()) {setNotice({field, kind:'info', message:'Add or update the current service before editing another.'}); return;}
  change(field, {...entry, draft: entry.items[index], editing: index});
 }
 function undoRemoval(){
  if(!lastRemoval||(lastRemoval.field==='services'&&lastRemoval.mode!==snapshot.metadata.mode))return;const {field,item,index}=lastRemoval,entry=entries[field];
  const items=[...entry.items];if(!items.some(value=>starterServiceKey(value)===starterServiceKey(item)))items.splice(Math.min(index,items.length),0,item);
  const next={...serializedValues,[field]:items.join('\n')};const issue=serviceSelectionIssue(next.services,next.notOffered,Boolean(next.services));
  if(issue){showProblem(issue);return;}change(field,{...entry,items});setLastRemoval(null);
 }
 const canRestore = Boolean(values.previousServices || values.previousNotOffered);
 function restore() {
  if (beforeRestore) {setEntries(beforeRestore); setBeforeRestore(null); setNotice(null); return;}
  setBeforeRestore(entries);
  setEntries({services:initialEntry(values.previousServices ?? ''),notOffered:initialEntry(values.previousNotOffered ?? '')});
  setNotice({field:'notOffered', kind:'info', message:'Previous services loaded. Save to apply them.'});
 }
 return {stage,hasDraft,chooseStartingList,reviewProfiles,chooseAgain,editProfiles:()=>{setNotice(null);setStageOverride('profiles');},returnToEditor,openSuggestions:()=>{setNotice(null);setStageOverride('suggestions');},missingProfiles,entries,addedRevision,lastRemoval:lastRemoval?.field==='notOffered'||lastRemoval?.mode===snapshot.metadata.mode?lastRemoval:null,undoRemoval,changeMode,changeProfile,addSuggestion,removeService,dismissNotice:()=>setNotice(null),starter:snapshot.metadata,extras:starterExtras(classification),change,commit, resolveReview, beginEdit, validate, notice, serializedValues, canRestore, restored:Boolean(beforeRestore), restore};
}

export type ServiceSelection = ReturnType<typeof useServiceSelection>;
export function FirstCallServicesFields({model,classification,pending=false,action}: {model:ServiceSelection;classification:BusinessClassification|null;pending?:boolean;action?:ReactNode}) {
 const examples=businessServiceExamples(classification);
 return <div data-setup-services>
  {Object.entries(model.serializedValues).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
  <SetupSectionTransition screenKey={model.stage}>
   <div data-service-screen={model.stage} className="space-y-3">
    <header data-setup-services-header className="text-center">
     <Image src="/m8x4p2n7.png" alt="HelloCara" width={24} height={29} className="mx-auto mb-2 h-9 w-auto"/>
     <DialogTitle className="text-[26px] font-semibold leading-tight tracking-[-0.035em] text-[#11181d] sm:text-[30px]">{model.stage==='excluded'?'Services you don’t offer':model.stage==='suggestions'?'Add suggested services':'Your services'}</DialogTitle>
     <DialogDescription className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-[#6b7c75]">{model.stage==='suggestions'?'Only add services your business actually offers. Tap + to add them to your list.':model.stage==='excluded'?'Optional. Add services Cara should decline. She’ll tell callers you don’t offer them.':model.stage==='edit'?'Cara tells callers you offer what’s listed here. For unlisted services, she’ll take a message instead of guessing.':model.stage==='profiles'?'Choose the work you do. We’ll build your starting list.':'Start with suggested services or build your own list.'}</DialogDescription>
    </header>
    <ServiceStarterControls model={model} classification={classification} pending={pending}
     offeredField={<ServiceChipField field="services" label="What you offer" placeholder={examples.offered} model={model} hideLabel/>}
     excludedField={<ServiceChipField field="notOffered" label="What you don’t offer" placeholder={examples.excluded} model={model} hideLabel/>}/>
    {model.stage==='edit'||model.stage==='excluded'?action:null}
   </div>
  </SetupSectionTransition>
 </div>;
}

export function ServiceChipField({field,label,placeholder,model,hideLabel=false}: {field:ServiceListField;label:string;placeholder:string;model:ServiceSelection;hideLabel?:boolean}) {
 const id = useId(), input = useRef<HTMLInputElement>(null), list=useRef<HTMLUListElement>(null), reduced = useReducedMotion();
 const entry = model.entries[field], feedback = model.notice?.field === field ? model.notice : null, error = feedback?.kind === 'error';
 const update = (value: Entry) => model.change(field, value);
 useEffect(()=>{if(feedback&&feedback.kind!=='info')input.current?.focus({preventScroll:true});},[feedback]);
 const revision=model.addedRevision[field],previousRevision=useRef(revision);
 useEffect(()=>{if(previousRevision.current!==revision){list.current?.scrollTo({top:list.current.scrollHeight,behavior:'instant'});previousRevision.current=revision;}},[revision]);
 function commit() {
  model.commit(field);
 }
 return <div className="space-y-2 text-left">
  <div className={hideLabel?'sr-only':'flex min-h-5 items-center justify-center'}><label htmlFor={id} className="text-sm font-medium text-[#5b6b65]">{label}</label></div>
  {!entry.items.length && <p id={`${id}-example`} className="text-center text-xs leading-5 text-[#84938c]">{placeholder}</p>}
  <motion.div data-setup-service layout={reduced ? false : 'size'} transition={{duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1]}} className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 transition-colors focus-within:border-[#84938c] focus-within:ring-2 focus-within:ring-[#353D42]/5 ${error ? 'border-[#a13d35]/60' : 'border-[#d9e2dd]'}`}>
   {entry.items.length ? <ul ref={list} aria-label={label} tabIndex={0} className="grid max-h-44 w-full grid-cols-1 gap-1 overflow-y-auto overscroll-contain rounded-lg pr-1 outline-none focus-visible:ring-2 focus-visible:ring-[#84938c] [scrollbar-width:thin]">
    <AnimatePresence initial={false} mode="popLayout">
     {entry.items.map((item, index) => {return <motion.li key={item} layout={reduced ? false : 'position'} initial={reduced ? false : {opacity: 0, scale: 0.96}} animate={{opacity: 1, scale: 1}} exit={{opacity: 0, scale: reduced ? 1 : 0.96}} transition={{duration: reduced ? 0 : 0.16}} className={`inline-flex min-w-0 max-w-full items-center min-h-11 rounded-lg py-0.5 pl-1 pr-0.5 ${entry.editing === index ? 'border-[#353D42] bg-[#353D42]/5' : 'border-[#d9e2dd] bg-[#f7f9f8]'}`}>
      <button type="button" aria-label={`Edit ${item}`} onClick={() => {model.beginEdit(field, index); input.current?.focus();}} title={item} className="min-h-10 min-w-0 flex-1 line-clamp-2 rounded-lg px-2 text-center text-sm leading-5 break-words text-[#353D42] outline-none focus-visible:ring-2 focus-visible:ring-[#84938c]">{item}</button>
      <button type="button" aria-label={`Remove ${item}`} onClick={() => model.removeService(field,index)} className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#84938c] transition-colors hover:bg-[#353D42]/10 hover:text-[#353D42] focus-visible:outline-2"><X size={12} aria-hidden="true"/></button>
     </motion.li>;})}
    </AnimatePresence>
   </ul> : null}
   <div data-setup-service-entry className="flex min-h-11 min-w-[150px] flex-1 items-center gap-2">
    <input ref={input} id={id} data-service-field={field} aria-invalid={Boolean(error)} aria-describedby={[!entry.items.length ? `${id}-example` : null, feedback ? `${id}-feedback` : null].filter(Boolean).join(" ") || undefined} autoComplete="off" spellCheck value={entry.draft} onChange={e => update({...entry, draft: e.target.value})} onPaste={e=>{const text=e.clipboardData.getData('text');if(!/[\r\n]/.test(text))return;e.preventDefault();const start=e.currentTarget.selectionStart??entry.draft.length,end=e.currentTarget.selectionEnd??start;update({...entry,draft:entry.draft.slice(0,start)+text.replace(/\r\n?|\n/g,'; ')+entry.draft.slice(end)});}} onKeyDown={e => {if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') {e.preventDefault(); commit();} if (e.key === 'Escape' && entry.editing !== null) {e.preventDefault(); update({...entry, draft: '', editing: null});}}} placeholder={entry.editing !== null ? 'Edit this service' : 'Add a service'} className="min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-[#11181d] outline-none placeholder:text-[#84938c]"/>
    <button type="button" aria-label={entry.editing === null ? `Add to ${label.toLowerCase()}` : `Update service in ${label.toLowerCase()}`} disabled={!entry.draft.trim()} onClick={() => {commit(); input.current?.focus();}} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#d9e2dd] bg-white px-3 text-xs font-medium text-[#353D42] transition-colors hover:border-[#84938c] hover:bg-[#f7f9f8] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40">{entry.editing === null ? <Plus size={13} aria-hidden="true"/> : <Check size={13} aria-hidden="true"/>}{entry.editing === null ? 'Add' : 'Update'}</button>
   </div>
  </motion.div>
  {model.lastRemoval?.field===field?<div className="text-center"><button type="button" onClick={model.undoRemoval} className="min-h-9 rounded px-2 text-xs text-[#637075] underline underline-offset-2 focus-visible:outline-2" aria-label={`Undo removing ${model.lastRemoval.item}`}>Undo removal</button></div>:null}
  <AnimatePresence initial={false}>
   {feedback ? <motion.div key={`${feedback.kind}-${feedback.message}`} initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:reduced?0:0.18,ease:[0.22,1,0.36,1]}} className="overflow-hidden">
    <div id={`${id}-feedback`}>{error?<AuthFormAlert message={feedback.message}/>:<div data-setup-feedback role="status" className="flex items-start gap-2.5 rounded-xl border border-[#d9e2dd] bg-[#f7f9f8] px-3 py-2.5 text-xs leading-5 text-[#5b6b65]">
     <Info size={14} className="mt-0.5 shrink-0 text-[#84938c]" aria-hidden="true"/>
     <div className="min-w-0 flex-1"><p>{feedback.message}</p>
      {feedback.kind==='spelling'||feedback.kind==='similar' ? <div className="mt-2 flex flex-wrap gap-2">
       {feedback.suggestion ? <button type="button" onClick={()=>model.resolveReview(feedback.suggestion)} className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#353D42]/20 bg-white px-3 text-xs font-medium text-[#353D42] transition-colors hover:bg-[#353D42]/5 focus-visible:outline-2">Use “{feedback.suggestion}”</button> : null}
       <button type="button" onClick={()=>model.resolveReview()} className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#d9e2dd] bg-white px-3 text-xs text-[#5b6b65] transition-colors hover:border-[#84938c] focus-visible:outline-2">{feedback.kind==='spelling'?'Keep original':'Keep both'}</button>
      </div> : null}
     </div>
    </div>}</div>
   </motion.div> : null}
  </AnimatePresence>
 </div>;
}
