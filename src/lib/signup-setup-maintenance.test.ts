import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(patch:Record<string,unknown>={},expired=true){
 const cancelled:string[]=[],released:string[]=[],receipts:string[]=[],enrollments:Record<string,unknown>[]=[];
 const hold={organization_id:'org',account_id:'account',subscription_id:'sub_hold'};
 const subscription={id:'sub_hold',status:'trialing',pause_collection:{behavior:'void'},metadata:{cliste_trial_activation:'forwarded_call',cliste_signup_flow:'simple_v1',cliste_account_id:'account',cliste_organization_id:'org'},...patch};
 const admin={from:(table:string)=>table==='phone_numbers'?{select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'number'},error:null})})})})}:{upsert:async(value:Record<string,unknown>)=>{enrollments.push(value);return {error:null};},select:()=>({is:()=>({eq:()=>({lte:()=>({order:()=>({limit:async()=>({data:[hold],error:null})})})})})}),update:()=>({eq:()=>({not:async()=>{receipts.push('complete');return {error:null};}})})},rpc:async(name:string)=>({data:name==='signup_setup_rollout_candidates'?[{...hold,completed_at:'2026-10-25T00:00:00Z'}]:expired,error:null})};
 const mocks:Record<string,unknown>={'server-only':{},'@/utils/supabase/admin':{createAdminClient:()=>admin},'@/lib/stripe':{getStripeClient:()=>({subscriptions:{retrieve:async()=>subscription,cancel:async(id:string,options:unknown)=>{assert.equal(JSON.stringify(options),JSON.stringify({invoice_now:false,prorate:false}));cancelled.push(id);}}})},'@/lib/phone-pool':{releaseOrganizationPhoneNumber:async(id:string)=>{released.push(id);return {ok:true};}}};
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./signup-setup-maintenance.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:(name:string)=>mocks[name],Date,Error});
 return {run:(module.exports as {expireAbandonedSignupSetups:()=>Promise<void>}).expireAbandonedSignupSetups,cancelled,released,receipts,enrollments,enroll:(module.exports as {enrollLegacySignupSetupHolds:()=>Promise<void>}).enrollLegacySignupSetupHolds};
}
test('an expired paused setup is cancelled without charges and its number quarantined',async()=>{const f=fixture();await f.run();assert.deepEqual(f.cancelled,['sub_hold']);assert.deepEqual(f.released,['org']);assert.equal(f.receipts.length,1);});
test('activated, unpaused and unexpired subscriptions are never cancelled',async()=>{for(const f of [fixture({pause_collection:null}),fixture({metadata:{cliste_trial_activation:'forwarded_call',cliste_signup_flow:'simple_v1',cliste_account_id:'account',cliste_organization_id:'org',cliste_connection_verified_at:'now'}}),fixture({},false)]){await f.run();assert.equal(f.cancelled.length,0);assert.equal(f.released.length,0);}});
test('mismatched subscription identity cannot release a customer number',async()=>{const f=fixture({metadata:{cliste_account_id:'another-account'}});await assert.rejects(f.run);assert.equal(f.cancelled.length,0);assert.equal(f.released.length,0);});
test('retrying after cancellation finishes quarantine without cancelling twice',async()=>{const f=fixture({status:'canceled'});await f.run();assert.equal(f.cancelled.length,0);assert.deepEqual(f.released,['org']);});

test('legacy rollout only restricts positively verified paused setup holds',async()=>{
 const hold=fixture();await hold.enroll();assert.equal(hold.enrollments[0]?.restricted,true);assert.equal(hold.enrollments[0]?.expires_at,'2026-11-24T00:00:00.000Z');
 for(const candidate of [fixture({pause_collection:null}),fixture({metadata:{cliste_account_id:'someone-else'}})]){await candidate.enroll();assert.equal(candidate.enrollments[0]?.restricted,false);assert.equal(candidate.cancelled.length,0);assert.equal(candidate.released.length,0);}
});
