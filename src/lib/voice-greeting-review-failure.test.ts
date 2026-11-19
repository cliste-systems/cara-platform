import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as greeting from './voice-greeting';
import * as guardrails from './voice-greeting-guardrails';
import * as security from './voice-greeting-security';
function load(reply:string|Error){
 const imports:Record<string,unknown>={'server-only':{},'@/lib/openrouter-chat':{completeOpenRouterChat:async()=>{if(reply instanceof Error)throw reply;return reply;}},'@/lib/voice-greeting':greeting,'@/lib/voice-greeting-guardrails':guardrails,'@/lib/voice-greeting-security':security};
 const mod={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./voice-greeting-review.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(key:string)=>imports[key],Error,JSON});
 return (mod.exports as {reviewVoiceGreetingSafe:(input:unknown)=>Promise<{status:string}>}).reviewVoiceGreetingSafe;
}
const input={businessName:'Example',greetingIntro:'Welcome to Example.',greetingClosing:'How can I help you today?'};
test('unavailable and malformed safety reviews never approve a greeting',async()=>{for(const reply of [new Error('timeout'),'invalid','{}','{"needsChanges":false}'])assert.equal((await load(reply)(input)).status,'blocked');});
test('valid approval and unsafe decisions retain their meaning',async()=>{assert.equal((await load('{"needsChanges":false,"unsafe":false}')(input)).status,'approved');assert.equal((await load('{"needsChanges":true,"unsafe":true}')(input)).status,'blocked');});
test('the safety-checked standard greeting works without the external reviewer',async()=>{
 const review=load(new Error('rate limited'));
 assert.equal((await review({...input,greetingIntro:greeting.defaultVoiceGreetingIntro(input.businessName)})).status,'approved');
 assert.equal((await review({...input,greetingIntro:greeting.defaultVoiceGreetingIntro('fuck'),businessName:'fuck'})).status,'blocked');
});
