import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(local:boolean,ready:boolean,testComplete=false){
 let writes=0,rpcs=0;
 const cookieValues:unknown[][]=[];
 const fixtureModule={exports:{}};
 const imports:Record<string,unknown>={
  'next/cache':{revalidatePath:()=>{}},
  'next/headers':{headers:async()=>new Headers({host:'localhost:3001'}),cookies:async()=>({set:(...args:unknown[])=>{writes++;cookieValues.push(args);}})},
  '@/lib/onboarding-dev':{isLocalSetupTestEnabled:()=>local,LOCAL_SETUP_COMPLETION_COOKIE:'cara_local_setup_complete',localSetupCompletionValue:(user:string,org:string)=>`${user}:${org}`},
  '@/lib/dashboard-admin':{requireDashboardAdmin:async()=>({user:{id:'owner'},organizationId:'owned-business'})},
  '@/utils/supabase/admin':{createAdminClient:()=>({rpc:async()=>{rpcs++;return {data:true,error:null};}})},
  '@/lib/first-call-setup':{validateVerificationDetails:()=>{},firstCallConfigurationReady:()=>ready,firstCallTestComplete:()=>testComplete},
  '@/lib/load-first-call-setup':{loadFirstCallSetup:async()=>({dashboardUnlocked:false})},
 };
 const source=readFileSync(new URL('../app/(dashboard)/dashboard/first-call-actions.ts',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:fixtureModule,exports:fixtureModule.exports,Headers,require:(name:string)=>{if(!(name in imports))throw new Error(`Unexpected import ${name}`);return imports[name];}});
 return {finish:(fixtureModule.exports as {dismissFirstCallWelcome:()=>Promise<{ok:boolean}>}).dismissFirstCallWelcome,writes:()=>writes,rpcs:()=>rpcs,cookieValues};
}
test('local completion grants only an expiring owner/business-scoped browser rehearsal, without changing connection or billing',async()=>{
 const f=fixture(true,true);assert.equal((await f.finish()).ok,true);assert.equal(f.writes(),1);assert.equal(f.rpcs(),0);
 assert.equal(f.cookieValues[0][1],'owner:owned-business');
 const options=f.cookieValues[0][2] as Record<string,unknown>;assert.equal(options.httpOnly,true);assert.equal(options.sameSite,'strict');assert.equal(options.maxAge,3600);
});
test('local rehearsal still requires all business configuration',async()=>{const f=fixture(true,false);assert.equal((await f.finish()).ok,false);assert.equal(f.writes(),0);assert.equal(f.rpcs(),0);});
test('public completion cannot skip the real test call',async()=>{const f=fixture(false,true);assert.equal((await f.finish()).ok,false);assert.equal(f.writes(),0);assert.equal(f.rpcs(),0);});
test('public completion with a real test call uses the database gate',async()=>{const f=fixture(false,true,true);assert.equal((await f.finish()).ok,true);assert.equal(f.writes(),0);assert.equal(f.rpcs(),1);});
