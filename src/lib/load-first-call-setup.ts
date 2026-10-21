import "server-only";
import {previousServiceConfiguration} from "./service-configuration-history";
import {smsPlanPricing} from "@/lib/sms-plan-pricing";
import {createAdminClient} from "@/utils/supabase/admin";
import type {DashboardSession} from "@/lib/dashboard-session";
import {hasAccountOwnerAccess} from "@/lib/account-owner-access";
import {isBusinessHoursUnset,parseBusinessHoursBundle,DAY_KEYS,DAY_LABELS} from "@/lib/business-hours";
import {parseGreetingParts,defaultVoiceGreetingIntro} from "@/lib/voice-greeting";
import {parsePlainTextOpeningHours} from "@/lib/parse-plain-text-hours";
import {FIRST_CALL_SECTIONS} from "@/lib/first-call-config";
import type {FirstCallSetupState} from "./first-call-setup";
export async function loadFirstCallSetup(session:DashboardSession,readOnly=false):Promise<FirstCallSetupState>{
 const admin=createAdminClient();
 const [orgResult,accountResult,setupResult,phoneResult,servicesResult,canManage]=await Promise.all([
  session.supabase.from("organizations").select("name,business_classification,service_starter_state,updated_at,address,storefront_eircode,agent_location_address,agent_location_eircode,phone_number,is_active,agent_business_type,raw_business_description,business_hours,agent_opening_hours,agent_services_departments,agent_services_not_offered,greeting,divert_verified_at").eq("id",session.organizationId).single(),
  session.supabase.from("accounts").select("name,plan_tier").eq("id",session.accountId).single(),
  admin.from("customer_first_call_setup").select("*").eq("organization_id",session.organizationId).maybeSingle(),
  admin.from("phone_numbers").select("e164,provider,notes").eq("organization_id",session.organizationId).eq("status","assigned").maybeSingle(),
  session.supabase.from("services").select("id").eq("organization_id",session.organizationId).limit(1),
  readOnly?Promise.resolve(false):hasAccountOwnerAccess(session.supabase,{userId:session.user.id,accountId:session.accountId,profileRole:session.profile.role}),
 ]);
 for(const result of [orgResult,accountResult,setupResult,phoneResult,servicesResult])if(result.error)throw new Error("Your setup progress could not be loaded. Please refresh and try again.");
 const o=orgResult.data!,setup=setupResult.data,number=phoneResult.data?.e164||o.phone_number||null;
 const completedSections:Record<string,string>={};
 for(const section of [...FIRST_CALL_SECTIONS,"forwarding"]){const value=setup?.completed_sections?.[section];if(typeof value==="string"&&Number.isFinite(Date.parse(value)))completedSections[section]=value;}
 const configuredAt=completedSections.greeting;
 let hadConversation=false;
 if(configuredAt){const result=await session.supabase.from("call_logs").select("id").eq("organization_id",session.organizationId).gte("created_at",configuredAt).gt("duration_seconds",10).eq("outcome","answered").not("engineer_test_call","is",true).limit(1);if(result.error)throw new Error("Your test-call status could not be checked. Please retry.");hadConversation=Boolean(result.data?.length);}
 const hours=isBusinessHoursUnset(o.business_hours)?String(o.agent_opening_hours??""):DAY_KEYS.map(day=>{const v=parseBusinessHoursBundle(o.business_hours).schedule[day];return `${DAY_LABELS[day]}: ${v.open?`${v.start}–${v.end}`:"Closed"}`;}).join("\n");
 const schedule=isBusinessHoursUnset(o.business_hours)?parsePlainTextOpeningHours(hours)?.schedule:parseBusinessHoursBundle(o.business_hours).schedule;
 const hourFields=Object.fromEntries(DAY_KEYS.flatMap(day=>[[`${day}_open`,schedule?.[day]?.open?"on":""],[`${day}_start`,schedule?.[day]?.start??"09:00"],[`${day}_end`,schedule?.[day]?.end??"17:00"]]));
 const hoursMeta=parseBusinessHoursBundle(o.business_hours).meta;
 Object.assign(hourFields,{holidayMode:hoursMeta.bankHolidays?.configured&&!hoursMeta.bankHolidays.usualHours?(hoursMeta.bankHolidays.open?"different":"closed"):"usual",holidayStart:hoursMeta.bankHolidays?.start??"10:00",holidayEnd:hoursMeta.bankHolidays?.end??"14:00",outsideAvailability:hoursMeta.outsideHours?.availability??"closed",smsAlerts:hoursMeta.outsideHours?.sms??"off",alertPhone:hoursMeta.outsideHours?.phone??""});
 const previousServices=(canManage||readOnly)?await previousServiceConfiguration(admin,session.organizationId,{services:o.agent_services_departments??"",notOffered:o.agent_services_not_offered??""}):null;
 const greetingParts=parseGreetingParts(o.greeting??"","Cara",defaultVoiceGreetingIntro(o.name));
 return {
  progressKey:`${session.organizationId}:${session.user.id}`,
  smsPricing:smsPlanPricing(accountResult.data?.plan_tier),
  forwardingReviewed:Boolean(completedSections.forwarding),
  dashboardUnlocked:Boolean(setup?.completed_sections?.dashboard),completedSections,configuration:{configurationVersion:o.updated_at??"",servicesConfigured:completedSections.services?"true":"false",serviceStarter:o.service_starter_state?JSON.stringify(o.service_starter_state):"",previousServices:previousServices?.services??"",previousNotOffered:previousServices?.notOffered??"",...hourFields,businessClassification:o.business_classification?JSON.stringify(o.business_classification):"",businessName:o.name??"",businessType:o.agent_business_type??"",description:o.raw_business_description??"",hours,services:o.agent_services_departments??"",notOffered:o.agent_services_not_offered??"",intro:greetingParts.intro,closing:greetingParts.closing},
  email:session.user.email??"",emailVerified:Boolean(session.user.email_confirmed_at),businessName:o.name,legalName:accountResult.data?.name??o.name,
  verificationStatus:setup?.verification_status??"not_submitted",reviewNote:setup?.review_note??null,ticketId:setup?.verification_ticket_id??null,
  details:{legalName:accountResult.data?.name??o.name,representative:session.profile.name??"",email:session.user.email??"",address:o.agent_location_address||o.address||"",eircode:o.agent_location_eircode||o.storefront_eircode||"",...(setup?.business_details??{})},
  number:/^\+[1-9]\d{7,14}$/.test(number??"")?number:null,isTestNumber:phoneResult.data?.provider==="manual"&&/\[(?:dev|smoke test)/i.test(phoneResult.data?.notes??""),lineEnabled:o.is_active===true,
  profileReady:Boolean(completedSections.profile&&o.agent_business_type),
  greetingReady:Boolean(completedSections.greeting&&o.greeting?.trim()),
  hoursReady:Boolean(completedSections.hours&&(!isBusinessHoursUnset(o.business_hours)||o.agent_opening_hours?.trim())),
  servicesReady:Boolean(o.agent_services_departments?.trim()||servicesResult.data?.length),
  hadConversation,
  forwardingVerified:Boolean(o.divert_verified_at),welcomeSeen:Boolean(setup?.welcome_seen_at),canManage,
 };
}
