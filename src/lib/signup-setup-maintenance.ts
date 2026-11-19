import 'server-only';
import {createAdminClient} from '@/utils/supabase/admin';
import {getStripeClient} from '@/lib/stripe';
import {releaseOrganizationPhoneNumber} from '@/lib/phone-pool';

/** Bounded retries; only server-enrolled paused setup holds can be cancelled. */
export async function expireAbandonedSignupSetups(){
 const admin=createAdminClient();
 const {data:holds,error}=await admin.from('signup_setup_guards').select('*').is('cleanup_completed_at',null).eq('restricted',true).lte('expires_at',new Date().toISOString()).order('expires_at').limit(2);
 if(error)throw error;
 if(!holds?.length)return;
 const stripe=getStripeClient();
 for(const hold of holds){
  const sub=await stripe.subscriptions.retrieve(hold.subscription_id);
  if(sub.metadata.cliste_trial_activation!=='forwarded_call'||sub.metadata.cliste_signup_flow!=='simple_v1'||sub.metadata.cliste_account_id!==hold.account_id||sub.metadata.cliste_organization_id!==hold.organization_id)throw new Error('Setup hold identity mismatch');
  // Never cancel an already-activated, unpaused or unrelated subscription.
  if(sub.status!=='canceled'&&(!sub.pause_collection||sub.metadata.cliste_connection_verified_at))continue;
  const {data:expired,error:expiryError}=await admin.rpc('expire_signup_setup_hold',{p_org:hold.organization_id});
  if(expiryError)throw expiryError;
  if(!expired)continue;
  if(sub.status!=='canceled')await stripe.subscriptions.cancel(sub.id,{invoice_now:false,prorate:false});
  const {data:assigned,error:poolError}=await admin.from('phone_numbers').select('id').eq('organization_id',hold.organization_id).eq('status','assigned').maybeSingle();
  if(poolError)throw poolError;
  if(assigned){const released=await releaseOrganizationPhoneNumber(hold.organization_id);if(!released.ok)throw new Error('Setup number quarantine failed');}
  const {error:receiptError}=await admin.from('signup_setup_guards').update({cleanup_completed_at:new Date().toISOString()}).eq('organization_id',hold.organization_id).not('expired_at','is',null);
  if(receiptError)throw receiptError;
 }
}

/** Legacy enrollment requires a fresh Stripe read, never missing local receipts. */
export async function enrollLegacySignupSetupHolds(){
 const admin=createAdminClient();
 const {data:candidates,error}=await admin.rpc('signup_setup_rollout_candidates');
 if(error)throw error;
 if(!candidates?.length)return;
 const stripe=getStripeClient();
 for(const candidate of candidates){
  const sub=await stripe.subscriptions.retrieve(candidate.subscription_id);
  const restricted=sub.metadata.cliste_signup_flow==='simple_v1'
   &&sub.metadata.cliste_trial_activation==='forwarded_call'
   &&sub.metadata.cliste_organization_id===candidate.organization_id
   &&sub.metadata.cliste_account_id===candidate.account_id
   &&Boolean(sub.pause_collection)&&!sub.metadata.cliste_connection_verified_at
   &&['active','trialing'].includes(sub.status);
  const cutoff=new Date(Date.parse(candidate.completed_at)+30*86400000).toISOString();
  const {error:writeError}=await admin.from('signup_setup_guards').upsert({organization_id:candidate.organization_id,account_id:candidate.account_id,subscription_id:sub.id,expires_at:cutoff,restricted},{onConflict:'organization_id',ignoreDuplicates:true});
  if(writeError)throw writeError;
 }
}
