import assert from 'node:assert/strict';
import test from 'node:test';
import {firstCallResumeStep,readFirstCallCursor,firstCallConfigurationStep} from './first-call-progress';
import {needsFirstCallSetup,type FirstCallSetupState} from './first-call-setup';
const initial:FirstCallSetupState={email:'qa@example.invalid',emailVerified:true,businessName:'Example',legalName:'Example Limited',verificationStatus:'not_submitted',reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:false,greetingReady:false,hoursReady:false,servicesReady:false,hadConversation:false,forwardingVerified:false,welcomeSeen:false,canManage:true};
const progress={...initial,verificationStatus:'verified',profileReady:true,hoursReady:true,completedSections:{profile:'saved',hours:'saved'}};
test('new owners see the introduction; saved account progress resumes at the next unfinished section',()=>{
 assert.equal(firstCallResumeStep(initial),null);
 assert.equal(firstCallResumeStep(progress),'greeting');
 assert.equal(firstCallResumeStep({...progress,servicesReady:true}),'greeting');
});
test('a browser cursor cannot skip prerequisites, complete setup or unlock the dashboard',()=>{
 assert.equal(firstCallResumeStep(initial,'test'),'business');
 assert.equal(firstCallResumeStep(progress,'test'),'greeting');
 assert.equal(firstCallResumeStep(progress,'hours'),'greeting');
 assert.equal(needsFirstCallSetup(progress),true);
 assert.equal(firstCallResumeStep(progress,'services'),'greeting');
});
test('pending review resumes configuration first and proceeds directly to the test when configured',()=>{
 assert.equal(firstCallResumeStep({...initial,verificationStatus:'submitted'}),'profile');
 assert.equal(firstCallResumeStep({...progress,verificationStatus:'submitted',servicesReady:true,greetingReady:true}),'test');
 const ready={...progress,servicesReady:true,greetingReady:true,number:'+35312345678'};
 assert.equal(firstCallResumeStep(ready),'test');
 assert.equal(firstCallResumeStep({...ready,hadConversation:true}),'forwarding');
});
test('cursor parsing ignores corrupt, unversioned and unexpected browser data',()=>{
 for(const raw of [null,'bad','null','{}','{"version":2,"step":"services"}','{"version":1,"step":"dashboard"}','{"version":1,"step":{"id":"test"}}'])assert.equal(readFirstCallCursor(raw),null);
 assert.equal(readFirstCallCursor('{"version":1,"step":"hours","complete":true}'),'hours');
});
test('the final forwarding page resumes after the test and remains the final page after completion',()=>{
 const tested={...progress,servicesReady:true,greetingReady:true,number:'+35312345678',hadConversation:true};
 assert.equal(firstCallResumeStep(tested),'forwarding');
 assert.equal(firstCallResumeStep({...tested,forwardingReviewed:true}),'forwarding');
 assert.equal(readFirstCallCursor('{"version":1,"step":"forwarding"}'),'forwarding');
 assert.equal(firstCallResumeStep(initial,'forwarding'),'business');
});

test('legacy services cursors resume at greeting instead of an empty setup screen',()=>{
 assert.equal(readFirstCallCursor('{"version":1,"step":"services"}'),'greeting');
 assert.equal(firstCallResumeStep(progress,'services'),'greeting');
});

test('verification continuation resumes unfinished configuration instead of restarting it',()=>{
 assert.equal(firstCallConfigurationStep({...initial,verificationStatus:'submitted'}),'profile');
 assert.equal(firstCallConfigurationStep({...progress,hoursReady:false}),'hours');
 assert.equal(firstCallConfigurationStep(progress),'greeting');
 const configured={...progress,verificationStatus:'submitted',greetingReady:true};
 assert.equal(firstCallConfigurationStep(configured),null);
 assert.equal(firstCallResumeStep(configured),'test');
});

test('a pending review never sends configured customers backwards or blocks dashboard completion',()=>{
 const configured={...progress,verificationStatus:'submitted',greetingReady:true,number:'+35312345678',hadConversation:true,forwardingReviewed:true};
 assert.equal(firstCallResumeStep(configured),'forwarding');
 assert.equal(needsFirstCallSetup(configured),false);
 assert.equal(needsFirstCallSetup({...configured,verificationStatus:'needs_information'}),false);
});
