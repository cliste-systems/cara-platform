import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateOutreachSend,type OutreachGateInput} from './sales-outreach-policy';
const eligible:OutreachGateInput={contactAddress:'office@example.com',sourceUrl:'https://example.com/contact',businessRelevant:true,permissionReviewed:true,campaignApproved:true,provider:'permitted-sales-provider',coldOutreach:true,optedOut:false,hardBounced:false,existingCustomer:false,replied:false,meetingBooked:false,alreadySent:false,dailySent:0,dailyLimit:20};
test('reviewed contact requires every eligibility check',()=>{
 assert.equal(evaluateOutreachSend(eligible).allowed,true);
 for(const flag of ['businessRelevant','permissionReviewed','campaignApproved'] as const)assert.equal(evaluateOutreachSend({...eligible,[flag]:false}).allowed,false);
});
test('suppression, replies, meetings and duplicate delivery override approval',()=>{
 for(const flag of ['optedOut','hardBounced','existingCustomer','replied','meetingBooked','alreadySent'] as const)assert.equal(evaluateOutreachSend({...eligible,[flag]:true}).allowed,false,flag);
});
test('preparation cannot override a provider cold outreach prohibition',()=>{
 assert.equal(evaluateOutreachSend({...eligible,provider:'resend'}).reason,'provider_prohibits_cold_outreach');
});
test('invalid counters and exhausted campaign budgets fail closed',()=>{
 for(const dailySent of [-1,20,NaN,Infinity])assert.equal(evaluateOutreachSend({...eligible,dailySent}).allowed,false);
 for(const dailyLimit of [0,-1,NaN,Infinity])assert.equal(evaluateOutreachSend({...eligible,dailyLimit}).allowed,false);
});
