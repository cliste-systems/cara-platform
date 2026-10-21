import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {firstCallConfigPatch} from './first-call-config';
import {parseBusinessHoursBundle} from './business-hours';
function fixture(authorised=true,compiled=true){
 const writes:Record<string,unknown>[]=[],filters:unknown[][]=[];
 const hours={_hoursNote:'Appointment only',monday:{open:true,start:'08:00',end:'18:00'}};
 const query={select(){return this;},eq(...args:unknown[]){filters.push(args);return this;},update(patch:Record<string,unknown>){writes.push(patch);return this;},single:async()=>({data:{id:'session-org',business_hours:hours,updated_at:'2026-10-19'},error:null}),then(resolve:any){return Promise.resolve({error:null}).then(resolve);}};
 const imports:Record<string,unknown>={'next/cache':{revalidatePath(){}},'@/lib/dashboard-admin':{requireDashboardAdmin:async()=>{if(!authorised)throw new Error('Unauthorized');return {organizationId:'session-org',supabase:{from:()=>query}};}},'@/lib/first-call-config':{firstCallConfigPatch},'@/lib/business-hours':{parseBusinessHoursBundle},'@/lib/cara-prompt-from-org':{regenerateCaraCustomPrompt:async()=>({ok:compiled})}};
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(dashboard)/dashboard/settings/call-handling-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>{if(!imports[name])throw new Error(name);return imports[name];},Date});
 return {hours,writes,filters,...mod.exports as {saveCallHandlingPreferences:(raw:Record<string,string>)=>Promise<{ok:boolean}>}};
}
const valid={outsideAvailability:'urgent_only',smsAlerts:'urgent',alertPhone:'087 123 4567'};
test('only an authenticated owner can save alert destinations',async()=>{const f=fixture(false);await assert.rejects(f.saveCallHandlingPreferences(valid));assert.equal(f.writes.length,0);});
test('preferences save to the session organization and preserve all existing hours metadata',async()=>{const f=fixture();assert.equal((await f.saveCallHandlingPreferences({...valid,organizationId:'foreign',is_active:'true'})).ok,true);const bundle=f.writes[0].business_hours as Record<string,unknown>;assert.equal(bundle._hoursNote,'Appointment only');assert.deepEqual(bundle.monday,f.hours.monday);assert.equal(f.writes[0].is_active,undefined);assert.ok(!f.filters.some(args=>args.includes('foreign')));});
test('invalid recipients write nothing and failed compilation rolls preferences back',async()=>{const invalid=fixture();assert.equal((await invalid.saveCallHandlingPreferences({...valid,alertPhone:'bad'})).ok,false);assert.equal(invalid.writes.length,0);const failed=fixture(true,false);assert.equal((await failed.saveCallHandlingPreferences(valid)).ok,false);assert.equal(failed.writes.length,2);assert.deepEqual(failed.writes[1].business_hours,failed.hours);});
