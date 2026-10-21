import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as setup from './first-call-setup';
const ready:setup.FirstCallSetupState={email:'qa@example.com',emailVerified:true,businessName:'[smoke test] Example',legalName:'Example',verificationStatus:'submitted',reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:true,hoursReady:true,greetingReady:true,servicesReady:false,hadConversation:false,forwardingVerified:false,welcomeSeen:false,canManage:true};
function fixture({state=ready,authorised=true,paid=true,available=true,activated=true,rpcError=false}={}){
 const reservations:string[]=[],activations:unknown[]=[];
 const accountQuery={select(){return this;},eq(){return this;},single:async()=>({data:{status:paid?'active':'onboarding',platform_subscription_id:paid?'sub_test':null},error:null})};
 const imports:Record<string,unknown>={
  'next/cache':{revalidatePath(){}},
  '@/lib/dashboard-admin':{requireDashboardAdmin:async()=>{if(!authorised)throw Error('Unauthorised');return {organizationId:'session-org',accountId:'session-account',user:{id:'owner'},supabase:{from:()=>accountQuery}};}},
  '@/lib/first-call-setup':setup,
  '@/lib/load-first-call-setup':{loadFirstCallSetup:async()=>state},
  '@/lib/reserve-signup-number':{reserveSignupPoolNumber:async(org:string)=>{reservations.push(org);return {ok:available};}},
  '@/utils/supabase/admin':{createAdminClient:()=>({rpc:async(name:string,args:unknown)=>{activations.push({name,args});return {data:activated,error:rpcError?{message:'failed'}:null};}})},
 };
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(dashboard)/dashboard/first-call-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>{if(!imports[name])throw Error('Unexpected import '+name);return imports[name];}});
 return {reservations,activations,...mod.exports as {retryFirstCallNumber:()=>Promise<{ok:boolean;message:string}>}};
}
test('pending review prepares and activates only the authenticated owner’s line',async()=>{
 const f=fixture();assert.equal((await f.retryFirstCallNumber()).ok,true);
 assert.deepEqual(f.reservations,['session-org']);
 assert.equal(JSON.stringify(f.activations),JSON.stringify([{name:'activate_first_call_line',args:{p_org:'session-org'}}]));
});
test('a request for extra business information does not block configured calls',async()=>{
 const f=fixture({state:{...ready,verificationStatus:'needs_information'}});assert.equal((await f.retryFirstCallNumber()).ok,true);
});
test('owner authentication runs before preparation',async()=>{
 const f=fixture({authorised:false});await assert.rejects(f.retryFirstCallNumber());assert.equal(f.reservations.length,0);
});
test('unfinished setup and unpaid accounts cannot prepare a line',async()=>{
 for(const patch of [{emailVerified:false},{verificationStatus:'not_submitted'},{profileReady:false},{hoursReady:false},{greetingReady:false}]){
  const f=fixture({state:{...ready,...patch}});assert.equal((await f.retryFirstCallNumber()).ok,false);assert.equal(f.reservations.length,0);
 }
 const f=fixture({paid:false});assert.equal((await f.retryFirstCallNumber()).ok,false);assert.equal(f.activations.length,0);
});
test('no connected inventory or failed activation cannot be reported as ready',async()=>{
 const noNumber=fixture({available:false});assert.equal((await noNumber.retryFirstCallNumber()).ok,false);assert.equal(noNumber.activations.length,0);
 for(const options of [{activated:false},{rpcError:true}])assert.equal((await fixture(options).retryFirstCallNumber()).ok,false);
});
