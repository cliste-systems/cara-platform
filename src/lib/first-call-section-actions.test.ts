import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as setup from './first-call-setup';
import * as config from './first-call-config';
import * as classification from './business-classification';
import {newStarterMetadata} from './service-starter';
const base:setup.FirstCallSetupState={email:'qa@example.com',emailVerified:true,businessName:'[smoke test] Example',legalName:'Example Limited',verificationStatus:'verified',reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:false,hoursReady:false,servicesReady:false,greetingReady:false,hadConversation:false,forwardingVerified:false,welcomeSeen:false,canManage:true};
function fixture(state=base,compiled=true,authorised=true,niche='trades',previousServices='',backupReady=true){
 const receipts:Record<string,unknown>[]=[],writes:Record<string,unknown>[]=[],org={agent_services_departments:previousServices,agent_services_not_offered:'',niche,business_classification:classification.classificationFromFields(state.configuration??{}),service_starter_state:state.configuration?.serviceStarter?JSON.parse(state.configuration.serviceStarter):null,name:base.businessName,raw_business_description:'Previous description',agent_business_type:'Previous type',updated_at:'2026-10-19T00:00:00Z'},filters:unknown[][]=[];
 const query={select(){return this;},eq(...args:unknown[]){filters.push(args);return this;},single:async()=>({data:org,error:null}),update(patch:Record<string,unknown>){writes.push(patch);return this;}};
 const imports:Record<string,unknown>={
  '@/lib/service-configuration-history':{archiveServiceConfiguration:async()=>backupReady},
  'next/cache':{revalidatePath(){}},'@/lib/dashboard-admin':{requireDashboardAdmin:async()=>{if(!authorised)throw new Error('Unauthorised');return {organizationId:'session-org',user:{id:'owner',email_confirmed_at:'2026-10-19'},supabase:{from:()=>query}};}},
  '@/lib/business-classification':classification,'@/lib/first-call-config':config,'@/lib/first-call-setup':setup,'@/lib/load-first-call-setup':{loadFirstCallSetup:async()=>state},
  '@/lib/persist-cara-agent-knowledge':{buildKnowledgeSummaryFromAgentState:()=> 'Compiled knowledge'},
  '@/app/(dashboard)/dashboard/agent-setup/agent-faqs':{parseAgentFaqs:()=>[]},'@/lib/agent-business-rules':{parseAgentBusinessRules:()=>[]},
  '@/lib/cara-prompt-from-org':{regenerateCaraCustomPrompt:async()=>({ok:compiled})},'@/utils/supabase/admin':{createAdminClient:()=>({from:()=>({upsert:async(data:Record<string,unknown>)=>{receipts.push(data);return {error:null};}})})},
 };
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(dashboard)/dashboard/first-call-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>{if(!imports[name])throw new Error('Unexpected import '+name);return imports[name];},Date,Object,String});
 return {writes,receipts,filters,...mod.exports as {saveFirstCallSection:(section:string,raw:Record<string,string>)=>Promise<{ok:boolean}>;dismissFirstCallWelcome:()=>Promise<{ok:boolean}>}};
}
const profile={businessClassification:JSON.stringify({version:1,categoryId:'trades',specialtyIds:['electrician']}),description:'We provide electrical repairs and installation enquiries.'};
test('section writes require owner authentication before reading or writing',async()=>{const f=fixture(base,true,false);await assert.rejects(f.saveFirstCallSection('profile',profile));assert.equal(f.writes.length,0);});
test('unsubmitted business and missing earlier sections block direct action invocation',async()=>{for(const state of [{...base,verificationStatus:'not_submitted'},{...base,emailVerified:false}]){const f=fixture(state);assert.equal((await f.saveFirstCallSection('profile',profile)).ok,false);assert.equal(f.writes.length,0);}const f=fixture();assert.equal((await f.saveFirstCallSection('notifications',{notificationEmail:'qa@example.com'})).ok,false);assert.equal(f.writes.length,0);});
test('valid saves use the session organization and whitelist configuration fields',async()=>{const f=fixture();assert.equal((await f.saveFirstCallSection('profile',{...profile,organizationId:'foreign',is_active:'true',verification_status:'verified'})).ok,true);assert.equal(f.writes[0].is_active,undefined);assert.equal(f.writes[0].verification_status,undefined);assert.ok((f.receipts.at(-1)!.completed_sections as Record<string,string>).profile);assert.ok(f.filters.some(v=>v[0]==='id'&&v[1]==='session-org'));assert.ok(!f.filters.some(v=>v.includes('foreign')));});
test('failed prompt compilation rolls back the section instead of completing it',async()=>{const f=fixture(base,false);assert.equal((await f.saveFirstCallSection('profile',profile)).ok,false);assert.equal(f.writes.length,2);assert.equal(f.writes[1].raw_business_description,'Previous description');});
test('the first-call dialog cannot be dismissed to skip the setup gate',async()=>{const f=fixture();assert.equal((await f.dismissFirstCallWelcome()).ok,false);assert.equal(f.writes.length,0);});

test('submitted businesses can save configuration while approval is pending',async()=>{const f=fixture({...base,verificationStatus:'submitted'});assert.equal((await f.saveFirstCallSection('profile',profile)).ok,true);assert.ok(f.writes.length>0);assert.equal(f.writes[0].is_active,undefined);});

test('removed notification section cannot write organization settings',async()=>{const f=fixture({...base,profileReady:true,hoursReady:true,servicesReady:true,greetingReady:true});assert.equal((await f.saveFirstCallSection('notifications',{notificationEmail:'qa@example.com'})).ok,false);assert.equal(f.writes.length,0);});

test("retail businesses cannot be reclassified by self-service",async()=>{const f=fixture(base,true,true,"retail");assert.equal((await f.saveFirstCallSection("profile",profile)).ok,false);assert.equal(f.writes.length,0);});


test('service chip saves use normalized organization fields and record completion only after compilation',async()=>{
 const f=fixture({...base,profileReady:true,hoursReady:true,completedSections:{profile:'2026-10-19T00:00:00Z',hours:'2026-10-19T00:00:00Z'}});
 const result=await f.saveFirstCallSection('services',{services:'Solar installation; Rewiring, rewiring',notOffered:'Appliance repairs'});
 assert.equal(result.ok,true);
 assert.equal(f.writes[0]?.agent_services_departments,'Solar installation\nRewiring');
 assert.equal(f.writes[0]?.agent_services_not_offered,'Appliance repairs');
 assert.ok((f.receipts.at(-1)?.completed_sections as Record<string,string>)?.services);
});
test('a cross-list service conflict never reaches the organization write',async()=>{
 const f=fixture({...base,profileReady:true,hoursReady:true});
 assert.equal((await f.saveFirstCallSection('services',{services:'Rewiring',notOffered:'rewiring'})).ok,false);
 assert.equal(f.writes.length,0);
});


test('a failed service backup stops the save before configuration or receipts change',async()=>{
 const f=fixture({...base,profileReady:true,hoursReady:true},true,true,'trades','Lighting',false);
 assert.equal((await f.saveFirstCallSection('services',{services:'Rewiring'})).ok,false);
 assert.equal(f.writes.length,0);assert.equal(f.receipts.length,0);
});
test('a prior service version is archived before a successful replacement',async()=>{
 const f=fixture({...base,profileReady:true,hoursReady:true},true,true,'trades','Lighting',true);
 assert.equal((await f.saveFirstCallSection('services',{services:'Rewiring'})).ok,true);
 assert.equal(f.writes[0].agent_services_departments,'Rewiring');
});

test('unreviewed service misspellings never reach configuration or completion writes',async()=>{
 const f=fixture({...base,profileReady:true,hoursReady:true});
 assert.equal((await f.saveFirstCallSection('services',{services:'sockats\nrewrng\nplgs'})).ok,false);
 assert.equal(f.writes.length,0);assert.equal(f.receipts.length,0);
 const kept=fixture({...base,profileReady:true,hoursReady:true});
 assert.equal((await kept.saveFirstCallSection('services',{services:'sockats',serviceReviewApprovals:'["spelling:sockats"]'})).ok,true);
 assert.equal(kept.writes[0].agent_services_departments,'sockats');
 assert.equal(kept.writes[0].serviceReviewApprovals,undefined);
});

test('dashboard completion follows the real test call and records forwarding review without verifying the provider line',async()=>{
 const configured={...base,profileReady:true,hoursReady:true,servicesReady:false,greetingReady:true,number:'+35312345678',lineEnabled:true};
 const pending=fixture(configured);
 assert.equal((await pending.dismissFirstCallWelcome()).ok,false);
 assert.equal(pending.receipts.length,0);
 const completed=fixture({...configured,hadConversation:true});
 assert.equal((await completed.dismissFirstCallWelcome()).ok,true);
 const receipts=completed.receipts.at(-1)?.completed_sections as Record<string,string>;
 assert.ok(receipts.forwarding);assert.ok(receipts.dashboard);
 assert.equal(receipts.forwarding,receipts.dashboard);
 assert.equal(completed.writes.length,0);
});

const salonClassification:classification.BusinessClassification={version:1,categoryId:'beauty',specialtyIds:['hair_salon']};
const salonMetadata={...newStarterMetadata(salonClassification),removed:['balayage']};
const servicesState={...base,profileReady:true,hoursReady:true,configuration:{businessClassification:JSON.stringify(salonClassification)}};
test('confirmed starter metadata is saved with edited services and completion after compilation',async()=>{
 const f=fixture(servicesState);
 assert.equal((await f.saveFirstCallSection('services',{services:'Haircuts\nBlow-dries',notOffered:'Hair extensions',serviceStarter:JSON.stringify(salonMetadata),configurationVersion:'2026-10-19T00:00:00Z'})).ok,true);
 assert.deepEqual(f.writes[0].service_starter_state,salonMetadata);
 assert.equal(f.writes[0].agent_services_departments,'Haircuts\nBlow-dries');
 assert.equal(f.writes[0].agent_services_not_offered,'Hair extensions');
 assert.ok((f.receipts.at(-1)?.completed_sections as Record<string,string>)?.services);
});
test('stale settings are rejected before service writes or progress changes',async()=>{
 const f=fixture(servicesState);
 assert.equal((await f.saveFirstCallSection('services',{services:'Haircuts',serviceStarter:JSON.stringify(salonMetadata),configurationVersion:'older-version'})).ok,false);
 assert.equal(f.writes.length,0);assert.equal(f.receipts.length,0);
});
test('compilation failure restores prior starter metadata with the service lists',async()=>{
 const state={...servicesState,configuration:{...servicesState.configuration,serviceStarter:JSON.stringify({...salonMetadata,mode:'fresh'})}};
 const f=fixture(state,false,true,'hair_salon','Haircuts');
 assert.equal((await f.saveFirstCallSection('services',{services:'Haircuts\nBlow-dries',serviceStarter:JSON.stringify(salonMetadata)})).ok,false);
 assert.equal(f.writes.length,2);assert.equal(f.writes[1].agent_services_departments,'Haircuts');
 assert.deepEqual(f.writes[1].service_starter_state,{...salonMetadata,mode:'fresh'});
 assert.ok(!f.receipts.some(r=>(r.completed_sections as Record<string,string>)?.services));
});

test('greeting saves after hours without setting up or inventing services',async()=>{
 const f=fixture({...base,profileReady:true,hoursReady:true,servicesReady:false,completedSections:{profile:'2026-10-19T00:00:00Z',hours:'2026-10-19T00:00:00Z'}});
 assert.equal((await f.saveFirstCallSection('greeting',{intro:'Hello, thanks for calling Example.',closing:'How can I help?'})).ok,true);
 assert.equal(f.writes[0].agent_services_departments,undefined);
 const receipts=f.receipts.at(-1)?.completed_sections as Record<string,string>;
 assert.ok(receipts.greeting);
 assert.equal(receipts.services,undefined);
});
