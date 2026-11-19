import assert from 'node:assert/strict';
import test from 'node:test';
import {firstCallSteps,firstCallSetupComplete,firstCallTestComplete,needsFirstCallSetup,canEditFirstCallSection,nextFirstCallReceipts,validateVerificationDetails,type FirstCallSetupState} from './first-call-setup';
const valid={legalName:'[smoke test] Example Limited',registrationNumber:'123456',website:'https://example.com',address:'Example Business, Main Street, Dublin',eircode:'d02 x285',representative:'Alex Owner',email:'qa@example.com',businessType:'company'};
test('business verification validates and normalises data',()=>assert.equal(validateVerificationDetails(valid).details?.eircode,'D02 X285'));
test('rejects missing company registration, invalid email/Eircode and unsafe URLs',()=>{for(const patch of [{registrationNumber:''},{email:'bad'},{eircode:'bad'},{website:'javascript:alert(1)'},{website:'https://user:pass@example.com'}])assert.ok(validateVerificationDetails({...valid,...patch}).error);});
test('sole traders do not need a company registration number',()=>assert.ok(validateVerificationDetails({...valid,businessType:'sole_trader',registrationNumber:''}).details));
const initial:FirstCallSetupState={email:'qa@example.com',emailVerified:false,businessName:'Example',legalName:'Example Limited',verificationStatus:'not_submitted',reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:false,greetingReady:false,hoursReady:false,servicesReady:false,hadConversation:false,forwardingVerified:false,welcomeSeen:false,canManage:true};
const connection={business_number:'+353871234567',phone_type:'iphone',provider:'Three',requested_at:'2026-10-25T00:00:00Z',verified_at:'2026-10-25T00:01:00Z',verified_call_sid:'CA'+'a'.repeat(32),trial_activated_at:'2026-10-25T00:01:00Z',support_ticket_id:null};
const ready={...initial,emailVerified:true,verificationStatus:'verified',profileReady:true,hoursReady:true,servicesReady:true,greetingReady:true,number:'+35312345678',lineEnabled:true};
test('sections end with a test call followed by call forwarding',()=>assert.deepEqual(firstCallSteps(initial).map(v=>v.id),['email','business','profile','hours','greeting','test','forwarding']));
test('later sections remain locked even when their data already exists',()=>{for(const step of firstCallSteps({...ready,emailVerified:false}))assert.equal(step.unlocked,step.id==='email');});
test('submitted businesses can configure Cara, test calls and finish while review continues',()=>{
 const reviewing={...ready,verificationStatus:'submitted'};
 for(const section of ['profile','hours','greeting'])assert.equal(canEditFirstCallSection(reviewing,section),true);
 assert.equal(canEditFirstCallSection(reviewing,'test'),true);
 assert.equal(firstCallSetupComplete({...reviewing,hadConversation:true,forwardingReviewed:true,connection}),true);
 assert.equal(firstCallSetupComplete({...reviewing,verificationStatus:'needs_information',hadConversation:true,forwardingReviewed:true,connection}),true);
 for(const status of ['not_submitted','rejected'])assert.equal(canEditFirstCallSection({...ready,verificationStatus:status},'profile'),false);
 assert.equal(canEditFirstCallSection(ready,'profile'),true);
});
test('each required configuration section blocks all later sections',()=>{for(const [field,id] of [['profileReady','profile'],['hoursReady','hours'],['greetingReady','greeting']] as const){const steps=firstCallSteps({...ready,[field]:false});const index=steps.findIndex(s=>s.id===id);assert.equal(steps[index].unlocked,true);assert.ok(steps.slice(index+1).every(s=>!s.unlocked));}});
test('a real answered conversation, connected number and all prerequisites are required for dashboard completion',()=>{assert.equal(firstCallSetupComplete(ready),false);const done={...ready,hadConversation:true,forwardingReviewed:true,connection};assert.equal(firstCallSetupComplete(done),true);for(const patch of [{isTestNumber:true},{number:null},{verificationStatus:'not_submitted'},{emailVerified:false}])assert.equal(firstCallSetupComplete({...done,...patch}),false);});
test('reviewing instructions never confirms a connection or starts a trial',()=>{
 const tested={...ready,hadConversation:true,forwardingVerified:false};
 assert.equal(firstCallTestComplete(tested),true);
 assert.equal(firstCallSteps(tested).find(step=>step.id==='forwarding')?.unlocked,true);
 assert.equal(firstCallSetupComplete(tested),false);
 assert.equal(firstCallSetupComplete({...tested,forwardingReviewed:true}),false);
 assert.equal(firstCallSetupComplete({...tested,connection:{...connection,trial_activated_at:null}}),false);
 assert.equal(firstCallSetupComplete({...tested,connection}),true);
 assert.equal(firstCallSteps(ready).find(step=>step.id==='forwarding')?.unlocked,false);
});

test('editing an earlier section clears later receipts so an old test cannot unlock the dashboard',()=>{assert.deepEqual(nextFirstCallReceipts({profile:'old',hours:'old',services:'old',greeting:'old',forwarding:'old',notifications:'old'},'hours','new'),{profile:'old',hours:'new'});});

test('switching Cara off after a recorded first call does not revoke dashboard access',()=>assert.equal(needsFirstCallSetup({...ready,hadConversation:true,forwardingReviewed:true,connection,lineEnabled:false}),false));
test('a server-recorded dashboard unlock remains valid if the phone line later becomes unavailable',()=>assert.equal(needsFirstCallSetup({...initial,dashboardUnlocked:true}),false));

test('accepts plain business domains and normalises them to HTTPS',()=>{
 for(const website of ['example.ie','www.example.ie','example.ie/contact']){
  assert.equal(validateVerificationDetails({...valid,website}).details?.website,`https://${website}${website.includes('/')?'':'/'}`);
 }
 for(const website of ['not a website','javascript:alert(1)','ftp://example.ie','https://user:pass@example.ie'])assert.ok(validateVerificationDetails({...valid,website}).error);
});

test('removed notification setup cannot block testing or be edited',()=>{assert.equal(canEditFirstCallSection(ready,'notifications'),false);assert.equal(firstCallSetupComplete({...ready,hadConversation:true,forwardingReviewed:true,connection}),true);});

test('services are deferred to the dashboard and never block setup or test calls',()=>{
 const deferred={...ready,servicesReady:false,hadConversation:true,forwardingReviewed:true,connection};
 assert.equal(firstCallSteps(deferred).length,7);
 assert.ok(!firstCallSteps(deferred).some(step=>step.id==='services'));
 assert.equal(firstCallTestComplete(deferred),true);
 assert.equal(firstCallSetupComplete(deferred),true);
 assert.equal(needsFirstCallSetup(deferred),false);
});

const structured={...valid,address:"Ignored legacy address",addressLine1:"12 Main Street",addressLine2:"Unit 4",town:"Sligo",county:"Sligo"};
test('structured verification address is preserved and formatted for existing consumers',()=>{
 const result=validateVerificationDetails(structured);
 assert.equal(result.details?.address,'12 Main Street, Unit 4, Sligo, Co. Sligo');
 assert.equal(result.details?.town,'Sligo');
 assert.equal(result.details?.county,'Sligo');
 assert.equal(validateVerificationDetails({...structured,addressLine2:''}).details?.address,'12 Main Street, Sligo, Co. Sligo');
});
test('structured addresses reject missing fields and unrecognised counties despite a legacy address',()=>{
 for(const patch of [{addressLine1:''},{town:''},{county:''},{county:'Made up'},{addressLine2:'x'.repeat(301)}])assert.ok(validateVerificationDetails({...structured,...patch}).error);
});

test('businesses without websites can explicitly request manual review',()=>{
 assert.equal(validateVerificationDetails({...valid,website:''}).details,undefined);
 const result=validateVerificationDetails({...valid,website:'',websiteStatus:'not_available'});
 assert.equal(result.details?.website,'');assert.equal(result.details?.websiteStatus,'not_available');
 assert.ok(validateVerificationDetails({...valid,website:'javascript:alert(1)',websiteStatus:'provided'}).error);
});
