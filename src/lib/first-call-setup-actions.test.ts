import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {validateVerificationDetails} from "./first-call-setup";
function fixture(allowed=true){
 const calls:Record<string,unknown>[]=[];
 const admin={rpc:async(_:string,args:Record<string,unknown>)=>{calls.push(args);return {error:null};}};
 const source=readFileSync(new URL("../app/(dashboard)/dashboard/first-call-actions.ts",import.meta.url),"utf8"),mod={exports:{}};
 const imports:Record<string,unknown>={"next/cache":{revalidatePath(){}},"@/lib/dashboard-admin":{requireDashboardAdmin:async()=>{if(!allowed)throw new Error("unauthorised");return {organizationId:"session-business",user:{id:"session-user",email_confirmed_at:"2026-10-19T00:00:00Z"}};}},"@/utils/supabase/admin":{createAdminClient:()=>admin},"@/lib/first-call-setup":{validateVerificationDetails}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>imports[name],Date,Object,String});
 return {calls,save:(mod.exports as {saveFirstCallBusiness:(raw:unknown,authority:boolean)=>Promise<{ok:boolean}>}).saveFirstCallBusiness};
}
const valid={legalName:"[smoke test] Example Limited",registrationNumber:"123456",website:"https://example.com",address:"Main Street, Dublin",eircode:"D02 X285",representative:"Alex Owner",email:"qa@example.com"};
test("submission takes organisation and user from authenticated owner session",async()=>{const f=fixture();assert.equal((await f.save({...valid,organizationId:"another-business",verification_status:"verified"},true)).ok,true);assert.equal(f.calls[0].p_org,"session-business");assert.equal(f.calls[0].p_user,"session-user");assert.equal((f.calls[0].p_details as Record<string,unknown>).verification_status,undefined);});
test("view-only or unauthenticated callers cannot submit",async()=>{const f=fixture(false);await assert.rejects(f.save(valid,true));assert.equal(f.calls.length,0);});
test("authority and valid details are required before any write",async()=>{const f=fixture();assert.equal((await f.save(valid,false)).ok,false);assert.equal((await f.save({},true)).ok,false);assert.equal(f.calls.length,0);});
