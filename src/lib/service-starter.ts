import {parseBusinessClassification,type BusinessClassification} from './business-classification';
import {SERVICE_RECIPES,SERVICE_STARTER_VERSION} from './business-service-catalogue.data';
import {businessSetupIssue} from './business-onboarding-scope';

export type StarterProfiles=Record<string,string[]>;
export type ServiceStarterMetadata={version:1;catalogueVersion:1;classificationKey:string;mode:'suggested'|'fresh';profiles:StarterProfiles;removed:string[]};
export function classificationKey(value:BusinessClassification|null):string {return value?`${value.categoryId}:${[...value.specialtyIds].sort().join(',')}`:'';}
const aliases:Readonly<Record<string,string>>={'hair cuts':'haircuts','blow dries':'blow-dries','blow dry':'blow-dries','wheel tracking':'wheel alignment','car servicing':'vehicle servicing','canine grooming':'dog grooming'};
export function starterServiceKey(label:string):string {
 const key=label.normalize('NFKC').toLocaleLowerCase('en-IE').replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-').replace(/[.!]+$/g,'').replace(/\s+/g,' ').trim();
 return aliases[key]??key;
}
export function uniqueStarterServices(labels:readonly string[]):string[] {
 const seen=new Set<string>();return labels.filter(label=>{const key=starterServiceKey(label);if(seen.has(key))return false;seen.add(key);return true;});
}
export function selectedServiceRecipes(value:BusinessClassification|null){return value?.specialtyIds.flatMap(id=>SERVICE_RECIPES[id]?[{id,...SERVICE_RECIPES[id]}]:[])??[];}
export function starterServices(value:BusinessClassification|null,profiles:StarterProfiles={}):string[] {
 if(businessSetupIssue(value))return [];
 return uniqueStarterServices(selectedServiceRecipes(value).flatMap(recipe=>[...recipe.core,...(recipe.options??[]).filter(option=>profiles[recipe.id]?.includes(option.id)).flatMap(option=>option.services)]));
}
export function starterExtras(value:BusinessClassification|null):string[] {
 if(businessSetupIssue(value))return [];
 return uniqueStarterServices(selectedServiceRecipes(value).flatMap(recipe=>recipe.extras));
}
export function missingStarterProfiles(value:BusinessClassification|null,profiles:StarterProfiles):string[]{
 return selectedServiceRecipes(value).filter(recipe=>!recipe.core.length&&recipe.options?.length&&!recipe.options.some(option=>profiles[recipe.id]?.includes(option.id))).map(recipe=>recipe.label);
}
export function readStarterMetadata(raw:unknown,value:BusinessClassification|null):ServiceStarterMetadata|null {
 let data:unknown=raw;try{if(typeof raw==='string')data=JSON.parse(raw);}catch{return null;}
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const v=data as Record<string,unknown>;
 if(v.version!==1||v.catalogueVersion!==SERVICE_STARTER_VERSION||v.classificationKey!==classificationKey(value)||!['suggested','fresh'].includes(String(v.mode)))return null;
 if(!v.profiles||typeof v.profiles!=='object'||Array.isArray(v.profiles)||!Array.isArray(v.removed)||v.removed.length>500||v.removed.some(x=>typeof x!=='string'||x.length>160))return null;
 const recipes=selectedServiceRecipes(value),profiles:StarterProfiles={};
 for(const [id,selections] of Object.entries(v.profiles)){
  const recipe=recipes.find(recipe=>recipe.id===id);
  if(!recipe||!Array.isArray(selections)||selections.length>(recipe.options?.length??0)||selections.some(option=>typeof option!=='string'||!recipe.options?.some(o=>o.id===option))||new Set(selections).size!==selections.length)return null;
  profiles[id]=selections;
 }
 return {version:1,catalogueVersion:1,classificationKey:classificationKey(value),mode:v.mode as 'suggested'|'fresh',profiles,removed:[...new Set(v.removed as string[])]};
}
export function newStarterMetadata(value:BusinessClassification|null,hasSavedServices=false):ServiceStarterMetadata{return {version:1,catalogueVersion:1,classificationKey:classificationKey(value),mode:hasSavedServices?'fresh':'suggested',profiles:{},removed:[]};}
/** Carry explicit removals and still-relevant profile answers across a speciality edit.
 * The existing confirmed list remains the active bank; new defaults are never saved here. */
export function starterMetadataForDraft(raw:unknown,value:BusinessClassification|null,hasSavedServices:boolean):ServiceStarterMetadata {
 const current=readStarterMetadata(raw,value);if(current)return current;
 const fallback=newStarterMetadata(value,hasSavedServices);
 try {
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(!data||typeof data.classificationKey!=='string')return fallback;
  const [categoryId,ids,...extra]=data.classificationKey.split(':');if(extra.length||!categoryId||!ids)return fallback;
  const previousClassification=parseBusinessClassification({version:1,categoryId,specialtyIds:ids.split(',')});
  if(!previousClassification)return fallback;
  const previous=readStarterMetadata(data,previousClassification);if(!previous)return fallback;
  const selected=new Set(value?.specialtyIds??[]);
  return {...fallback,removed:previous.removed,profiles:Object.fromEntries(Object.entries(previous.profiles).filter(([id])=>selected.has(id)))};
 }catch{return fallback;}
}
/** Profile edits only change template-owned entries. Custom additions and removals survive. */
export function reconcileStarterServices(current:readonly string[],previous:readonly string[],next:readonly string[],removed:readonly string[]):string[]{
 const oldKeys=new Set(previous.map(starterServiceKey)),nextKeys=new Set(next.map(starterServiceKey)),blocked=new Set(removed);
 return uniqueStarterServices([...current.filter(item=>!oldKeys.has(starterServiceKey(item))||nextKeys.has(starterServiceKey(item))),...next.filter(item=>!blocked.has(starterServiceKey(item)))]);
}
