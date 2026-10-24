import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function fixture(options: {org?:string; account?:string; customer?:string; intentStatus?:string; preview?:boolean; production?:boolean} = {}) {
  const writes: string[] = [];
  const sub = {id:"sub_qa",customer:"cus_qa",status:"trialing",default_payment_method:null as string|null,pending_setup_intent:"seti_qa",metadata:{cliste_organization_id:options.org??"org_qa",cliste_account_id:options.account??"account_qa",...(options.preview?{cliste_dev_preview:"true"}:{})}};
  const stripe = {
    subscriptions:{retrieve:async()=>sub,update:async(_id:string,patch:{default_payment_method:string})=>{writes.push("subscription");sub.default_payment_method=patch.default_payment_method;return sub;}},
    setupIntents:{retrieve:async()=>({id:"seti_qa",status:options.intentStatus??"succeeded",customer:options.customer??"cus_qa",payment_method:"pm_qa",metadata:{cliste_subscription_id:"sub_qa"}})},
    customers:{update:async()=>{writes.push("customer");}},
  };
  const imports:Record<string,unknown>={"@/lib/signup-billing-security":{},"server-only":{},"@/lib/cliste-plans":{},"@/lib/account-access":{},"@/lib/account-billing":{patchAccountAndLocations:async()=>{writes.push("database");}},"@/lib/onboarding-session":{},"@/lib/platform-billing-checkout":{},"@/lib/stripe":{getStripeClient:()=>stripe},"@/utils/supabase/admin":{}};
  const source=readFileSync(new URL("./platform-billing-elements.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:(key:string)=>{assert.ok(key in imports);return imports[key];},process:{env:{NODE_ENV:options.production?"production":"test"}},setTimeout:(fn:()=>void)=>fn(),console});
  return {api:mod.exports as typeof import("./platform-billing-elements"),writes};
}
const input={organizationId:"org_qa",accountId:"account_qa",subscriptionId:"sub_qa",setupIntentId:"seti_qa"};
for(const options of [{org:"other_org"},{account:"other_account"},{preview:true,production:true}]) {
  test(`rejects unauthorized subscription before any Stripe or database writes: ${JSON.stringify(options)}`,async()=>{
    const f=fixture(options);await assert.rejects(()=>f.api.persistPlatformElementsSubscription(input),/does not belong/);assert.deepEqual(f.writes,[]);
  });
}
test("rejects a different customer's payment method before Stripe mutations",async()=>{
  const f=fixture({customer:"cus_other"});await assert.rejects(()=>f.api.persistPlatformElementsSubscription(input),/does not match/);assert.deepEqual(f.writes,[]);
});
for(const status of ["requires_payment_method","requires_action","processing","canceled"]) {
  test(`does not activate an unconfirmed payment setup: ${status}`,async()=>{const f=fixture({intentStatus:status});await assert.rejects(()=>f.api.persistPlatformElementsSubscription(input),/not been confirmed/);assert.deepEqual(f.writes,[]);});
}
test("confirmed payment setup updates only its customer, subscription and account",async()=>{const f=fixture();await f.api.persistPlatformElementsSubscription(input);assert.deepEqual(f.writes,["customer","subscription","database"]);});
