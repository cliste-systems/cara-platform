import 'server-only';
import { deleteCallRecordingObjects } from './call-recordings-server';
import { createAdminClient } from '@/utils/supabase/admin';
import { ingestCallKnowledgeGaps } from './cara-training-ingest';
import { resolveAppSiteOrigin } from './booking-site-origin';
import { sendTransactionalEmail } from './resend-mail';
import { sendTwilioBookingSms } from './booking-confirmation-sms';

/** Invoked by the authenticated, minute-by-minute owner-alert scheduler. */
export async function processKnowledgeDeliveries() {
 const admin = createAdminClient();
 const {data:cleanup,error:cleanupError}=await admin.from('call_recording_cleanup').select('storage_path').order('created_at').limit(100);
 if(cleanupError)throw new Error('Recording cleanup queue could not be loaded.');
 for(const object of cleanup??[]) {
  await deleteCallRecordingObjects([object.storage_path]);
  const {error}=await admin.from('call_recording_cleanup').delete().eq('storage_path',object.storage_path);
  if(error)throw new Error('Recording cleanup confirmation could not be saved.');
 }
 const {data:calls,error:callError}=await admin.from('call_logs')
  .select('id,organization_id,pending_knowledge_gaps,knowledge_gap_attempts')
  .gt('created_at',new Date(Date.now()-30*24*60*60*1000).toISOString())
  .not('pending_knowledge_gaps','is',null).is('caller_data_erased_at',null)
  .lt('knowledge_gap_attempts',5).or(`knowledge_gap_retry_at.is.null,knowledge_gap_retry_at.lte.${new Date().toISOString()}`)
  .order('created_at').limit(10);
 if(callError)throw new Error('Knowledge retries could not be loaded.');
 for(const call of calls??[]) {
  const attempts=call.knowledge_gap_attempts+1;
  const {data:claimed,error:claimError}=await admin.from('call_logs').update({knowledge_gap_attempts:attempts,knowledge_gap_retry_at:new Date(Date.now()+300_000).toISOString()})
   .eq('id',call.id).eq('knowledge_gap_attempts',call.knowledge_gap_attempts).is('caller_data_erased_at',null).select('id');
  if(claimError||!claimed?.length)continue;
  try {
   await ingestCallKnowledgeGaps(admin,call.organization_id,call.id,call.pending_knowledge_gaps);
   const {error}=await admin.from('call_logs').update({pending_knowledge_gaps:null,knowledge_gap_retry_at:null}).eq('id',call.id);
   if(error)throw error;
  } catch { console.error('[knowledge-delivery] ingestion deferred',{callId:call.id,attempts}); }
 }
 const {data:jobs,error}=await admin.rpc('claim_knowledge_notifications');
 if(error)throw new Error('Knowledge notifications could not be claimed.');
 for(const job of jobs??[]) {
  let status='failed',errorCode:string|null=null,sendStarted=false;
  try {
   const {data:item,error:itemError}=await admin.from('cara_training_items').select('status,call_log_id').eq('id',job.item_id).eq('organization_id',job.organization_id).single();
   const {data:org,error:orgError}=await admin.from('organizations').select('notification_email,notification_phone,is_active').eq('id',job.organization_id).single();
   if(itemError||orgError)throw new Error('Settings unavailable');
   let erased=false;
   if(item.call_log_id){const {data:call,error}=await admin.from('call_logs').select('caller_data_erased_at').eq('id',item.call_log_id).eq('organization_id',job.organization_id).single();if(error)throw error;erased=Boolean(call.caller_data_erased_at);}
   const recipient=String(job.channel==='email'?org.notification_email??'':org.notification_phone??'').trim();
   if(!org.is_active||!recipient||erased||!['awaiting_answer','draft_ready'].includes(item.status)){status='skipped';}
   else {
    const link=`${resolveAppSiteOrigin().origin}/dashboard/cara-knowledge?tab=needs-input`;
    // Keep caller details out of email/SMS; answers require an authenticated session.
    const message=`HelloCara: Cara needs your answer to a business question. Review it: ${link}`;
    sendStarted=true;
    if(job.channel==='email') {
     const result=await sendTransactionalEmail({to:recipient,subject:'Cara needs your answer',text:message,idempotencyKey:`knowledge-${job.item_id}-email`});
     status=result.ok?'sent':'failed';errorCode=result.ok?null:'email_rejected';
    } else {
     const result=await sendTwilioBookingSms(recipient,message,{organizationId:job.organization_id,purpose:'cara_training_notify'});
     status=result.ok?'sent':result.uncertain?'unknown':'failed';errorCode=result.ok?null:'sms_delivery_failed';
    }
   }
  } catch {status=sendStarted?'unknown':'failed';errorCode=sendStarted?'provider_status_unknown':'settings_unavailable';}
  const retry=status==='failed'&&job.attempts<5;
  const {error:saveError}=await admin.from('knowledge_notifications').update({status:retry?'pending':status,error_code:errorCode,next_attempt_at:new Date(Date.now()+60_000*2**job.attempts).toISOString(),lease_expires_at:null})
   .eq('item_id',job.item_id).eq('channel',job.channel).eq('lease_token',job.lease_token);
  if(saveError)throw new Error('Knowledge notification status could not be saved.');
 }
 return {knowledgeCalls:calls?.length??0,knowledgeNotifications:jobs?.length??0};
}
