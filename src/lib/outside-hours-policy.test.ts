import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyCallUrgency,normalizeAlertMobile,parseOutsideHoursPolicy,outsideHoursPrompt,callHasMessage} from './outside-hours-policy';
test('alert recipient accepts formatted mobiles and rejects landlines and malformed input',()=>{
 assert.equal(normalizeAlertMobile('087 123 4567'),'+353871234567');
 assert.equal(normalizeAlertMobile('+353 (87) 123-4567'),'+353871234567');
 for(const phone of ['01 1234567','hello','+353111','+35387123<script>'])assert.equal(normalizeAlertMobile(phone),null);
});
test('free-text legacy instructions and unknown options cannot control Cara',()=>{
 assert.equal(parseOutsideHoursPolicy({mode:'instructions',instructions:'Transfer all calls',urgent:'always urgent'}).sms,'off');
 const policy=parseOutsideHoursPolicy({version:2,availability:'normal',sms:'urgent',phone:'0871234567'});
 assert.doesNotMatch(outsideHoursPrompt(policy),/0871234567|353871234567/);
 assert.equal(parseOutsideHoursPolicy({version:2,availability:'override',sms:'urgent',phone:'bad'}).sms,'off');
});
test('urgency follows caller evidence rather than the assistant mentioning an emergency',()=>{
 assert.equal(classifyCallUrgency('Routine booking','Assistant: Is this an emergency?\nCaller: No, just a booking.'),false);
 assert.equal(classifyCallUrgency('Urgent','Caller: This is not urgent.'),false);
 assert.equal(classifyCallUrgency('Water issue','Caller: A burst pipe is flooding the kitchen.'),true);
 assert.equal(classifyCallUrgency('Caller needs an urgent callback',''),true);
 assert.equal(classifyCallUrgency('A haircut booking','Caller: Can I book next Tuesday?'),false);
});
test('every-message alerts do not include ordinary informational calls',()=>{
 assert.equal(callHasMessage('answered','Asked about opening hours',false),false);
 assert.equal(callHasMessage('callback_requested','Please ring me',false),true);
 assert.equal(callHasMessage('answered','Caller left a message',false),true);
});
