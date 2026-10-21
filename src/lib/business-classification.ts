import {isLaunchSpeciality} from './business-onboarding-scope';
import type {OrganizationNiche} from './organization-niche';

export const BUSINESS_CATALOG_VERSION=1 as const;
export type BusinessClassification={version:1;categoryId:string;specialtyIds:string[]};
type Specialty={id:string;label:string;legacyNiche?:OrganizationNiche;services:readonly string[]};
type Category={id:string;label:string;niche:OrganizationNiche;specialties:readonly Specialty[]};
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
function category(id:string,label:string,niche:OrganizationNiche,labels:string[],services:string[]):Category{
 return {id,label,niche,specialties:labels.map(label=>({id:slug(label),label,services}))};
}
/** Selection context, not a list of services a business is assumed to provide. Retail is intentionally team-managed. */
export const BUSINESS_CATEGORIES:readonly Category[]=[
 category('trades','Trades & construction','trades',['Electrician','Plumber','Heating engineer','Carpenter / joiner','Builder','Roofer','Painter / decorator','Plasterer','Tiler','Flooring installer','Locksmith','Windows & glazing','Groundwork','Multi-trade'],['Repair enquiries','Installation enquiries','Maintenance enquiries','Quotes and estimates']),
 category('home_services','Home & property maintenance','home_services',['Cleaning','Gardening / landscaping','Property maintenance','Pest control','Appliance repair','Removals / storage','Waste removal'],['Service enquiries','Quotes and estimates','Appointments','Existing job enquiries']),
 category('beauty','Hair, beauty & grooming','beauty',['Hair salon','Barber','Nail salon','Beauty salon','Lashes / brows','Waxing','Makeup artist','Tanning','Spa'],['Appointments','Service enquiries','Prices from our confirmed price list','Existing booking enquiries']),
 category('health','Health & care','other',['GP / medical practice','Dental practice','Physiotherapy','Optician','Pharmacy','Counselling / psychotherapy','Podiatry','Home care'],['Appointment enquiries','Opening hours and location','Existing appointment enquiries','Requests for the practice team']),
 category('fitness','Fitness & wellbeing','fitness',['Gym','Personal trainer','Yoga','Pilates','Sports coaching','Massage'],['Class enquiries','Appointments','Membership enquiries','Existing booking enquiries']),
 category('hospitality','Food & hospitality','hospitality',['Restaurant','Café','Takeaway','Pub / bar','Catering','Hotel','Guesthouse / B&B','Holiday accommodation'],['Booking enquiries','Opening hours','Group enquiries','Existing booking enquiries']),
 category('automotive','Automotive','automotive',['Garage / mechanic','Tyre centre','Body repair','Vehicle dealership','Vehicle recovery','Valeting / detailing','Vehicle rental'],['Service enquiries','Quotes and estimates','Appointments','Existing job enquiries']),
 category('professional','Professional & business services','professional_services',['Accountant / bookkeeper','Solicitor','Consultant','Architect','Engineer','Surveyor','Recruitment agency','Insurance broker','Financial adviser'],['Initial enquiries','Appointments','Existing client enquiries','Requests for the team']),
 category('property','Property services','professional_services',['Estate agent','Letting agent','Property management','Accommodation management'],['Viewing enquiries','Property enquiries','Existing client enquiries','Maintenance requests']),
 category('education','Education & training','education',['Tutor','Language school','Driving instructor','Training provider','Music teacher','Dance school','Childcare'],['Course enquiries','Lesson enquiries','Enrolment enquiries','Existing booking enquiries']),
 category('pets','Pets & animals','other',['Veterinary practice','Pet groomer','Boarding kennels / cattery','Dog walker','Animal trainer','Equestrian services'],['Appointments','Service enquiries','Existing booking enquiries','Requests for the team']),
 category('events','Events & creative services','events',['Event planner','Event venue','Photographer','Videographer','Entertainment','Equipment hire','Designer'],['Event enquiries','Quotes and estimates','Availability enquiries','Existing booking enquiries']),
 category('technology','Technology & communications','professional_services',['IT support','Computer / phone repair','Software business','Web agency','Telecoms provider'],['Support enquiries','Service enquiries','Quotes and estimates','Existing customer enquiries']),
 category('transport','Transport & logistics','other',['Taxi / chauffeur','Courier','Haulage','Passenger transport','Delivery service'],['Booking enquiries','Quotes and estimates','Existing delivery enquiries','Requests for the team']),
 category('agriculture','Agriculture & rural services','other',['Farm business','Agricultural contractor','Agricultural machinery repair','Forestry services'],['Service enquiries','Quotes and estimates','Existing job enquiries','Requests for the team']),
 category('community','Community & organisations','other',['Charity','Community organisation','Sports club','Membership organisation'],['General enquiries','Membership enquiries','Event enquiries','Requests for the team']),
 category('other','Other business','other',['Other speciality'],['General enquiries','Appointments','Quotes and estimates','Requests for the team']),
].map(c=>c.id==='beauty'?{...c,specialties:c.specialties.map(s=>({...s,legacyNiche:s.id==='hair_salon'?'hair_salon' as const:s.id==='barber'?'barber' as const:'beauty' as const}))}:c);
/** Choices for new setup; BUSINESS_CATEGORIES remains the historical parsing registry. */
export const SETUP_BUSINESS_CATEGORIES=BUSINESS_CATEGORIES.map(category=>({...category,specialties:category.specialties.filter(speciality=>isLaunchSpeciality(speciality.id))})).filter(category=>category.specialties.length);
const SPECIFIC_SERVICES:Record<string,readonly string[]>={
 electrician:['Electrical repairs','Rewiring','Lighting installation','Electrical inspections','EV charger installation','Solar PV installation','Emergency electrical callouts'],
 plumber:['Leak repairs','Pipework','Bathroom plumbing','Drain blockages','Heating repairs','Emergency plumbing callouts'],
 heating_engineer:['Boiler servicing','Boiler repairs','Heating installation','Heat pumps','Heating controls'],
 hair_salon:['Haircuts','Colouring','Blow-dries','Styling','Extensions'],barber:['Haircuts','Beard trims','Shaves'],
};
export function parseBusinessClassification(raw:unknown):BusinessClassification|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const value=raw as Record<string,unknown>;
 if(value.version!==BUSINESS_CATALOG_VERSION||typeof value.categoryId!=='string'||!Array.isArray(value.specialtyIds)||value.specialtyIds.length<1||value.specialtyIds.length>8)return null;
 const c=BUSINESS_CATEGORIES.find(c=>c.id===value.categoryId);if(!c)return null;
 if(value.specialtyIds.some(id=>typeof id!=='string'||!c.specialties.some(s=>s.id===id))||new Set(value.specialtyIds).size!==value.specialtyIds.length)return null;
 return {version:1,categoryId:c.id,specialtyIds:[...value.specialtyIds] as string[]};
}
export function classificationFromFields(raw:Record<string,string>):BusinessClassification|null{
 try{return parseBusinessClassification(JSON.parse(raw.businessClassification??''));}catch{return null;}
}
export function classificationLabels(value:BusinessClassification){
 const c=BUSINESS_CATEGORIES.find(c=>c.id===value.categoryId)!;
 return {category:c,specialties:value.specialtyIds.map(id=>c.specialties.find(s=>s.id===id)!)};
}
export function classificationBusinessType(value:BusinessClassification){return classificationLabels(value).specialties.map(s=>s.label).join(', ');}
/** Non-retail businesses use the general workspace; classification retains their exact scope. */
export function classificationNiche(_value:BusinessClassification):OrganizationNiche{return 'other';}
export function classificationServiceSuggestions(value:BusinessClassification|null):string[]{
 if(!value)return [];const {specialties}=classificationLabels(value);
 return [...new Set(specialties.flatMap(s=>[...(SPECIFIC_SERVICES[s.id]??s.services)]))];
}
export function businessScopeGuidance(raw:unknown):string|undefined{
 const value=parseBusinessClassification(raw);if(!value)return undefined;
 const {category,specialties}=classificationLabels(value);
 return `BUSINESS SCOPE (owner-selected): ${category.label} → ${specialties.map(s=>s.label).join(', ')}. This identifies the business, whether a company or sole trader, and provides context rather than confirmation of every service in this niche. Consider all selected specialities and explicit confirmed services. Politely decline clearly unrelated work unless the business explicitly lists it as offered; clarify when a term has multiple meanings. For a plausible but unconfirmed service, offer to take a message for the team to confirm without saying the service is unavailable. Explicit exclusions constrain broad offerings. Never infer prices, qualifications, certification, availability, emergency cover or booking capabilities from this classification. Do not give regulated professional advice based on the classification.`;
}
