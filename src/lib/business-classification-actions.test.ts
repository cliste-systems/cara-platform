import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as classification from './business-classification';
import * as onboardingScope from './business-onboarding-scope';
const value=JSON.stringify({version:1,categoryId:'trades',specialtyIds:['electrician'],organizationId:'foreign'});
function fixture({niche='trades',authorised=true,compiled=true}={}){
 const writes:Record<string,unknown>[]=[],filters:unknown[][]=[];
 const original={niche,business_classification:null,agent_business_type:'Previous type',updated_at:'2026-10-19T00:00:00Z'};
 const query={select(){return this;},eq(...args:unknown[]){filters.push(args);return this;},single:async()=>({data:original,error:null}),update(patch:Record<string,unknown>){writes.push(patch);return this;},then(resolve:(value:unknown)=>unknown){return Promise.resolve(resolve({error:null}));}};
 const imports:Record<string,unknown>={'next/cache':{revalidatePath(){}},'@/lib/business-classification':classification,'@/lib/business-onboarding-scope':onboardingScope,'@/lib/dashboard-admin':{requireDashboardAdmin:async()=>{if(!authorised)throw new Error('Unauthorized');return {organizationId:'session-org',supabase:{from:()=>query}};}},'@/lib/cara-prompt-from-org':{regenerateCaraCustomPrompt:async()=>({ok:compiled})}};
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(dashboard)/dashboard/business-classification-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>{if(!imports[name])throw new Error(name);return imports[name];},Date,JSON});
 return {...mod.exports as {saveBusinessClassification:(value:string)=>Promise<{ok:boolean}>},writes,filters};
}
test('dashboard classification requires owner authorization before writing',async()=>{const f=fixture({authorised:false});await assert.rejects(f.saveBusinessClassification(value));assert.equal(f.writes.length,0);});
test('dashboard cannot reclassify team-managed retail',async()=>{const f=fixture({niche:'retail'});assert.equal((await f.saveBusinessClassification(value)).ok,false);assert.equal(f.writes.length,0);});
test('unknown category data is rejected without a write',async()=>{const f=fixture();assert.equal((await f.saveBusinessClassification('{"version":1,"categoryId":"retail","specialtyIds":["shop"]}')).ok,false);assert.equal(f.writes.length,0);});
test('dashboard saves only classification fields for the session organization, preserving services',async()=>{const f=fixture();assert.equal((await f.saveBusinessClassification(value)).ok,true);assert.equal(f.writes.length,1);assert.equal(f.writes[0].niche,'other');assert.equal(f.writes[0].agent_business_type,'Electrician');assert.equal(f.writes[0].agent_services_departments,undefined);assert.equal(f.writes[0].is_active,undefined);assert.ok(f.filters.some(v=>v[0]==='id'&&v[1]==='session-org'));assert.ok(!f.filters.some(v=>v.includes('foreign')));});
test('failed prompt compilation restores classification with an optimistic timestamp guard',async()=>{const f=fixture({compiled:false});assert.equal((await f.saveBusinessClassification(value)).ok,false);assert.equal(f.writes.length,2);assert.equal(f.writes[1].agent_business_type,'Previous type');assert.equal(f.writes[1].business_classification,null);assert.ok(f.filters.some(v=>v[0]==='updated_at'&&v[1]===f.writes[0].updated_at));});

test('excluded and manual-review specialities cannot be admitted through the dashboard action',async()=>{for(const c of classification.BUSINESS_CATEGORIES){for(const s of c.specialties){if(onboardingScope.isLaunchSpeciality(s.id)&&s.id!=='other_speciality')continue;const f=fixture();assert.equal((await f.saveBusinessClassification(JSON.stringify({version:1,categoryId:c.id,specialtyIds:[s.id]}))).ok,false,s.id);assert.equal(f.writes.length,0,s.id);}}});
