"use server";
import {cookies,headers} from "next/headers";
import {isLocalSetupTestEnabled,LOCAL_SETUP_COMPLETION_COOKIE,localSetupCompletionValue} from "@/lib/onboarding-dev";
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
 const admin=createAdminClient();
 const {data:existing,error:statusError}=await admin.from("customer_first_call_setup").select("verification_status").eq("organization_id",s.organizationId).maybeSingle();
 if(statusError)return {ok:false,message:"We could not check your submission. Please try again."};
 if(existing&&!['not_submitted','needs_information'].includes(existing.verification_status))return {ok:false,message:"Your business details have already been submitted and cannot be edited."};
 const d=parsed.details!;
 const body="Business details submitted for phone-number verification. Review these details and the applicable Twilio requirements separately from Cara setup. This is not a Twilio approval.\n\n"+Object.entries(d).map(([key,value])=>`${key}: ${value}`).join("\n");
 const {error}=await admin.rpc("submit_first_call_business",{p_org:s.organizationId,p_user:s.user.id,p_details:d,p_body:body});
 if(error) return {ok:false,message:"We could not submit your details. Please retry, or contact support if your details were already verified."};
 revalidatePath("/dashboard"); revalidatePath("/admin/support"); revalidatePath("/admin"); revalidatePath(`/admin/customers/${s.organizationId}`);
 return {ok:true,message:"Details received. Our team will review them and contact you if anything else is needed."};
}
export async function dismissFirstCallWelcome() {
 const s=await requireDashboardAdmin();
 const {loadFirstCallSetup}=await import("@/lib/load-first-call-setup");
 const {firstCallTestComplete,firstCallConfigurationReady}=await import("@/lib/first-call-setup");
 const state=await loadFirstCallSetup(s);
 if(isLocalSetupTestEnabled(await headers())&&firstCallConfigurationReady(state)){
  (await cookies()).set(LOCAL_SETUP_COMPLETION_COOKIE,localSetupCompletionValue(s.user.id,s.organizationId),{httpOnly:true,sameSite:"strict",path:"/",maxAge:3600});
  revalidatePath("/dashboard");return {ok:true};
 }
 if(!state.dashboardUnlocked&&!firstCallTestComplete(state))return {ok:false};
 const {data:unlocked,error}=await createAdminClient().rpc("unlock_first_call_dashboard",{p_org:s.organizationId});
 if(error||!unlocked) return {ok:false};
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
 const {canEditFirstCallSection}=await import("@/lib/first-call-setup");
 const {loadFirstCallSetup}=await import("@/lib/load-first-call-setup");
 const state=await loadFirstCallSetup(session);
 if(state.dashboardUnlocked)return {ok:false,message:"Your first-call setup is complete. Make further changes in your dashboard’s business settings."};
 if(!FIRST_CALL_SECTIONS.includes(section as import("@/lib/first-call-setup").FirstCallSection)||!canEditFirstCallSection(state,section))return {ok:false,message:"Complete the earlier setup sections first."};
 const {classificationFromFields}=await import("@/lib/business-classification");
 const parsed=firstCallConfigPatch(section as import("@/lib/first-call-setup").FirstCallSection,raw,state.businessName,classificationFromFields(state.configuration??{}));
 if(!parsed.ok)return parsed;
 if(section==='greeting'){
  const {reserveVoiceApiRequest,voiceApiFingerprint,voiceApiRateLimitMessage}=await import('@/lib/voice-api-rate-limit');
  const limit=await reserveVoiceApiRequest('greeting_review',voiceApiFingerprint(`first-call-greeting:${session.user.id}:${session.organizationId}`));
  if(!limit.allowed)return {ok:false,message:voiceApiRateLimitMessage(limit.retryAfterSeconds)};
  const {reviewVoiceGreetingSafe}=await import('@/lib/voice-greeting-review');
  const checked=await reviewVoiceGreetingSafe({businessName:state.businessName,greetingIntro:raw.intro??'',greetingClosing:raw.closing??''});
  if(checked.status==='blocked')return {ok:false,message:checked.suggestion.summary};
 }

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
 const {regenerateCaraCustomPrompt}=await import("@/lib/cara-prompt-from-org");
 const compiled=await regenerateCaraCustomPrompt(session.supabase,session.organizationId,{dryRun:true,orgPatch:patch}).catch(()=>null);
 if(!compiled?.ok||!compiled.prompt)return {ok:false,message:"Cara’s instructions could not be prepared. Your settings have not changed; please retry."};
 const {data:saved,error}=await createAdminClient().rpc("save_first_call_configuration",{p_org:session.organizationId,p_version:org.updated_at,p_section:section,p_patch:{...patch,custom_prompt:compiled.prompt,prompt_compile_warnings:compiled.warnings??null}});
 if(error||!saved)return {ok:false,message:"These settings changed while saving. Your draft is kept; refresh and try again."};
 revalidatePath("/dashboard");
 revalidatePath(`/admin/customers/${session.organizationId}`);
 return {ok:true,message:"Section saved."};
}

export async function savePhoneConnection(input:{businessNumber:string;phoneType:string;provider:string}) {
 const session=await requireDashboardAdmin();
 const {loadFirstCallSetup}=await import('@/lib/load-first-call-setup');
 const {firstCallTestComplete,firstCallConfigurationReady}=await import('@/lib/first-call-setup');
 const {normalizeConnectionNumber,connectionNumberIssue,CONNECTION_PHONE_TYPES,CONNECTION_PROVIDERS}=await import('@/lib/phone-connection');
 const state=await loadFirstCallSetup(session);
 if(!firstCallTestComplete(state)&&!(isLocalSetupTestEnabled(await headers())&&firstCallConfigurationReady(state)))return {ok:false as const,message:'Complete your test call first.'};
 const issue=connectionNumberIssue(String(input.businessNumber??''),input.phoneType,state.number);
 if(issue)return {ok:false as const,message:issue};
 const number=normalizeConnectionNumber(String(input.businessNumber??''));
 if(!number||number===state.number)return {ok:false as const,message:'Enter your existing Irish business number, not your Cara number.'};
 if(!CONNECTION_PHONE_TYPES.some(v=>v===input.phoneType)||!CONNECTION_PROVIDERS.some(v=>v===input.provider))return {ok:false as const,message:'Choose your phone type and provider.'};
 const admin=createAdminClient();
 const {data:existing,error:readError}=await admin.from('customer_phone_connections').select('*').eq('organization_id',session.organizationId).maybeSingle();
 if(readError)return {ok:false as const,message:'Your connection details could not be loaded.'};
 if(existing?.verified_at)return {ok:false as const,message:'Your connection is already confirmed. Contact support to change your number.'};
 const changed=existing?.business_number!==number;
 const payload={business_number:number,phone_type:input.phoneType,provider:input.provider,...(changed?{requested_at:new Date().toISOString(),support_ticket_id:null}:{} )};
 const result=existing?await admin.from('customer_phone_connections').update(payload).eq('organization_id',session.organizationId).is('verified_at',null).select('*').single():await admin.from('customer_phone_connections').insert({organization_id:session.organizationId,...payload}).select('*').single();
 if(result.error)return {ok:false as const,message:'Your connection details could not be saved. Please try again.'};
 // The caller applies the returned connection without replacing the active setup tree.
 // Refreshing this layout here can reset the instruction state while confirmation is resolving.
 return {ok:true as const,connection:result.data as import('@/lib/phone-connection').PhoneConnection};
}
export async function checkMyPhoneConnection() {
 const session=await requireDashboardAdmin();
 const {reserveVoiceApiRequest,voiceApiFingerprint}=await import('@/lib/voice-api-rate-limit');
 const limit=await reserveVoiceApiRequest('greeting_review',voiceApiFingerprint(`connection:${session.organizationId}`));
 if(!limit.allowed)return {ok:false as const,message:'Please wait a moment before checking again.'};
 try {
  const {checkPhoneConnection}=await import('@/lib/phone-connection-server');
  const result=await checkPhoneConnection(session.organizationId);
  revalidatePath('/dashboard');
  return {ok:true as const,...result};
 }catch{return {ok:false as const,message:'We could not confirm the connection yet. Your trial will wait until it is confirmed. Please retry or request help.'};}
}
export async function requestPhoneConnectionHelp() {
 const session=await requireDashboardAdmin(),admin=createAdminClient();
 const {data:connection,error}=await admin.from('customer_phone_connections').select('*').eq('organization_id',session.organizationId).single();
 if(error||!connection)return {ok:false as const,message:'Save your business phone details first.'};
 const {reserveVoiceApiRequest,voiceApiFingerprint}=await import('@/lib/voice-api-rate-limit');
 const rate=await reserveVoiceApiRequest('greeting_review',voiceApiFingerprint(`connection-help:${session.organizationId}`));
 if(!rate.allowed)return {ok:false as const,message:'Please wait before requesting help again.'};
 const {error:updateError}=await admin.rpc('request_connection_support',{p_org:session.organizationId,p_user:session.user.id});
 if(updateError)return {ok:false as const,message:'Your help request could not be sent. Please retry.'};
 revalidatePath('/dashboard/support');revalidatePath('/admin/support');revalidatePath('/admin');
 revalidatePath('/dashboard');return {ok:true as const};
}

/** Free formatting/range lookup only: never claims a live line or customer ownership. */
export async function inspectPhoneConnectionNumber(raw:string,phoneType:string) {
 const session=await requireDashboardAdmin();
 const {connectionNumberDetails,connectionNumberIssue,CONNECTION_PHONE_TYPES}=await import('@/lib/phone-connection');
 if(typeof raw!=='string'||raw.length>64||!CONNECTION_PHONE_TYPES.some(v=>v===phoneType))return {ok:false as const,message:'Enter your number and choose your phone type.'};
 const {data:org,error}=await session.supabase.from('organizations').select('phone_number').eq('id',session.organizationId).single();
 if(error)return {ok:false as const,message:'Your phone details could not be checked. Please retry.'};
 const issue=connectionNumberIssue(raw,phoneType,org?.phone_number??null);
 if(issue)return {ok:false as const,message:issue};
 const details=connectionNumberDetails(raw)!;
 const {reserveVoiceApiRequest,voiceApiFingerprint}=await import('@/lib/voice-api-rate-limit');
 const rate=await reserveVoiceApiRequest('greeting_review',voiceApiFingerprint(`phone-lookup:${session.organizationId}`));
 if(!rate.allowed)return {ok:false as const,message:'Please wait a moment before checking another number.'};
 const {lookupConnectionNumber}=await import('@/lib/phone-number-lookup');
 const status=await lookupConnectionNumber(details.number);
 if(status==='invalid')return {ok:false as const,message:'This number did not pass the number check. Please check the digits and area code.'};
 return {ok:true as const,details,lookup:status};
}

/** Number provisioning can need assistance before a forwarding record exists. */
export async function requestSetupNumberHelp(){
 const session=await requireDashboardAdmin();
 const {loadFirstCallSetup}=await import('@/lib/load-first-call-setup');
 const {firstCallConfigurationReady}=await import('@/lib/first-call-setup');
 const state=await loadFirstCallSetup(session);
 if(!firstCallConfigurationReady(state))return {ok:false as const,message:'Complete your business details, hours and greeting first.'};
 const {reserveVoiceApiRequest,voiceApiFingerprint}=await import('@/lib/voice-api-rate-limit');
 const limit=await reserveVoiceApiRequest('greeting_review',voiceApiFingerprint(`number-help:${session.organizationId}`));
 if(!limit.allowed)return {ok:false as const,message:'Please wait a moment before requesting help again.'};
 const admin=createAdminClient(),subject='Cara number setup assistance';
 const {data:existing,error:readError}=await admin.from('support_tickets').select('id').eq('organization_id',session.organizationId).eq('subject',subject).neq('status','closed').limit(1).maybeSingle();
 if(readError)return {ok:false as const,message:'Your help request could not be sent. Please try again.'};
 if(existing)return {ok:true as const};
 const {error}=await admin.from('support_tickets').insert({organization_id:session.organizationId,created_by:session.user.id,subject,body:'The customer needs help preparing their Cara phone line for the first test call. Their setup is saved. Please review number availability and line activation, then reply in this support conversation.',status:'open'});
 if(error)return {ok:false as const,message:'Your help request could not be sent. Please try again.'};
 revalidatePath('/dashboard/support');revalidatePath('/admin/support');revalidatePath('/admin');
 return {ok:true as const};
}
