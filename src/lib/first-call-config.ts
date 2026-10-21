import {businessSetupIssue,offeredServicesScopeIssue} from './business-onboarding-scope';
import {readStarterMetadata,missingStarterProfiles} from './service-starter';
import {firstServiceReview,readServiceReviewApprovals} from "./service-entry-safety";
import {serviceItems,serviceSelectionIssue} from "./service-selection";
import {normalizeAlertMobile, type OutsideHoursPolicy} from "./outside-hours-policy";
import {classificationFromFields,classificationBusinessType,classificationNiche,type BusinessClassification} from "./business-classification";
import { DAY_KEYS, serializeBusinessHours, type WeekSchedule } from "@/lib/business-hours";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
import { buildFullVoiceGreeting, defaultVoiceGreetingIntro, voiceLegalDisclosure } from "@/lib/voice-greeting";
import { sanitizeGreetingLine } from "@/lib/voice-greeting-security";
import { validateVoiceGreetingGuardrails } from "@/lib/voice-greeting-guardrails";
import type { FirstCallSection } from "./first-call-setup";
export const FIRST_CALL_SECTIONS: FirstCallSection[]=["profile","hours","services","greeting"];
export function firstCallConfigPatch(section:FirstCallSection,raw:Record<string,string>,businessName:string,classification:BusinessClassification|null=null):{ok:true;patch:Record<string,unknown>}|{ok:false;message:string}{
 const field=(key:string)=>String(raw[key]??"").trim();
 for(const [key,value] of Object.entries(raw)){if(typeof value!=="string"||value.length>(section==="services"&&["serviceReviewApprovals","serviceStarter"].includes(key)?30000:3000))return {ok:false,message:"Please keep each answer under 3,000 characters."};const violation=section==="services"&&["services","notOffered","serviceReviewApprovals","serviceStarter"].includes(key)?null:detectPromptInjectionViolation(value);if(violation)return {ok:false,message:violation.message};}
 if(section==="profile"){
  const classification=classificationFromFields(raw);
  if(!classification)return {ok:false,message:"Choose your industry and at least one speciality."};
  const scopeIssue=businessSetupIssue(classification);if(scopeIssue)return {ok:false,message:scopeIssue};
  if(field("description").length>3000)return {ok:false,message:"Keep your business notes under 3,000 characters."};
  return {ok:true,patch:{business_classification:classification,niche:classificationNiche(classification),agent_business_type:classificationBusinessType(classification),raw_business_description:field("description")||null}};
 }
 if(section==="hours"){
  const schedule={} as WeekSchedule;
  for(const day of DAY_KEYS){const open=field(`${day}_open`)==="on",start=field(`${day}_start`),end=field(`${day}_end`);if(open&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end))return {ok:false,message:"For open days, enter a closing time after the opening time. Times use the Europe/Dublin time zone."};schedule[day]={open,start:start||"09:00",end:end||"17:00"};}
  const text=DAY_KEYS.map(day=>`${day}: ${schedule[day].open?`${schedule[day].start}–${schedule[day].end}`:"Closed"}`).join("\n");
  const holidayMode=field("holidayMode")||"usual";
  const availability=field("outsideAvailability")||"closed",sms=field("smsAlerts")||"off";
  if(!["usual","closed","different"].includes(holidayMode)||!["closed","urgent_only","normal"].includes(availability)||!["off","urgent","all_messages"].includes(sms))return {ok:false,message:"Choose how Cara should handle holidays and calls outside your hours."};
  const start=field("holidayStart"),end=field("holidayEnd");
  if(holidayMode==="different"&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end))return {ok:false,message:"Enter holiday closing hours after the opening time."};
  const phone=sms==="off"?"":normalizeAlertMobile(field("alertPhone"));
  if(sms!=="off"&&!phone)return {ok:false,message:"Enter a mobile number for SMS alerts, e.g. 087 123 4567 or +353 87 123 4567."};
  const outsideHours:OutsideHoursPolicy={version:2,availability:availability as OutsideHoursPolicy['availability'],sms:sms as OutsideHoursPolicy['sms'],phone:phone||""};
  const meta={bankHolidays:{configured:true,usualHours:holidayMode==="usual",open:holidayMode!=="closed",start:start||"10:00",end:end||"14:00"},outsideHours};
  return {ok:true,patch:{business_hours:serializeBusinessHours(schedule,meta),agent_opening_hours:text}};
 }
 if(section==="services"){
  if(classification){const scopeIssue=businessSetupIssue(classification);if(scopeIssue)return {ok:false,message:scopeIssue};}
  const scopeIssue=offeredServicesScopeIssue(serviceItems(field("services")));if(scopeIssue)return {ok:false,message:scopeIssue};
  const starter=field("serviceStarter")?readStarterMetadata(field("serviceStarter"),classification):null;
  if(field("serviceStarter")&&!starter)return {ok:false,message:"Your service suggestions changed. Refresh and review your services before saving."};
  if(starter?.mode==="suggested"){const missing=missingStarterProfiles(classification,starter.profiles);if(missing.length)return {ok:false,message:`Choose service types for ${missing.join(', ')} or choose Start fresh.`};}

  const issue=serviceSelectionIssue(field("services"),field("notOffered"));
  if(issue)return {ok:false,message:issue.message};
  const review=firstServiceReview(serviceItems(field("services")),serviceItems(field("notOffered")),readServiceReviewApprovals(field("serviceReviewApprovals")),classification);
  if(review)return {ok:false,message:review.message};
  return {ok:true,patch:{agent_services_departments:serviceItems(field("services")).join("\n"),agent_services_not_offered:serviceItems(field("notOffered")).join("\n")||null,...(starter?{service_starter_state:starter}:{})}};
 }
 if(section==="greeting"){
  const intro=sanitizeGreetingLine(field("intro"))||defaultVoiceGreetingIntro(businessName),closing=sanitizeGreetingLine(field("closing"));
  const result=validateVoiceGreetingGuardrails({greetingIntro:intro,greetingClosing:closing,businessName});if(!result.ok)return result;
  const greeting=buildFullVoiceGreeting(intro,"Cara",closing);if(greeting.length>500||!greeting.includes(voiceLegalDisclosure("Cara")))return {ok:false,message:"Keep the greeting under 500 characters."};
  return {ok:true,patch:{greeting}};
 }
 return {ok:false,message:"This section is not part of first-call setup."};
}
