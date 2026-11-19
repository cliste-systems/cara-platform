import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture({ready=true,allowed=true,existing=false,insertError=false}={}){
 const inserts:Record<string,unknown>[]=[],filters:unknown[][]=[];
 const query={select(){return this;},eq(...args:unknown[]){filters.push(args);return this;},neq(){return this;},limit(){return this;},maybeSingle:async()=>({data:existing?{id:'existing-ticket'}:null,error:null}),insert:async(value:Record<string,unknown>)=>{inserts.push(value);return {error:insertError?new Error('database unavailable'):null};}};
 const imports:Record<string,unknown>={
  'next/cache':{revalidatePath:()=>{}},'next/headers':{},'@/lib/onboarding-dev':{},
  '@/lib/dashboard-admin':{requireDashboardAdmin:async()=>({user:{id:'owner'},organizationId:'owned-business'})},
  '@/utils/supabase/admin':{createAdminClient:()=>({from:(table:string)=>{assert.equal(table,'support_tickets');return query;}})},
  '@/lib/first-call-setup':{validateVerificationDetails:()=>{},firstCallConfigurationReady:()=>ready},
  '@/lib/load-first-call-setup':{loadFirstCallSetup:async()=>({number:null,lineEnabled:false})},
  '@/lib/voice-api-rate-limit':{reserveVoiceApiRequest:async()=>({allowed}),voiceApiFingerprint:(value:string)=>value},
 };
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(dashboard)/dashboard/first-call-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>imports[name]});
 return {request:(mod.exports as {requestSetupNumberHelp:()=>Promise<{ok:boolean}>}).requestSetupNumberHelp,inserts,filters};
}
test('number assistance works before provisioning and is scoped to the authenticated business',async()=>{const f=fixture();assert.equal((await f.request()).ok,true);assert.equal(f.inserts.length,1);assert.equal(f.inserts[0].organization_id,'owned-business');assert.equal(f.inserts[0].created_by,'owner');assert.ok(f.filters.some(filter=>filter[0]==='organization_id'&&filter[1]==='owned-business'));});
test('repeated requests reuse an open support conversation',async()=>{const f=fixture({existing:true});assert.equal((await f.request()).ok,true);assert.equal(f.inserts.length,0);});
test('unconfigured or rate-limited requests cannot create support tickets',async()=>{for(const options of [{ready:false},{allowed:false}]){const f=fixture(options);assert.equal((await f.request()).ok,false);assert.equal(f.inserts.length,0);}});
test('a failed insert never reports that help was requested',async()=>{const f=fixture({insertError:true});assert.equal((await f.request()).ok,false);});
