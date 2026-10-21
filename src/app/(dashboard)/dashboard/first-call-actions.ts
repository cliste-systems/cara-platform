"use server";
import { revalidatePath } from "next/cache";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { validateVerificationDetails } from "@/lib/first-call-setup";
export async function saveFirstCallBusiness(raw: unknown, authority: boolean) {
 const s=await requireDashboardAdmin();
 if(authority!==true) return {ok:false,message:"Confirm you are authorised to provide these business details."};
 if(!s.user.email_confirmed_at)return {ok:false,message:"Confirm your email before submitting business details."};
 const parsed=validateVerificationDetails(raw);
 if(parsed.error) return {ok:false,message:parsed.error};
 const d=parsed.details!;
 const body="Business details submitted for phone-number verification. Review these details and the applicable Twilio requirements separately from Cara setup. This is not a Twilio approval.\n\n"+Object.entries(d).map(([key,value])=>`${key}: ${value}`).join("\n");
 const {error}=await createAdminClient().rpc("submit_first_call_business",{p_org:s.organizationId,p_user:s.user.id,p_details:d,p_body:body});
 if(error) return {ok:false,message:"We could not submit your details. Please retry, or contact support if your details were already verified."};
 revalidatePath("/dashboard"); revalidatePath("/admin/support"); revalidatePath("/admin"); revalidatePath(`/admin/customers/${s.organizationId}`);
 return {ok:true,message:"Details received. Our team will review them and contact you if anything else is needed."};
}
export async function dismissFirstCallWelcome() {
 const s=await requireDashboardAdmin();
 const {loadFirstCallSetup}=await import("@/lib/load-first-call-setup");
 const {firstCallTestComplete}=await import("@/lib/first-call-setup");
 const state=await loadFirstCallSetup(s);
 if(!state.dashboardUnlocked&&!firstCallTestComplete(state))return {ok:false};
 const at=new Date().toISOString();
 const {error}=await createAdminClient().from("customer_first_call_setup").upsert({organization_id:s.organizationId,welcome_seen_at:at,completed_sections:{...state.completedSections,forwarding:at,dashboard:at}},{onConflict:"organization_id"});
 if(error) return {ok:false};
 revalidatePath("/dashboard"); return {ok:true};
}

/** Prepare the authenticated owner's connected line after configuration, independently of business review. */
export async function retryFirstCallNumber(){
 const session=await requireDashboardAdmin();
 const {loadFirstCallSetup}=await import("@/lib/load-first-call-setup");
 const {firstCallConfigurationReady}=await import("@/lib/first-call-setup");
 const state=await loadFirstCallSetup(session);
 if(!firstCallConfigurationReady(state))return {ok:false,message:"Complete your business details, opening hours and greeting first."};
 const {data:account,error}=await session.supabase.from("accounts").select("status,platform_subscription_id").eq("id",session.accountId).single();
 if(error||account?.status!=="active"||!account.platform_subscription_id)return {ok:false,message:"Complete billing setup before preparing your number."};
 const {reserveSignupPoolNumber}=await import("@/lib/reserve-signup-number");
 try {
  const result=await reserveSignupPoolNumber(session.organizationId);
  if(!result.ok)return {ok:false,message:"No connected number is available right now. Contact setup help so we can connect your line."};
  const {data:activated,error:activationError}=await createAdminClient().rpc("activate_first_call_line",{p_org:session.organizationId});
  if(activationError||!activated)return {ok:false,message:"Your settings are saved, but your phone line could not be connected. Please try again or contact setup help."};
  revalidatePath("/dashboard");revalidatePath(`/admin/customers/${session.organizationId}`);
  return {ok:true,message:"Your Cara number is ready."};
 }catch{return {ok:false,message:"We could not prepare your phone line. Please try again or contact setup help."};}
}

/** Each write rechecks the current saved prerequisites; browser state cannot unlock it. */
export async function saveFirstCallSection(section:string,raw:Record<string,string>){
 const session=await requireDashboardAdmin();
 const {FIRST_CALL_SECTIONS,firstCallConfigPatch}=await import("@/lib/first-call-config");
 const {canEditFirstCallSection,nextFirstCallReceipts}=await import("@/lib/first-call-setup");
 const {loadFirstCallSetup}=await import("@/lib/load-first-call-setup");
 const state=await loadFirstCallSetup(session);
 if(state.dashboardUnlocked)return {ok:false,message:"Your first-call setup is complete. Make further changes in your dashboard’s business settings."};
 if(!FIRST_CALL_SECTIONS.includes(section as import("@/lib/first-call-setup").FirstCallSection)||!canEditFirstCallSection(state,section))return {ok:false,message:"Complete the earlier setup sections first."};
 const {classificationFromFields}=await import("@/lib/business-classification");
 const parsed=firstCallConfigPatch(section as import("@/lib/first-call-setup").FirstCallSection,raw,state.businessName,classificationFromFields(state.configuration??{}));
 if(!parsed.ok)return parsed;
 const {data:org,error:readError}=await session.supabase.from("organizations").select("name,niche,business_classification,service_starter_state,agent_business_type,raw_business_description,agent_services_departments,agent_services_not_offered,agent_opening_hours,agent_service_area,agent_details_to_collect,agent_business_rules,agent_faqs,business_hours,greeting,notification_email,notification_phone,business_knowledge_summary,updated_at").eq("id",session.organizationId).single();
 if(section==="profile"&&org?.niche==="retail")return {ok:false,message:"Retail setup is managed by our team."};
 if(readError||!org)return {ok:false,message:"Your business settings could not be loaded. Please try again."};
 if(raw.configurationVersion&&raw.configurationVersion!==org.updated_at)return {ok:false,message:"These settings changed in another tab. Your draft is kept; refresh before saving again."};
 if(section==="services"&&(org.agent_services_departments?.trim()||org.agent_services_not_offered?.trim())){
  const {archiveServiceConfiguration}=await import("@/lib/service-configuration-history");
  const archived=await archiveServiceConfiguration(createAdminClient(),session.organizationId,session.user.id,{services:org.agent_services_departments??"",notOffered:org.agent_services_not_offered??""},{services:String(parsed.patch.agent_services_departments??""),notOffered:String(parsed.patch.agent_services_not_offered??"")});
  if(!archived)return {ok:false,message:"Your previous services could not be backed up. Nothing has changed; please try again."};
 }
 const {buildKnowledgeSummaryFromAgentState}=await import("@/lib/persist-cara-agent-knowledge");
 const {parseAgentFaqs}=await import("@/app/(dashboard)/dashboard/agent-setup/agent-faqs");
 const {parseAgentBusinessRules}=await import("@/lib/agent-business-rules");
 const updated={...org,...parsed.patch};
 const patch={...parsed.patch,...(["profile","hours","services"].includes(section)?{business_knowledge_summary:buildKnowledgeSummaryFromAgentState({businessName:org.name,rawBusinessDescription:String(updated.raw_business_description??""),servicesOffered:String(updated.agent_services_departments??""),servicesNotOffered:String(updated.agent_services_not_offered??""),openingHours:String(updated.agent_opening_hours??""),serviceArea:org.agent_service_area??"",detailsToCollect:org.agent_details_to_collect??"",businessRules:parseAgentBusinessRules(org.agent_business_rules),faqs:parseAgentFaqs(org.agent_faqs)})}:{})};
 const stamp=new Date().toISOString();
 // Invalidate this and all later receipts before changing settings. A failed
 // save cannot leave an old test call authorising a newly edited setup.
 const sectionIndex=FIRST_CALL_SECTIONS.indexOf(section as import("@/lib/first-call-setup").FirstCallSection);
 const earlier=Object.fromEntries(FIRST_CALL_SECTIONS.slice(0,sectionIndex).flatMap(key=>state.completedSections?.[key]?[[key,state.completedSections[key]]]:[]));
 const {error:beginError}=await createAdminClient().from("customer_first_call_setup").upsert({organization_id:session.organizationId,completed_sections:earlier},{onConflict:"organization_id"});
 if(beginError)return {ok:false,message:"We could not start saving this section. Please try again."};
 let write=session.supabase.from("organizations").update({...patch,updated_at:stamp}).eq("id",session.organizationId);
 if(org.updated_at)write=write.eq("updated_at",org.updated_at);
 const {error}=await write.select("id").single();
 if(error)return {ok:false,message:"We could not save this section. Please try again."};
 const {regenerateCaraCustomPrompt}=await import("@/lib/cara-prompt-from-org");
 let compiled:{ok:boolean};
 try{compiled=await regenerateCaraCustomPrompt(session.supabase,session.organizationId);}catch{compiled={ok:false};}
 if(!compiled.ok){
  const previous=Object.fromEntries(Object.keys(patch).map(key=>[key,(org as Record<string,unknown>)[key]??null]));
  await session.supabase.from("organizations").update({...previous,updated_at:new Date().toISOString()}).eq("id",session.organizationId).eq("updated_at",stamp);
  return {ok:false,message:"Cara’s instructions could not be prepared. This section has not been completed; please retry."};
 }
 const {error:progressError}=await createAdminClient().from("customer_first_call_setup").upsert({organization_id:session.organizationId,completed_sections:nextFirstCallReceipts(state.completedSections??{},section as import("@/lib/first-call-setup").FirstCallSection,stamp)},{onConflict:"organization_id"});
 if(progressError)return {ok:false,message:"Your settings were saved, but section completion could not be recorded. Please save again before continuing."};
 revalidatePath("/dashboard");
 revalidatePath(`/admin/customers/${session.organizationId}`);
 return {ok:true,message:"Section saved."};
}
