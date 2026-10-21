import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createAdminClient} from '@/utils/supabase/admin';
import {parseBusinessHoursBundle} from './business-hours';
import {classifyCallUrgency,callHasMessage,normalizeAlertMobile} from './outside-hours-policy';
import {sendTwilioBookingSms} from './booking-confirmation-sms';
import {resolveAppSiteOrigin} from './booking-site-origin';

const EXCLUDED=['blocked','spam_or_abuse','failed','voicemail_or_no_speech'];
export async function queueOwnerCallAlert(admin:SupabaseClient,callId:string,options:{deliver?:boolean}={}) {
 const {data:call,error}=await admin.from('call_logs').select('id,organization_id,outcome,ai_summary,transcript,is_test_call,engineer_test_call,caller_data_erased_at').eq('id',callId).single();
 if(error)throw new Error('Call alert evidence could not be loaded.');
 if(!call||call.is_test_call||call.engineer_test_call||call.caller_data_erased_at||EXCLUDED.includes(call.outcome))return;
 const urgent=classifyCallUrgency(call.ai_summary??'',call.transcript??'');
 // Flagging is independent of the owner's notification preferences.
 const {error:flagError}=await admin.from('call_logs').update({is_urgent:urgent}).eq('id',callId).is('caller_data_erased_at',null);
 if(flagError)throw new Error('Call urgency could not be saved.');
 const {data:org,error:orgError}=await admin.from('organizations').select('business_hours,is_active').eq('id',call.organization_id).single();
 if(orgError)throw new Error('Call alert settings could not be loaded.');
 const policy=parseBusinessHoursBundle(org?.business_hours).meta.outsideHours;
 if(!org?.is_active||!policy||policy.sms==='off'||(policy.sms==='urgent'&&!urgent)||!callHasMessage(call.outcome,call.ai_summary??'',urgent))return;
 const {data:queued,error:queueError}=await admin.from('owner_call_sms_alerts').upsert({call_log_id:callId,organization_id:call.organization_id},{onConflict:'call_log_id',ignoreDuplicates:true}).select('call_log_id');
 if(queueError)throw new Error('Call alert could not be queued.');
 if(queued?.length)await admin.from('call_logs').update({owner_sms_status:'pending'}).eq('id',callId);
 if(options.deliver)await processOwnerCallAlerts({admin,callId});
}

export async function processOwnerCallAlerts(options:{admin?:SupabaseClient;callId?:string;send?:typeof sendTwilioBookingSms}={}) {
 const admin=options.admin??createAdminClient();
 // A timed-out worker might already have handed the message to Twilio. Never
 // automatically resend it: expose the uncertain state for staff to review.
 const {data:expired,error:expiryError}=await admin.from('owner_call_sms_alerts').update({status:'unknown',next_attempt_at:null,error_code:'send_interrupted'}).eq('status','sending').lt('lease_expires_at',new Date().toISOString()).select('call_log_id');
 if(expiryError)throw new Error('Call alert leases could not be checked.');
 for(const job of expired??[])await admin.from('call_logs').update({owner_sms_status:'unknown'}).eq('id',job.call_log_id);
 const {data:jobs,error}=await admin.rpc('claim_owner_call_sms_alerts',{p_call_id:options.callId??null});
 if(error)throw new Error('Call alerts could not be claimed.');
 for(const job of jobs??[]) {
  let status='failed',errorCode:string|null='delivery_failed',retry=false,sendStarted=false;
  try {
   const {data:call,error:callError}=await admin.from('call_logs').select('id,organization_id,outcome,is_urgent,ai_summary,is_test_call,engineer_test_call,caller_data_erased_at').eq('id',job.call_log_id).eq('organization_id',job.organization_id).single();
   if(callError)throw new Error('Call unavailable');
   const {data:org,error:orgError}=await admin.from('organizations').select('business_hours,is_active').eq('id',job.organization_id).single();
   if(orgError)throw new Error('Settings unavailable');
   const policy=parseBusinessHoursBundle(org?.business_hours).meta.outsideHours;
   const phone=policy&&normalizeAlertMobile(policy.phone);
   if(!call||!org?.is_active||call.caller_data_erased_at||call.is_test_call||call.engineer_test_call||EXCLUDED.includes(call.outcome)||!policy||policy.sms==='off'||!phone||(policy.sms==='urgent'&&!call.is_urgent)||!callHasMessage(call.outcome,call.ai_summary??'',call.is_urgent)) {
    status='skipped';errorCode=null;
   } else {
    // Keep caller names, phone numbers, transcripts and sensitive details out
    // of SMS. The authenticated call record contains the complete message.
    const link=`${resolveAppSiteOrigin().origin}/dashboard/call-history?call=${call.id}`;
    const message=`HelloCara: ${call.is_urgent?'Urgent enquiry':'New message'}. View call: ${link}`;
    sendStarted=true;
    const result=await (options.send??sendTwilioBookingSms)(phone,message,{organizationId:job.organization_id,purpose:'owner_call_alert'});
    if(result.ok){status='sent';errorCode=null;}
    else if(result.uncertain){status='unknown';errorCode='provider_status_unknown';}
    else {retry=result.retryable!==false&&job.attempts<3;errorCode='provider_rejected';}
   }
  } catch {if(sendStarted){status='unknown';errorCode='provider_status_unknown';}else{retry=job.attempts<3;errorCode='settings_unavailable';}} 
  const {error:saveError}=await admin.from('owner_call_sms_alerts').update({status,error_code:errorCode,sent_at:status==='sent'?new Date().toISOString():null,next_attempt_at:retry?new Date(Date.now()+60_000*2**job.attempts).toISOString():null,lease_expires_at:null}).eq('call_log_id',job.call_log_id).eq('lease_token',job.lease_token);
  if(saveError)throw new Error('Call alert delivery status could not be saved.');
  await admin.from('call_logs').update({owner_sms_status:status==='sending'?'pending':status}).eq('id',job.call_log_id).eq('organization_id',job.organization_id);
 }
 return {processed:jobs?.length??0};
}
