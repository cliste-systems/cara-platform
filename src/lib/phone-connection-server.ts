import 'server-only';
import twilio from 'twilio';
import {createAdminClient} from '@/utils/supabase/admin';
import {getStripeClient} from '@/lib/stripe';
import {LAUNCHES,PLATFORM_TRIAL_DAYS} from '@/lib/cliste-plans';
import {isForwardingEvidence,type PhoneConnection} from './phone-connection';

/** A lease serialises workers; Stripe metadata and fee receipts survive idempotency expiry. */
export async function activateConnectedTrial(organizationId:string,connection:PhoneConnection) {
 if(!connection.verified_at||connection.trial_activated_at)return;
 const admin=createAdminClient();
 const {data:lease,error:leaseError}=await admin.rpc('claim_connection_activation',{p_org:organizationId});
 if(leaseError)throw leaseError;
 if(!lease)return;
 try {
  const {data:current,error:currentError}=await admin.from('customer_phone_connections').select('*').eq('organization_id',organizationId).single();
  if(currentError||!current)throw new Error('Connection evidence unavailable');
  if(current.trial_activated_at)return;
  connection=current;
  const {data:org,error}=await admin.from('organizations').select('account_id,is_active').eq('id',organizationId).single();
  if(error||!org?.account_id||!org.is_active)throw new Error('Connection billing account unavailable or line disabled');
  const {data:account,error:accountError}=await admin.from('accounts').select('platform_subscription_id').eq('id',org.account_id).single();
  if(accountError||!account?.platform_subscription_id)throw new Error('Connection subscription unavailable');
  const stripe=getStripeClient(),sub=await stripe.subscriptions.retrieve(account.platform_subscription_id);
  let trialEndsAt:string|null=null;
  if(sub.metadata.cliste_trial_activation==='forwarded_call') {
   if(sub.metadata.cliste_organization_id!==organizationId||sub.metadata.cliste_account_id!==org.account_id||sub.metadata.cliste_signup_flow!=='simple_v1')throw new Error('Connection subscription mismatch');
   const setupCancellation=Boolean(sub.cancel_at&&String(sub.cancel_at)===sub.metadata.cliste_setup_hold_expires&&sub.cancel_at>Math.floor(Date.now()/1000));
   if(!['trialing','active'].includes(sub.status)||sub.cancel_at_period_end||(sub.cancel_at&&!setupCancellation))throw new Error('Subscription is not eligible to start');
   const alreadyActivated=sub.metadata.cliste_connection_verified_at===connection.verified_at;
   if(alreadyActivated) {
    if(!sub.trial_end)throw new Error('Activated subscription is missing its trial receipt');
    trialEndsAt=new Date(sub.trial_end*1000).toISOString();
   } else {
    // A lengthy outage must not consume the customer's entire trial before activation.
    const originalEnd=Math.floor(Date.parse(connection.verified_at!)/1000)+PLATFORM_TRIAL_DAYS*86400;
    let trialEnd=current.trial_ends_at?Math.floor(Date.parse(current.trial_ends_at)/1000):originalEnd;
    if(trialEnd<=Date.now()/1000+60)trialEnd=Math.floor(Date.now()/1000)+PLATFORM_TRIAL_DAYS*86400;
    trialEndsAt=new Date(trialEnd*1000).toISOString();
    const {error:deadlineError}=await admin.from('customer_phone_connections').update({trial_ends_at:trialEndsAt}).eq('organization_id',organizationId).eq('activation_lease_until',lease);
    if(deadlineError)throw deadlineError;
    const launch=sub.metadata.cliste_launch_tier;
    if(launch==='remote'||launch==='onsite_dublin') {
     let feeId=current.setup_invoice_item_id;
     if(!feeId) {
      // A remote success followed by a local outage may have no local receipt yet.
      // Search existing items before creating, even when Stripe's idempotency key has expired.
      let scanned=0;
      for await(const item of stripe.invoiceItems.list({customer:typeof sub.customer==='string'?sub.customer:sub.customer.id,limit:100})) {
       if((item.metadata?.cliste_connection_setup===sub.id||item.metadata?.cliste_subscription_id===sub.id)&&item.amount===LAUNCHES[launch].priceCents&&item.currency==='eur'){feeId=item.id;break;}
       if(++scanned>=1000)throw new Error('Setup fee history needs billing review');
      }
      if(!feeId) {
       const prices=await stripe.prices.list({lookup_keys:[`cliste_setup_${launch}_once`],active:true,limit:1}),price=prices.data[0];
       if(!price||price.currency!=='eur'||price.unit_amount!==LAUNCHES[launch].priceCents)throw new Error('Setup price unavailable');
       const fee=await stripe.invoiceItems.create({customer:typeof sub.customer==='string'?sub.customer:sub.customer.id,subscription:sub.id,pricing:{price:price.id},quantity:1,metadata:{cliste_subscription_id:sub.id,cliste_connection_setup:sub.id}}, {idempotencyKey:`connected-setup-fee-${sub.id}`});
       feeId=fee.id;
      }
      const {error:feeError}=await admin.from('customer_phone_connections').update({setup_invoice_item_id:feeId}).eq('organization_id',organizationId).eq('activation_lease_until',lease);
      if(feeError)throw feeError;
     }
    }
    await stripe.subscriptions.update(sub.id,{trial_end:trialEnd,pause_collection:'',...(sub.cancel_at?{cancel_at:'' as const}:{}),proration_behavior:'none',metadata:{cliste_connection_verified_at:connection.verified_at!}}, {idempotencyKey:`connected-trial-${sub.id}-${trialEnd}`});
   }
   const {error:eligibilityError}=await admin.from('signup_billing_eligibility').update({trial_ends_at:trialEndsAt}).eq('account_id',org.account_id).eq('completed_subscription_id',sub.id);
   if(eligibilityError)throw eligibilityError;
  }
  const {error:orgStampError}=await admin.from('organizations').update({divert_verified_at:connection.verified_at,divert_verified_by:current.assisted_by??null,store_public_number:connection.business_number}).eq('id',organizationId);
  if(orgStampError)throw orgStampError;
  const {error:stampError}=await admin.from('customer_phone_connections').update({trial_activated_at:new Date().toISOString(),trial_ends_at:trialEndsAt,activation_last_error:null}).eq('organization_id',organizationId).eq('activation_lease_until',lease);
  if(stampError)throw stampError;
 } catch(error) {
  await admin.from('customer_phone_connections').update({activation_last_error:'Activation needs retry',activation_next_attempt_at:new Date(Date.now()+15*60000).toISOString()}).eq('organization_id',organizationId).eq('activation_lease_until',lease);
  throw error;
 } finally {
  await admin.from('customer_phone_connections').update({activation_lease_until:null}).eq('organization_id',organizationId).eq('activation_lease_until',lease);
 }
}

/** Read carrier evidence directly from Twilio, never from client-provided success flags. */
export async function checkPhoneConnection(organizationId:string) {
 const admin=createAdminClient();
 const {data:connection,error}=await admin.from('customer_phone_connections').select('*').eq('organization_id',organizationId).maybeSingle();
 if(error)throw error;
 if(!connection)return {connected:false};
 if(connection.verified_at){await activateConnectedTrial(organizationId,connection);const {data:receipt}=await admin.from('customer_phone_connections').select('trial_activated_at').eq('organization_id',organizationId).single();return {connected:Boolean(receipt?.trial_activated_at)};}
 const {data:org,error:orgError}=await admin.from('organizations').select('phone_number,is_active').eq('id',organizationId).single();
 if(orgError||!org?.phone_number||!org.is_active)return {connected:false};
 const sid=process.env.TWILIO_ACCOUNT_SID?.trim(), token=process.env.TWILIO_AUTH_TOKEN?.trim();
 if(!sid||!token)throw new Error('Connection checks are temporarily unavailable');
 const {data:calls,error:callError}=await admin.from('call_logs').select('call_sid').eq('organization_id',organizationId).gte('created_at',connection.requested_at).gt('duration_seconds',10).in('outcome',['answered','link_sent','callback_requested','action_created','transferred']).not('engineer_test_call','is',true).order('created_at',{ascending:false}).limit(10);
 if(callError)throw callError;
 const client=twilio(sid,token,{timeout:7000,maxRetries:0});
 const evidence=await Promise.all((calls??[]).filter(row=>/^CA[a-f0-9]{32}$/i.test(row.call_sid??'')).map(row=>client.calls(row.call_sid).fetch().catch(()=>null)));
 let needsAssistedReview=false;
 for(const call of evidence) {
  if(!call)continue;
  // A genuine incoming call with no forwarding metadata needs staff review;
  // it must never automatically start the trial or prove number ownership.
  if(!call.forwardedFrom&&isForwardingEvidence({...call,forwardedFrom:connection.business_number},{businessNumber:connection.business_number,caraNumber:org.phone_number,requestedAt:connection.requested_at}))needsAssistedReview=true;
  if(!isForwardingEvidence(call,{businessNumber:connection.business_number,caraNumber:org.phone_number,requestedAt:connection.requested_at}))continue;
  const at=call.endTime?.toISOString()??new Date().toISOString();
  const {data:confirmed,error:confirmError}=await admin.from('customer_phone_connections').update({verified_at:at,verified_call_sid:call.sid}).eq('organization_id',organizationId).eq('business_number',connection.business_number).eq('requested_at',connection.requested_at).is('verified_at',null).select('*').maybeSingle();
  if(confirmError)throw confirmError;
  if(confirmed) {
   await activateConnectedTrial(organizationId,confirmed);
   const {data:receipt}=await admin.from('customer_phone_connections').select('trial_activated_at').eq('organization_id',organizationId).single();
   return {connected:Boolean(receipt?.trial_activated_at)};
  }
 }
 return {connected:false,needsAssistedReview};
}

/** Bounded recovery piggybacks on the existing call-analysis scheduler. */
export async function retryConnectedTrials(){
 const {data:rows,error}=await createAdminClient().from('customer_phone_connections').select('*').not('verified_at','is',null).is('trial_activated_at',null).lte('activation_next_attempt_at',new Date().toISOString()).order('activation_next_attempt_at',{ascending:true}).limit(2);
 if(error)throw error;
 for(const row of rows??[]){
  try{await activateConnectedTrial(row.organization_id,row);}
  catch(error){const {captureObservedError}=await import('@/lib/observability');await captureObservedError(error,{route:'phone-connection/trial-retry',orgId:row.organization_id});}
 }
}
