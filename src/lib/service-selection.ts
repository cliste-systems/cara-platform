import {looksLikeExclusion} from './services-boundary';
import {serviceEntryProblem, serviceIdentity, conflictingService} from './service-entry-safety';

export const SERVICE_ITEM_LIMIT = 160;
export const SERVICE_LIST_LIMIT = 2000;
export const SERVICE_COUNT_LIMIT = 40;
export type ServiceListField = 'services' | 'notOffered';
export type ServiceSelectionIssue = {field: ServiceListField; message: string};

/** Matches the existing stored list format; a missing item remains unknown. */
export function serviceItems(raw: string): string[] {
 const items=raw.normalize('NFKC').split(/[\n,;]+/).map(item=>item.replace(/^[\s•–—-]+/, '').replace(/\s+/g,' ').trim()).filter(Boolean);
 return items.filter((item,index)=>items.findIndex(other=>serviceIdentity(other)===serviceIdentity(item))===index);
}

export function serviceItemsWithDraft(items: string[], draft: string, editing: number | null): string[] {
 if (!draft.trim()) return items;
 const next = [...items];
 if (editing !== null) next.splice(editing, 1, ...serviceItems(draft));
 else next.push(...serviceItems(draft));
 return serviceItems(next.join("\n"));
}

export function serviceSelectionIssue(services: string, notOffered: string, requireOffered = true): ServiceSelectionIssue | null {
 const offered = serviceItems(services), excluded = serviceItems(notOffered);
 for (const [field, raw, items] of [['services', services, offered], ['notOffered', notOffered, excluded]] as const) {
  for(const item of items) {const problem=serviceEntryProblem(item); if(problem)return {field,message:problem};}
  if (raw.length > SERVICE_LIST_LIMIT || items.length > SERVICE_COUNT_LIMIT) return {field, message: 'Keep each list to 40 services and 2,000 characters.'};
  if (items.some(item => item.length > SERVICE_ITEM_LIMIT)) return {field, message: 'Keep each service under 160 characters.'};
  if (items.some(item => item.length < 2)) return {field, message: 'Enter a service name with at least two characters.'};
 }
 const misplaced = offered.find(looksLikeExclusion);
 if (misplaced) return {field: 'services', message: `Add “${misplaced}” under What you don’t offer instead.`};
 if (requireOffered && !offered.length) return {field: 'services', message: 'Add at least one service your business offers.'};
 const conflict = conflictingService(offered, excluded);
 return conflict ? {field:'notOffered', message: conflict[0]===conflict[1] ? `“${conflict[0]}” is in both lists. Remove it from one before continuing.` : `“${conflict[0]}” and “${conflict[1]}” may describe the same work. Clarify which you offer before continuing.`} : null;
}
