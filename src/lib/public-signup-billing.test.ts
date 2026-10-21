import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as plans from "./cliste-plans.data";
import * as validation from "./platform-checkout-session-validation";

function fixture(checkout?: Record<string,unknown>,poolFailure=false) {
  const mutations:{table:string;patch:Record<string,unknown>}[]=[];
  const patches:Record<string,unknown>[]=[];
  const sessions:Record<string,unknown>[]=[];
  let provisioned=0,reserved=0;
  const admin={from(table:string){
    const query={select(){return query;},eq(){return query;},in(){return query;},update(patch:Record<string,unknown>){mutations.push({table,patch});return query;},maybeSingle:async()=>({data:{platform_subscription_id:"sub_test",platform_customer_id:"cus_test"},error:null}),then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:[],error:null}).then(resolve);}};
    return query;
  }};
  const stripe={prices:{list:async(input:{lookup_keys:string[]})=>({data:input.lookup_keys.map(key=>({lookup_key:key,id:"price_"+key}))})},checkout:{sessions:{create:async(payload:Record<string,unknown>)=>{sessions.push(payload);return {url:"https://checkout.stripe.com/test"};},retrieve:async()=>checkout??{status:"complete",payment_status:"no_payment_required",subscription:"sub_test",customer:"cus_test",metadata:{cliste_organization_id:"another-org",cliste_account_id:"another-account"}}}}};
  const imports:Record<string,unknown>={
    "@/lib/reserve-signup-number":{reserveSignupPoolNumber:async()=>{reserved++;if(poolFailure)throw new Error("pool unavailable");return {ok:true};}},
    "server-only":{},"next/headers":{headers:async()=>new Headers()},"next/cache":{revalidatePath(){}},
    "@/lib/account-billing":{patchAccountAndLocations:async(_id:string,patch:Record<string,unknown>)=>{patches.push(patch);}},
    "@/lib/account-access":{resolveAccountIdForOrganization:async()=>"account-1"},
    "@/lib/cliste-plans":plans,
    "@/lib/booking-site-origin":{resolveAppSiteOrigin:()=>({origin:"http://localhost:3001"}),LOCAL_DEV_APP_ORIGIN:"http://localhost:3001"},
    "@/lib/onboarding-session":{ONBOARDING_STEPS:{done:6}},
    "@/lib/platform-checkout-session-validation":validation,
    "@/lib/phone-pool":{provisionOrganizationPhoneNumber:async()=>{provisioned++;return {ok:true};}},
    "@/lib/stripe":{getStripeClient:()=>stripe},
    "@/utils/supabase/admin":{createAdminClient:()=>admin},
  };
  const source=readFileSync(fileURLToPath(new URL("./platform-billing-checkout.ts",import.meta.url)),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require(name:string){assert.ok(name in imports,`Unexpected import ${name}`);return imports[name];},process:{env:{NODE_ENV:"test"}},Date,Error,Headers,console});
  return {api:mod.exports as typeof import("./platform-billing-checkout"),mutations,patches,sessions,provisioned:()=>provisioned,reserved:()=>reserved};
}

test("checkout collects a payment method, retains the trial, and tags the simplified flow",async()=>{
  const f=fixture();
  const result=await f.api.createPlatformSubscriptionCheckout({organizationId:"org-1",userEmail:"signup@example.invalid",planTier:"starter",launchTier:"diy",interval:"month",signupFlow:"simple_v1",idempotencyKey:"test-checkout",successUrl:"http://localhost:3001/signup/complete",cancelUrl:"http://localhost:3001/signup/plan"});
  assert.equal(result.ok,true);
  assert.equal(f.sessions[0].payment_method_collection,"always");
  const subscription=f.sessions[0].subscription_data as {trial_period_days:number;metadata:Record<string,string>};
  assert.equal(subscription.trial_period_days,plans.PLATFORM_TRIAL_DAYS);
  assert.equal(subscription.metadata.cliste_signup_flow,"simple_v1");
});

test("paid signup reserves existing inventory without switching Cara live or buying a phone",async()=>{
  const f=fixture();await f.api.activatePlatformSubscriptionGoLive("org-1",{dashboardOnly:true});
  assert.equal(f.patches[0].status,"active");
  assert.equal(f.patches[0].launch_status,undefined);
  assert.equal(f.provisioned(),0);
  assert.equal(f.reserved(),1);
  assert.equal(f.mutations.some(m=>m.patch.is_active===true),false);
});

test("the legacy wizard still uses its existing launch behavior",async()=>{
  const f=fixture();await f.api.activatePlatformSubscriptionGoLive("org-1");
  assert.equal(f.provisioned(),1);
  assert.equal(f.patches[0].launch_status,"completed");
  assert.equal(f.mutations.some(m=>m.patch.is_active===true),true);
});

test("checkout completion rejects a different customer’s checkout",async()=>{
  const f=fixture();await assert.rejects(()=>f.api.persistPlatformCheckoutSession("org-1","cs_test_other"),/does not belong/);
  assert.equal(f.mutations.length,0);
});

test("an unfinished checkout never updates billing",async()=>{
  const f=fixture({status:"open",payment_status:"unpaid",subscription:null});
  await assert.rejects(()=>f.api.persistPlatformCheckoutSession("org-1","cs_test_unfinished"),/not complete/);
  assert.equal(f.mutations.length,0);
});

test("pool failure does not undo confirmed billing or activate calls",async()=>{const f=fixture(undefined,true);await f.api.activatePlatformSubscriptionGoLive("org-1",{dashboardOnly:true});assert.equal(f.patches[0].status,"active");assert.equal(f.provisioned(),0);assert.equal(f.mutations.some(m=>m.patch.is_active===true),false);});
