import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(local:boolean,ready:boolean,complete:boolean){
 let saved=false,refreshes=0;
 const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:null,error:null}),insert:()=>{saved=true;return chain;},single:async()=>({data:{business_number:'+353871234567'},error:null})};
 const imports:Record<string,unknown>={
 'next/cache':{revalidatePath:()=>{refreshes++;}},'next/headers':{headers:async()=>new Headers({host:'localhost:3001'})},
 '@/lib/onboarding-dev':{isLocalSetupTestEnabled:()=>local},
 '@/lib/dashboard-admin':{requireDashboardAdmin:async()=>({organizationId:'owned-org'})},
 '@/utils/supabase/admin':{createAdminClient:()=>({from:()=>chain})},
 '@/lib/first-call-setup':{firstCallConfigurationReady:()=>ready,firstCallTestComplete:()=>complete},
 '@/lib/load-first-call-setup':{loadFirstCallSetup:async()=>({number:'+35311234567'})},
 '@/lib/phone-connection':{connectionNumberIssue:()=>null,normalizeConnectionNumber:()=>'+353871234567',CONNECTION_PHONE_TYPES:['iphone'],CONNECTION_PROVIDERS:['Three']},
 };
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(dashboard)/dashboard/first-call-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Headers,Date,require:(name:string)=>{assert.ok(name in imports,name);return imports[name];}});
 return {run:()=>(mod.exports as typeof import('../app/(dashboard)/dashboard/first-call-actions')).savePhoneConnection({businessNumber:'0871234567',phoneType:'iphone',provider:'Three'}),saved:()=>saved,refreshes:()=>refreshes};
}
test('local rehearsal can confirm a number after configuration without a real test call or layout reset',async()=>{const f=fixture(true,true,false);assert.equal((await f.run()).ok,true);assert.equal(f.saved(),true);assert.equal(f.refreshes(),0);});
test('production cannot bypass the test call',async()=>{const f=fixture(false,true,false);assert.equal((await f.run()).ok,false);assert.equal(f.saved(),false);});
test('local rehearsal cannot bypass incomplete configuration',async()=>{const f=fixture(true,false,false);assert.equal((await f.run()).ok,false);assert.equal(f.saved(),false);});
test('a real completed test call can save without resetting the confirmation flow',async()=>{const f=fixture(false,true,true);assert.equal((await f.run()).ok,true);assert.equal(f.refreshes(),0);});
