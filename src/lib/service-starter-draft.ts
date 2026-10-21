import type {BusinessClassification} from './business-classification';
import {classificationKey,starterMetadataForDraft,readStarterMetadata,reconcileStarterServices,starterServiceKey,starterServices,type ServiceStarterMetadata} from './service-starter';
import {serviceItems} from './service-selection';

export type ServiceEntry={items:string[];draft:string;editing:number|null};
export type StarterDraft={version:1;metadata:ServiceStarterMetadata;banks:{suggested:ServiceEntry;fresh:ServiceEntry};notOffered:ServiceEntry};
export const serviceEntry=(items:string[]):ServiceEntry=>({items,draft:'',editing:null});
export function initialStarterDraft(values:Record<string,string>,classification:BusinessClassification|null):StarterDraft {
 const saved=serviceItems(values.services??''),metadata=starterMetadataForDraft(values.serviceStarter,classification,Boolean(saved.length||values.servicesConfigured==='true'));
 const generated=starterServices(classification,metadata.profiles).filter(item=>!metadata.removed.includes(starterServiceKey(item)));
 const active=serviceEntry(saved.length||values.servicesConfigured==='true'?saved:metadata.mode==='suggested'?generated:[]);
 return {version:1,metadata,banks:{suggested:metadata.mode==='suggested'?active:serviceEntry(generated),fresh:metadata.mode==='fresh'?active:serviceEntry([])},notOffered:serviceEntry(serviceItems(values.notOffered??''))};
}
export function changeStarterProfile(state:StarterDraft,classification:BusinessClassification|null,specialtyId:string,optionId:string):StarterDraft {
 const selected=state.metadata.profiles[specialtyId]??[];
 const profiles={...state.metadata.profiles,[specialtyId]:selected.includes(optionId)?selected.filter(id=>id!==optionId):[...selected,optionId]};
 const items=reconcileStarterServices(state.banks.suggested.items,starterServices(classification,state.metadata.profiles),starterServices(classification,profiles),state.metadata.removed);
 return {...state,metadata:{...state.metadata,profiles},banks:{...state.banks,suggested:{...state.banks.suggested,items}}};
}
/** Untrusted local storage is only a draft; strict shape checks prevent broken UI. */
export function readStarterDraft(raw:string|null,classification:BusinessClassification|null):StarterDraft|null {
 if(!raw||raw.length>30000)return null;
 try{
  const v=JSON.parse(raw);if(v?.version!==1||!v.banks)return null;
  const metadata=readStarterMetadata(v.metadata,classification);if(!metadata||metadata.classificationKey!==classificationKey(classification))return null;
  function entry(value:unknown):ServiceEntry|null {
   if(!value||typeof value!=='object')return null;const e=value as ServiceEntry;
   if(!Array.isArray(e.items)||e.items.length>80||e.items.some(item=>typeof item!=='string'||item.length>160)||typeof e.draft!=='string'||e.draft.length>2000||!(e.editing===null||Number.isInteger(e.editing)&&e.editing>=0&&e.editing<e.items.length))return null;
   const items=serviceItems(e.items.join('\n'));
   if(items.length!==e.items.length||items.some((item,index)=>item!==e.items[index]))return null;
   return {items,draft:e.draft,editing:e.editing};
  }
  const suggested=entry(v.banks.suggested),fresh=entry(v.banks.fresh),notOffered=entry(v.notOffered);
  return suggested&&fresh&&notOffered?{version:1,metadata,banks:{suggested,fresh},notOffered}:null;
 }catch{return null;}
}
