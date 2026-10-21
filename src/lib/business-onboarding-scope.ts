import type {BusinessClassification} from './business-classification';
import {EXCLUDED_SETUP_SPECIALITIES,SERVICE_RECIPES} from './business-service-catalogue.data';

export const SETUP_SCOPE_MESSAGE = 'This business needs a separate setup review. Use Get setup help to contact our team.';
export function isLaunchSpeciality(id:string):boolean {return Object.hasOwn(SERVICE_RECIPES,id)&&!Object.hasOwn(EXCLUDED_SETUP_SPECIALITIES,id);}
/** Admission only. Historical classification parsing deliberately remains unchanged. */
export function businessSetupIssue(value:BusinessClassification|null):string|null {
 if(!value)return 'Choose your industry and at least one speciality.';
 if(value.specialtyIds.some(id=>!isLaunchSpeciality(id)))return SETUP_SCOPE_MESSAGE;
 if(value.categoryId==='other')return 'Other business types need a setup review. Use Get setup help so our team can confirm the right scope.';
 return null;
}
// A secondary explicit-scope check, not a legal classifier. Ambiguous business types
// are routed to the team rather than certified by keyword matching.
const EXCLUDED_ACTIVITIES = [
 /\b(?:medical|clinical|dental|dentistry|orthodontic|pharmacy|prescription|physiotherapy|podiatry|psychotherapy|counselling|counseling|nursing|veterinary|vet consultations?|home care|personal care|crisis support)\b/i,
 /\b(?:childcare|childminding|creche|crèche|nursery care|preschool care)\b/i,
 /\b(?:legal advice|legal representation|conveyancing|probate|will preparation|tax advice|tax returns?|accountancy|bookkeeping|payroll processing|investment advice|financial advice|mortgage advice|insurance broking|insurance brokerage|insurance quotations?)\b/i,
 /\b(?:architectural (?:design|advice)|structural (?:design|inspections?|reports?)|engineering (?:design|advice|reports?)|building surveys?|land surveys?|quantity surveying|boundary surveys?)\b/i,
 /\b(?:massage|tanning|spray tans?|sunbeds?|injectables?|botox|dermal fillers?|laser (?:hair removal|skin|treatments?)|ipl|medical aesthetics|clinical pilates|asbestos|hazardous waste|dangerous goods|abnormal loads?)\b/i,
];
export function offeredServicesScopeIssue(items:readonly string[]):string|null {
 const item=items.find(label=>EXCLUDED_ACTIVITIES.some(pattern=>pattern.test(label.normalize('NFKC'))));
 return item?`“${item}” is outside this setup’s supported scope. Remove it or use Get setup help for a separate review.`:null;
}
