import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import ts from "typescript";
function fixture(bundleStatus="twilio-approved",denied=false){
 let writes=0,checks=0; const mod={exports:{}};
 const imports:Record<string,unknown>={"twilio":{default:()=>({numbers:{v2:{regulatoryCompliance:{bundles:()=>({fetch:async()=>{checks++;return {status:bundleStatus};}})}}}})},"next/cache":{revalidatePath(){}},"@/lib/admin-session":{requireAdminPermission:async()=>{if(denied)throw new Error("not allowed");return {id:"staff-user"};}},"@/utils/supabase/admin":{createAdminClient:()=>({rpc:async()=>{writes++;return {error:null};}})}};
 const source=readFileSync(new URL("../app/(admin)/admin/customers/[orgId]/verification-actions.ts",import.meta.url),"utf8");
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>imports[name],process:{env:{TWILIO_ACCOUNT_SID:"fixture",TWILIO_AUTH_TOKEN:"fixture"}},String});
 const form=new FormData();for(const [k,v] of Object.entries({status:"verified",bundle:"BU"+"1".repeat(32),confirm:"on",note:"[smoke test] Details checked and approved.",submittedAt:"2026-10-18T20:00:00Z"}))form.set(k,v);
 return {form,writes:()=>writes,checks:()=>checks,review:()=>(mod.exports as {reviewFirstCallBusiness:(id:string,form:FormData)=>Promise<{ok:boolean}>}).reviewFirstCallBusiness("12345678-1234-1234-1234-123456789012",form)};
}
test("unapproved Twilio bundles cannot mark a business verified",async()=>{const f=fixture("pending-review");assert.equal((await f.review()).ok,false);assert.equal(f.checks(),1);assert.equal(f.writes(),0);});
test("approved bundle still needs explicit business matching confirmation",async()=>{const f=fixture();f.form.delete("confirm");assert.equal((await f.review()).ok,false);assert.equal(f.writes(),0);});
test("approved bundle with staff confirmation saves audited review",async()=>{const f=fixture();assert.equal((await f.review()).ok,true);assert.equal(f.checks(),1);assert.equal(f.writes(),1);});
test("staff permission is required before inspecting a bundle or saving",async()=>{const f=fixture("twilio-approved",true);await assert.rejects(f.review());assert.equal(f.checks(),0);assert.equal(f.writes(),0);});
