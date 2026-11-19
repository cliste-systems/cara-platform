import assert from 'node:assert/strict';
import test from 'node:test';
import {isForwardingEvidence,normalizeConnectionNumber,needsProviderAssistance,connectionNumberDetails,connectionNumberIssue} from './phone-connection';
const call={sid:'CA'+'a'.repeat(32),to:'+35312345678',forwardedFrom:'+353871234567',direction:'inbound',status:'completed',duration:'15',startTime:new Date('2026-10-25T00:01:00Z')};
const input={businessNumber:'+353871234567',caraNumber:'+35312345678',requestedAt:'2026-10-25T00:00:00Z'};
test('only an answered forwarded call matching the saved source and Cara destination passes',()=>assert.equal(isForwardingEvidence(call,input),true));
test('direct calls, another business, an old call, unanswered calls and untrusted ids cannot connect',()=>{
 for(const patch of [{forwardedFrom:''},{forwardedFrom:'+353871234568'},{to:'+35312345679'},{direction:'outbound-api'},{duration:'4'},{status:'no-answer'},{startTime:new Date('2026-10-24T00:00:00Z')},{sid:'room-test'}])assert.equal(isForwardingEvidence({...call,...patch},input),false);
 assert.equal(isForwardingEvidence({...call,forwardedFrom:call.to},{...input,businessNumber:call.to}),false);
});
test('normalises Irish mobile and landline numbers and rejects arbitrary URLs and numbers',()=>{
 assert.equal(normalizeConnectionNumber('087 123 4567'),'+353871234567');
 assert.equal(normalizeConnectionNumber('01 234 5678'),'+35312345678');
 assert.equal(normalizeConnectionNumber('00353 87 1234567'),'+353871234567');
 for(const value of ['https://example.com','+442012345678','123','+353123456789012'])assert.equal(normalizeConnectionNumber(value),null);
});
test('provider assistance routes do not pretend a generic landline instruction is self-service',()=>{
 assert.equal(needsProviderAssistance('landline','eir'),true);
 assert.equal(needsProviderAssistance('hosted','Vodafone'),true);
 assert.equal(needsProviderAssistance('iphone','Three'),false);
 assert.equal(needsProviderAssistance('landline','Virgin Media'),false);
});

test('accepts domestic, international, optional trunk zero and common pasted separators',()=>{
 for(const input of ['0871234567','087 123 4567','+353871234567','+353 (0)87 123 4567','00353 87 1234567','00353 (0)87 1234567','+353/087/1234567'])assert.equal(normalizeConnectionNumber(input),'+353871234567');
 for(const input of ['01 234 5678','+353 (0)1 234 5678','00353 1 234 5678'])assert.equal(normalizeConnectionNumber(input),'+35312345678');
 assert.equal(normalizeConnectionNumber('021 456 1234'),'+353214561234');
 assert.equal(normalizeConnectionNumber('091 123456'),'+35391123456');
});
test('rejects service/premium numbers, unallocated prefixes, extensions, partial and foreign numbers',()=>{
 for(const input of ['1800 123 456','0818 123 456','1550 123 456','099 999 9999','087 12','+353087','+35300871234567','0871234567 ext 2','0871234567<script>','+44 20 7946 0000','353871234567','0'.repeat(1000)])assert.equal(normalizeConnectionNumber(input),null,input);
});

test('line-type mismatches and the assigned Cara number are rejected without guessing a carrier',()=>{
 assert.equal(connectionNumberDetails('0871234567')?.lineType,'Mobile');
 assert.equal(connectionNumberDetails('0214561234')?.lineType,'Landline');
 assert.match(connectionNumberIssue('0871234567','landline',null)!,/mobile number/);
 assert.match(connectionNumberIssue('012345678','iphone',null)!,/landline number/);
 assert.match(connectionNumberIssue('012345678','landline','+35312345678')!,/Cara number/);
 assert.equal(connectionNumberIssue('0871234567','android',null),null);
 assert.equal(connectionNumberIssue('0214561234','hosted',null),null);
});
