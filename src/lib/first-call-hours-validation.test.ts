import assert from 'node:assert/strict';
import test from 'node:test';
import { firstCallHoursErrors, hoursPanelForField } from './first-call-hours-validation';
import { firstCallConfigPatch } from './first-call-config';

const valid = {monday_open:'on',monday_start:'09:00',monday_end:'17:00',holidayMode:'usual',holidayStart:'10:00',holidayEnd:'14:00',outsideAvailability:'closed',smsAlerts:'off',alertPhone:''};

test('an invalid open-day time identifies the visible time control and its tab',()=>{
  const errors=firstCallHoursErrors({...valid,monday_end:'08:00'});
  assert.deepEqual(Object.keys(errors),['monday_end']);
  assert.match(errors.monday_end,/Monday.*after opening/);
  assert.equal(hoursPanelForField('monday_end'),'week');
});
test('correcting either time clears the range error immediately',()=>{
  assert.ok(firstCallHoursErrors({...valid,monday_start:'18:00'}).monday_end);
  assert.deepEqual(firstCallHoursErrors({...valid,monday_start:'16:00'}),{});
});
test('closing a day ignores its retained invalid draft times',()=>{
  assert.deepEqual(firstCallHoursErrors({...valid,monday_open:'',monday_start:'',monday_end:'01:00'}),{});
});
test('holiday errors disappear when custom holiday hours are no longer active',()=>{
  assert.ok(firstCallHoursErrors({...valid,holidayMode:'different',holidayEnd:'08:00'}).holidayEnd);
  assert.equal(hoursPanelForField('holidayEnd'),'holidays');
  for(const holidayMode of ['usual','closed']) assert.deepEqual(firstCallHoursErrors({...valid,holidayMode,holidayEnd:'08:00'}),{});
});
test('SMS validation only applies while alerts are enabled and routes to the phone field',()=>{
  assert.ok(firstCallHoursErrors({...valid,smsAlerts:'urgent',alertPhone:'bad'}).alertPhone);
  assert.equal(hoursPanelForField('alertPhone'),'outside');
  assert.deepEqual(firstCallHoursErrors({...valid,smsAlerts:'urgent',alertPhone:'087 123 4567'}),{});
  assert.deepEqual(firstCallHoursErrors({...valid,smsAlerts:'off',alertPhone:'bad'}),{});
});
test('client hours validation agrees with server acceptance for active and inactive settings',()=>{
  const cases=[valid,{...valid,monday_start:''},{...valid,monday_end:'09:00'},{...valid,monday_open:'',monday_end:'00:00'},{...valid,holidayMode:'different',holidayStart:'23:70'},{...valid,holidayMode:'different',holidayEnd:'09:00'},{...valid,holidayMode:'closed',holidayEnd:'bad'},{...valid,smsAlerts:'urgent',alertPhone:'01 1234567'},{...valid,smsAlerts:'all_messages',alertPhone:'+353 87 123 4567'},{...valid,smsAlerts:'transfer'},{...valid,outsideAvailability:'invalid'}];
  for(const fields of cases) assert.equal(Object.keys(firstCallHoursErrors(fields)).length===0,firstCallConfigPatch('hours',fields,'Example').ok,JSON.stringify(fields));
});
