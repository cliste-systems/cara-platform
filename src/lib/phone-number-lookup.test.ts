import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(result:unknown,fail=false,configured=true){
 const calls:unknown[]=[];
 const factory=(_sid:string,_token:string,options:unknown)=>{calls.push(options);return {lookups:{v2:{phoneNumbers:(number:string)=>({fetch:async(...args:unknown[])=>{calls.push({number,args});if(fail)throw Error('timeout');return result;}})}}};};
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./phone-number-lookup.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>name==='twilio'?factory:{},process:{env:configured?{TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test'}:{} }});
 return {calls,lookup:(mod.exports as {lookupConnectionNumber:(number:string)=>Promise<string>}).lookupConnectionNumber};
}
test('basic lookup never asks for paid fields and bounds the request',async()=>{const f=fixture({valid:true,countryCode:'IE',phoneNumber:'+353871234567'});assert.equal(await f.lookup('+353871234567'),'checked');assert.equal((f.calls[0] as {timeout:number}).timeout,5000);assert.deepEqual((f.calls[1] as {args:unknown[]}).args.length,0);});
test('invalid range is rejected but provider errors or unknown responses remain unavailable',async()=>{
 assert.equal(await fixture({valid:false}).lookup('+353871234567'),'invalid');
 for(const result of [{},{valid:true,countryCode:'GB',phoneNumber:'+353871234567'},{valid:true,countryCode:'IE',phoneNumber:'+353871234568'}])assert.equal(await fixture(result).lookup('+353871234567'),'unavailable');
 assert.equal(await fixture(null,true).lookup('+353871234567'),'unavailable');
 const missing=fixture(null,false,false);assert.equal(await missing.lookup('+353871234567'),'unavailable');assert.equal(missing.calls.length,0);
});
