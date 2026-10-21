import {SERVICE_CATALOGUE_LABELS} from './business-service-catalogue.data';
import {BUSINESS_SERVICE_EXAMPLES} from './business-service-examples';
import type {BusinessClassification} from './business-classification';

export function serviceIdentity(raw: string): string {
 return raw.normalize('NFKC').toLocaleLowerCase('en-IE').replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').replace(/[.!]+$/g, '').trim();
}

/** Conservative checks for service data, separate from instructions/FAQ validation. */
export function serviceEntryProblem(raw: string): string | null {
 if (/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(raw)) return 'Remove the hidden formatting characters from this service.';
 const text = raw.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim();
 if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) return 'Remove the unsupported characters from this service.';
 if (/(?:<[^>]+>|```|\b(?:system|assistant|developer)\s*:|\bignore\b.{0,45}\b(?:instructions?|rules?|exclusions?|prompt)\b|\b(?:always|just)\s+(?:say|answer|agree|confirm)|\byou\s+(?:must|should|will)\b|\b(?:pretend|act)\s+(?:you|to be)|\b(?:skip|hide|disable|remove|override|never mention|do not mention|don't mention)\b.{0,45}\b(?:disclosure|recording|safety|instructions?|rules?|ai|assistant)\b)/i.test(text)) return 'Enter a service name here, rather than instructions for Cara.';
 if (/\b(?:ask|request|collect|read out|take|send|store|reveal|give me)\b.{0,45}\b(?:passwords?|pins?|cvv|card details?|card numbers?|security codes?)\b/i.test(text)) return 'Service entries cannot tell Cara to collect or share security details.';
 if (/\b(?:guess|invent|make up)\b.{0,35}\b(?:prices?|answers?|availability|details?)\b/i.test(text)) return 'Enter a service name here, rather than instructions for Cara.';
 if (/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:^|\s)\+?\d[\d ()-]{7,}\d(?:$|\s))/i.test(text)) return 'Keep contact details in your business settings. Add the service name here.';
 if (/[€£$]\s*\d|\b\d+(?:[.,]\d+)?\s*(?:euros?|pounds?|dollars?)\b/i.test(text)) return 'Keep prices in your pricing settings. Add the service name here.';
 if (/\b24\s*(?:\/\s*7|[- ]hours?)\b|\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*[-–]\s*(?:mon|tue|wed|thu|fri|sat|sun)|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text)) return 'Set availability in Opening hours. Add the service name here.';
 if (/\b(?:within|in|under)\s+\d+\s*(?:minutes?|hours?|days?)\b|\bguaranteed\s+(?:response|attendance|arrival|appointment|results?)\b/i.test(text)) return 'Keep response-time promises out of service names. Set call handling separately.';
 if (/^(?:everything|anything|all services?|all work|any jobs?|whatever)(?:\b|$)|^all\b.{0,35}\b(?:work|services?|jobs?)$/i.test(text)) return 'Name the work you handle, rather than “everything” or “all services”.';
 if (/^(?:(?:domestic|residential|commercial|industrial|existing customers?|new customers?|adults?|children)\s+only|except\b.+)$/i.test(text)) return 'Keep the limit with its service, for example “Domestic rewiring”.';
 return null;
}

type Concept = {id: string; pattern: RegExp; defaultAction?: string};
// Equivalent descriptions only. No service is added or inferred from this registry.
const CONCEPTS: Concept[] = [
 {id:'ev_charger', pattern:/\b(?:ev chargers?|electric vehicle chargers?|car charg(?:ers?|ing points?)|electric car charg(?:ers?|ing points?))\b/g, defaultAction:'install'},
 {id:'solar', pattern:/\b(?:solar panels?|solar pv|solar)\b/g},
 {id:'socket', pattern:/\b(?:plug points?|power points?|power sockets?|sockets?)\b/g},
 {id:'rewiring', pattern:/\b(?:rewiring|re-wiring|rewire)\b/g},
 {id:'lighting', pattern:/\b(?:lighting|lights?)\b/g},
 {id:'boiler', pattern:/\bboilers?\b/g},
 {id:'leak', pattern:/\b(?:leak repairs?|leaking pipe repairs?|pipe leak repairs?)\b/g, defaultAction:'repair'},
 {id:'haircut', pattern:/\b(?:haircuts?|hair cuts?|hair trims?)\b/g},
 {id:'hair_colour', pattern:/\b(?:hair colour(?:ing)?|hair color(?:ing)?|colouring|coloring)\b/g},
 {id:'blow_dry', pattern:/\b(?:blow[- ]?dr(?:y|ies)|wash and blow[- ]?dr(?:y|ies))\b/g},
 {id:'car_service', pattern:/\b(?:(?:car|vehicle|motor) servic(?:e|es|ing))\b/g},
 {id:'wheel_alignment', pattern:/\b(?:wheel alignment|wheel tracking)\b/g},
 {id:'bookkeeping', pattern:/\b(?:bookkeeping|book keeping)\b/g},
 {id:'payroll', pattern:/\b(?:payroll(?: processing|services?)?|wage processing)\b/g},
 {id:'physiotherapy', pattern:/\b(?:physiotherapy|physical therapy)\b/g},
 {id:'web_design', pattern:/\b(?:web(?:site)? design|website creation)\b/g},
 {id:'dog_grooming', pattern:/\b(?:dog grooming|canine grooming)\b/g},
 {id:'airport_transfer', pattern:/\b(?:airport transfers?|airport transport)\b/g},
 {id:'window_cleaning', pattern:/\b(?:window cleaning|window washing)\b/g},
 {id:'hedge_cutting', pattern:/\b(?:hedge cutting|hedge trimming)\b/g},
 {id:'room_hire', pattern:/\b(?:meeting room hire|meeting room rental)\b/g},
];
const ACTIONS = /\b(install(?:ation|ations|ing|s)?|fitt?ing|repairs?|repairing|fix(?:ing|es)?|maintenance|maintaining|servicing|inspection|inspections|testing)\b/g;
export function serviceMeaning(raw: string): {key: string; concept: string; action: string; scope: string} | null {
 const text = serviceIdentity(raw).replace(/\bresidential\b/g, 'domestic');
 for (const concept of CONCEPTS) {
  const expression = new RegExp(concept.pattern.source, 'g');
  if (!expression.test(text)) continue;
  const actions = [...text.matchAll(ACTIONS)].map(m => /^install|fitt/.test(m[1]) ? 'install' : /^repair|fix/.test(m[1]) ? 'repair' : /^maintain|maintenance|servic/.test(m[1]) ? 'maintain' : 'inspect');
  const action = [...new Set(actions)].sort().join('+') || concept.defaultAction || '';
  const scope = text.replace(new RegExp(concept.pattern.source, 'g'), ' ').replace(ACTIONS, ' ').replace(/\b(?:no|not|we|do|offer|services?|work|the|a|and|for|of|only)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');
  return {key:`${concept.id}|${action}|${scope}`, concept:concept.id, action, scope};
 }
 return null;
}

export function conflictingService(offered: string[], excluded: string[]): [string,string] | null {
 for (const item of offered) for (const other of excluded) {
  if (serviceIdentity(item) === serviceIdentity(other)) return [item, other];
  const a = serviceMeaning(item), b = serviceMeaning(other);
  if (a && b && (a.key === b.key || (a.concept === b.concept && a.action === b.action && a.scope && !b.scope))) return [item, other];
 }
 return null;
}

function distance(a: string, b: string): number {
 const grid = Array.from({length:a.length+1}, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
 for (let j=0;j<=b.length;j++) grid[0][j]=j;
 for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) {
  grid[i][j]=Math.min(grid[i-1][j]+1,grid[i][j-1]+1,grid[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])grid[i][j]=Math.min(grid[i][j],grid[i-2][j-2]+1);
 }
 return grid[a.length][b.length];
}
const EXTRA_SERVICE_LABELS = [
 'Sockets','Plugs','Switches','Socket installation','Switch repairs','Lighting installations','Rewiring','Fault finding',
 'Solar panels','Solar PV installation','EV charger installation','Appliance repairs','Electrical repairs',
 'Password resets','Credit card terminal repairs','PIN pad repairs','MOT testing','NCT preparation','General electrical repairs',
 'Book keeping','Wheel tracking','Physical therapy','Canine grooming','Web design','Website design',
 'Repair','Installation','Inspection','Consultation','Booking','Session','Cut','Cuts','Style','Styling',
];
const reviewedCatalogueLabels=new Set(SERVICE_CATALOGUE_LABELS.map(serviceIdentity));
const vocabulary = [...new Set(Object.values(BUSINESS_SERVICE_EXAMPLES).flatMap(pair => pair.flatMap(text => text.split(',').map(s=>s.trim()))).concat(EXTRA_SERVICE_LABELS,SERVICE_CATALOGUE_LABELS))];
const wordsIn = (text:string)=>serviceIdentity(text).split(/[^\p{L}]+/u).filter(Boolean);
const vocabularyWords=vocabulary.flatMap(wordsIn);
const knownWords=new Set(vocabularyWords.flatMap(word=>{
 const singular=/(?:ches|shes|xes|zes|sses)$/.test(word)?word.slice(0,-2):word.endsWith('ies')?`${word.slice(0,-3)}y`:word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word;
 return [word,singular];
}));
const knownLabel = (key:string)=>knownWords.has(key)||key.endsWith('s')&&knownWords.has(key.slice(0,-1))||key.endsWith('es')&&knownWords.has(key.slice(0,-2));
function spellingChoice(word:string, preferred:ReadonlySet<string>):string|null {
 const key=word.toLowerCase();
 if(word.length<4||/^[A-Z]+$/.test(word)||knownLabel(key))return null;
 const limit=word.length>=6?2:1;
 const consonants=(value:string)=>value.replace(/[aeiou]/g,'');
 const matches=[...knownWords].filter(candidate=>candidate[0]===key[0]&&Math.abs(candidate.length-key.length)<=limit).map(candidate=>({candidate,edits:distance(key,candidate)})).filter(({candidate,edits})=>edits>0&&edits<=limit&&(edits===1||preferred.has(candidate)||consonants(key)===consonants(candidate))&&(word.length!==4||!/[aeiou]/.test(key)||preferred.has(candidate)));
 if(!matches.length)return null;
 const best=Math.min(...matches.map(m=>m.edits));
 const closest=matches.filter(m=>m.edits===best);
 const contextual=closest.filter(m=>preferred.has(m.candidate));
 const choices=contextual.length?contextual:closest;
 if(choices.length!==1)return null;
 const suggestion=choices[0].candidate;
 return /^[A-Z]/.test(word)?suggestion[0].toUpperCase()+suggestion.slice(1):suggestion;
}
export function serviceSpellingSuggestion(raw: string, classification: BusinessClassification | null = null): string | null {
 const primary = classification?.specialtyIds[0];
 const candidates = primary && BUSINESS_SERVICE_EXAMPLES[primary] ? BUSINESS_SERVICE_EXAMPLES[primary].flatMap(s=>s.split(',').map(s=>s.trim())) : vocabulary;
 const exact = serviceIdentity(raw);
 if (vocabulary.some(word => serviceIdentity(word) === exact)) return null;
 const preferred=new Set(primary&&BUSINESS_SERVICE_EXAMPLES[primary]?candidates.flatMap(wordsIn):[]);
 let changed=false;
 const corrected=raw.replace(/[\p{L}]+/gu, word=>{const correction=spellingChoice(word,preferred);if(!correction)return word;changed=true;return correction;});
 return changed?corrected:null;
}
export type ServiceReview = {kind:'spelling'|'similar'; message:string; suggestion?:string; approvalKey:string};
export function reviewServiceEntry(item: string, others: string[], classification: BusinessClassification | null = null, approvals:ReadonlySet<string>=new Set()): ServiceReview | null {
 const spelling=serviceSpellingSuggestion(item,classification),spellingKey=`spelling:${serviceIdentity(item)}`;
 if(spelling&&!approvals.has(spellingKey))return {kind:'spelling',message:`Check the spelling of “${item}”.`,suggestion:spelling,approvalKey:spellingKey};
 for(const existing of others) {
  if(serviceIdentity(item)===serviceIdentity(existing))continue;
  const a=serviceMeaning(item),b=serviceMeaning(existing);
  if(a&&b&&a.concept===b.concept&&a.action!==b.action)continue;
  const same=a&&b&&a.key===b.key;
  const near=Math.abs(item.length-existing.length)<=3&&item.length>=7&&distance(serviceIdentity(item),serviceIdentity(existing))<=2;
  const approvalKey=`similar:${JSON.stringify([serviceIdentity(item),serviceIdentity(existing)].sort())}`;
  if((same||(near&&!(reviewedCatalogueLabels.has(serviceIdentity(item))&&reviewedCatalogueLabels.has(serviceIdentity(existing)))))&&!approvals.has(approvalKey))return {kind:'similar',message:`“${item}” looks similar to “${existing}”. Keep both if they cover different work.`,approvalKey};
 }
 return null;
}
/** Checks saved chips as well as unfinished text. Acknowledgements never alter service data. */
export function firstServiceReview(offered:string[],excluded:string[],approvals:ReadonlySet<string>=new Set(),classification:BusinessClassification|null=null):({field:'services'|'notOffered';item:string;index:number}&ServiceReview)|null {
 for(const [field,items] of [['services',offered],['notOffered',excluded]] as const)for(let index=0;index<items.length;index++) {
  const review=reviewServiceEntry(items[index],items.filter((_,i)=>i!==index),classification,approvals);
  if(review)return {field,item:items[index],index,...review};
 }
 return null;
}
export function readServiceReviewApprovals(raw:string):Set<string> {
 try {const value=JSON.parse(raw);return Array.isArray(value)&&value.length<=80&&value.every(key=>typeof key==='string'&&key.length<=350)?new Set(value):new Set();}catch{return new Set();}
}

/** Choosing a correction does not approve the discarded misspelling for later use. */
export function acknowledgeServiceReview(previous:ReadonlySet<string>,approvalKey:string,replacement?:string):Set<string> {
 const next=new Set(previous);
 if(replacement===undefined)next.add(approvalKey);else next.delete(approvalKey);
 return next;
}
