import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { signupDetails, PUBLIC_SIGNUP_FLOW } from "./public-signup-flow";
function fixture({duplicate=false,race=false,legalFailure=false}={}) {
 const writes:{table:string;value:Record<string,unknown>}[]=[];const deleted:string[]=[];const invalidated:string[]=[];
 let created=0,removed=0;let agreement:Record<string,unknown>|undefined;
 const admin={rpc:async()=>({data:duplicate,error:null}),auth:{admin:{createUser:async()=>{created++;return {data:{user:{id:"user-fixture"}},error:null};},deleteUser:async()=>{removed++;return {error:null};}}},from(table:string){
  const query={select(){return query;},eq(){return query;},insert(value:Record<string,unknown>){writes.push({table,value});return query;},delete(){deleted.push(table);return query;},maybeSingle:async()=>({data:null,error:null}),single:async()=>race && table==="accounts" ? {data:null,error:{code:"23505",message:"company name already exists"}} : {data:{id:table==="accounts" ? "legal-account" : "trading-business"},error:null},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:null,error:null}).then(resolve);}};
  return query;
 }};
 const imports:Record<string,unknown>={"@/lib/signup-password-security":{},
  "@/lib/public-signup-flow":{signupDetails,PUBLIC_SIGNUP_FLOW},"@/lib/public-signup":{isPublicSignupEnabled:()=>true},
  "next/headers":{headers:async()=>new Headers(),cookies(){}},"next/cache":{revalidatePath:(path:string)=>invalidated.push(path)},
  "@/lib/auth-rate-limit":{rateLimitFingerprint:()=>"fixture",recordRateLimitFailure:async()=>{}},
  "@/lib/resend-mail":{},"@/lib/signup-confirmation-email":{},"@/lib/turnstile":{},
  "@/lib/cliste-plans":{isPlanTier:()=>false},"@/lib/onboarding-dev":{isSignupOnboardingDevRelaxed:()=>true},
  "@/lib/legal-acceptances":{recordLegalAcceptances:async(_:unknown,value:Record<string,unknown>)=>{if(legalFailure)throw new Error("fixture failure");agreement=value;}},
  "@/lib/signup-security":{},"@/lib/security-events":{buildSecurityEventContext:()=>({}),logSecurityEvent:async()=>{}},
  "@/utils/supabase/admin":{createAdminClient:()=>admin},"@/utils/supabase/server":{createClient:async()=>({auth:{signInWithPassword:async()=>({error:null})}})},
 };
 const source=readFileSync(new URL("../app/signup/actions.ts",import.meta.url),"utf8");const testModule={exports:{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:testModule,exports:testModule.exports,require:(name:string)=>{if(!(name in imports))throw new Error(name);return imports[name];},process:{env:{NODE_ENV:"test"}},Headers,Date,Math,console});
 const form=new FormData();for(const [key,value] of Object.entries({fullName:"Alex Owner",businessName:"Local Plumbing",legalCompanyName:"Local Services Limited",email:"qa@example.com",password:"fixture-password",acceptLegal:"on"}))form.set(key,value);
 return {run:()=>(testModule.exports as {startSignup:(state:unknown,form:FormData)=>Promise<{ok:boolean;message?:string}>}).startSignup(null,form),form,writes,deleted,invalidated,created:()=>created,removed:()=>removed,agreement:()=>agreement};
}
test("signup creates a legal organisation and separate linked trading business",async()=>{const f=fixture();assert.equal((await f.run()).ok,true);assert.equal(f.writes.find(x=>x.table==="accounts")?.value.name,"Local Services Limited");const business=f.writes.find(x=>x.table==="organizations")!.value;assert.equal(business.name,"Local Plumbing");assert.equal(business.account_id,"legal-account");assert.equal((f.agreement()?.agreement as {organisationName:string}).organisationName,"Local Services Limited");assert.ok(f.invalidated.includes("/admin/organisations"));});
test("duplicate legal company is rejected before creating an auth user or linking access",async()=>{const f=fixture({duplicate:true});assert.equal((await f.run()).ok,false);assert.equal(f.created(),0);assert.equal(f.writes.length,0);});
test("database duplicate race cleans up the new auth user",async()=>{const f=fixture({race:true});assert.equal((await f.run()).ok,false);assert.equal(f.removed(),1);assert.equal(f.writes.some(x=>x.table==="organizations"),false);});
test("missing legal company name is rejected",async()=>{const f=fixture();f.form.delete("legalCompanyName");assert.equal((await f.run()).ok,false);assert.equal(f.created(),0);});
test("failed legal acceptance releases the just-created legal company",async()=>{const f=fixture({legalFailure:true});assert.equal((await f.run()).ok,false);assert.ok(f.deleted.includes("accounts"));assert.ok(f.deleted.includes("organizations"));});
