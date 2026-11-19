import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as plans from "./cliste-plans.data";

function fixture(stalePrice = false, failure?: "configuration" | "prices" | "pause" | "expired") {
  const requests: {kind:string; payload:Record<string,unknown>;options?:Record<string,unknown>}[]=[];
  const stripe={
    prices:{list:async({lookup_keys}:{lookup_keys:string[]})=>{if(failure==="prices")throw new Error("Provider unavailable");return ({data:lookup_keys.map(key=>({lookup_key:key,id:`test_${key}`,currency:"eur",unit_amount:stalePrice ? 1 : key.includes("setup_") ? (key.includes("remote") ? 19900 : 39900) : key.includes("overage_min") ? 49 : key.includes("overage_sms") ? 15 : key.includes("annual") ? 99000 : 9900}))});}},
    customers:{create:async(payload:Record<string,unknown>,options?:Record<string,unknown>)=>{requests.push({kind:"customer",payload,options});return {id:"cus_fixture"};}},
    subscriptions:{create:async(payload:Record<string,unknown>,options?:Record<string,unknown>)=>{requests.push({kind:"subscription",payload,options});return {id:"sub_fixture",status:failure==="expired"?"canceled":"trialing",pending_setup_intent:"seti_fixture"};},update:async(id:string,payload:Record<string,unknown>,options?:Record<string,unknown>)=>{requests.push({kind:"hold",payload,options});if(failure==="pause")throw new Error("Synthetic hold failure");return {id};},cancel:async(id:string,payload:Record<string,unknown>)=>{requests.push({kind:"cancel",payload:{id,...payload}});return {id};}},
    invoiceItems:{create:async(payload:Record<string,unknown>,options?:Record<string,unknown>)=>{requests.push({kind:"setupFee",payload,options});return {id:"ii_fixture"};}},
    setupIntents:{update:async(_id:string,payload:Record<string,unknown>)=>{requests.push({kind:"setup",payload});},retrieve:async()=>({id:"seti_fixture",client_secret:"fixture_secret"})},
  };
  const imports:Record<string,unknown>={"@/lib/application-monitoring":{recordApplicationEvent:async()=>{}},"@/lib/signup-billing-security":{},
    "server-only":{},"@/lib/cliste-plans":plans,
    "@/lib/account-access":{},"@/lib/account-billing":{},"@/lib/onboarding-session":{ONBOARDING_STEPS:{done:6}},
    "@/lib/platform-billing-checkout":{},"@/lib/stripe":{getStripeClient:()=>{if(failure==="configuration")throw new Error("STRIPE_SECRET_KEY is not set");return stripe;}},
    "@/utils/supabase/admin":{createAdminClient:()=>({from(){throw new Error("Signup must resolve prices in its Stripe environment, not the shared database.");}})},
  };
  const source=readFileSync(new URL("./platform-billing-elements.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require(name:string){assert.ok(name in imports,`Unexpected import: ${name}`);return imports[name];},process:{env:{NODE_ENV:"test"}},Date,Error,console,setTimeout});
  return {api:mod.exports as typeof import("./platform-billing-elements"),requests};
}

const input={planTier:"starter" as const,launchTier:"diy" as const,interval:"month" as const,userEmail:"fixture@example.invalid",organizationId:"org-fixture",accountId:"account-fixture",signupFlow:"simple_v1",idempotencyKey:"fixture-checkout",trialEnd:2000000000};

test("embedded signup keeps prices inside the selected Stripe environment and retries idempotently",async()=>{
  const f=fixture();const result=await f.api.createPlatformElementsCheckout(input);
  assert.equal(result.ok,true);
  assert.equal(f.requests.find(r=>r.kind==="customer")?.options?.idempotencyKey,"fixture-checkout-customer");
  const subscription=f.requests.find(r=>r.kind==="subscription")!;
  assert.equal(subscription.options?.idempotencyKey,"fixture-checkout-subscription");
  assert.equal((subscription.payload.items as {price:string}[])[0].price,"test_cliste_plan_starter_monthly");
  assert.equal((subscription.payload.metadata as Record<string,string>).cliste_signup_flow,"simple_v1");
  assert.equal((f.requests.find(r=>r.kind==="setup")!.payload.metadata as Record<string,string>).cliste_account_id,"account-fixture");
});

test("annual checkout discloses the annual bill rather than a monthly equivalent labelled per year",async()=>{
  const f=fixture();const result=await f.api.createPlatformElementsCheckout({...input,interval:"year"});
  assert.equal(result.ok,true);
  if(result.ok){assert.equal(result.summary.amountLabel,"€990");assert.equal(result.summary.intervalLabel,"year");}
});

test("an abandoned signup cancels at trial end without a payment method",async()=>{
  const f=fixture();await f.api.createPlatformElementsCheckout(input);
  const subscription=f.requests.find(r=>r.kind==="subscription")!.payload;
  assert.equal((subscription.trial_settings as {end_behavior:{missing_payment_method:string}}).end_behavior.missing_payment_method,"cancel");
});

test("public signup voids collection during setup and uses a stable hold key", async () => {
  const f = fixture();
  assert.equal((await f.api.createPlatformElementsCheckout(input)).ok, true);
  const hold = f.requests.find(request => request.kind === "hold")!;
  assert.equal((hold.payload.pause_collection as { behavior: string }).behavior, "void");
  assert.equal(hold.options?.idempotencyKey, "connection-hold-sub_fixture");
  assert.equal(f.requests.some(request => request.kind === "setupFee"), false);
});

test("a failed setup hold cancels the new subscription without exposing a checkout secret", async () => {
  const f = fixture(false, "pause");
  const result = await f.api.createPlatformElementsCheckout(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.message, "Payment setup is temporarily unavailable. Please try again shortly.");
  assert.equal(f.requests.filter(request => request.kind === "cancel").length, 1);
  assert.equal(f.requests.find(request => request.kind === "cancel")?.payload.id, "sub_fixture");
  assert.equal(f.requests.some(request => request.kind === "setup" || request.kind === "setupFee"), false);
});

for (const [launchTier, amount] of [["remote", "€199"], ["onsite_dublin", "€399"]] as const) {
  test(`${launchTier} setup is disclosed and deferred until the customer connects`, async () => {
    const f=fixture(); const result=await f.api.createPlatformElementsCheckout({...input,launchTier});
    assert.equal(result.ok,true);
    if(result.ok) assert.ok(result.summary.setupLabel?.includes(amount));
    // Public signup defers its one-time setup fee until connection activates billing.
    assert.equal(f.requests.some(request=>request.kind==="setupFee"),false);
    assert.equal(f.requests.find(request=>request.kind==="subscription")?.payload.metadata && (f.requests.find(request=>request.kind==="subscription")!.payload.metadata as Record<string,string>).cliste_launch_tier,launchTier);

  });
}
test("self setup has no setup fee",async()=>{const f=fixture();await f.api.createPlatformElementsCheckout(input);assert.equal(f.requests.some(request=>request.kind==="setupFee"),false);});
test("stale Stripe amounts are rejected before creating a customer or subscription",async()=>{const f=fixture(true);const result=await f.api.createPlatformElementsCheckout(input);assert.equal(result.ok,false);assert.equal(f.requests.length,0);});

test("public checkout uses only the agreed base and minute-overage items",async()=>{const f=fixture();await f.api.createPlatformElementsCheckout(input);const items=f.requests.find(r=>r.kind==="subscription")!.payload.items as {price:string}[];assert.deepEqual(Array.from(items,item=>item.price),["test_cliste_plan_starter_monthly","test_cliste_plan_starter_overage_min"]);});

for (const failure of ["configuration", "prices"] as const) {
  test(`checkout recovers from ${failure} failure without exposing provider details`, async () => {
    const f = fixture(false, failure);
    const result = await f.api.createPlatformElementsCheckout(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, "Payment setup is temporarily unavailable. Please try again shortly.");
    assert.equal(f.requests.length, 0);
  });
}

 test("retries send identical setup expiry parameters",async()=>{
 const f=fixture();await f.api.createPlatformElementsCheckout(input);await f.api.createPlatformElementsCheckout(input);
 const requests=f.requests.filter(r=>r.kind==="subscription");
 assert.deepEqual(requests[0].payload,requests[1].payload);
 assert.equal(requests[0].payload.cancel_at,input.trialEnd+23*86400);
 });

test("an expired checkout never exposes a reusable payment secret",async()=>{
 const f=fixture(false,"expired");assert.equal((await f.api.createPlatformElementsCheckout(input)).ok,false);
 assert.equal(f.requests.some(r=>r.kind==="hold"||r.kind==="setup"),false);
});
test("invalid stable expiries fail before creating Stripe customer records",async()=>{
 for(const trialEnd of [NaN,1,Infinity]){const f=fixture();assert.equal((await f.api.createPlatformElementsCheckout({...input,trialEnd})).ok,false);assert.equal(f.requests.length,0);}
});
