import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function fixture(winner: string | null = "sub_winner", databaseError = false) {
  const cancelled: string[] = [];
  const admin = { from: () => ({select: () => ({eq: () => ({maybeSingle: async () => ({data:{completed_subscription_id:winner},error:databaseError ? new Error("database unavailable") : null})})})}) };
  const imports: Record<string, unknown> = {
    "server-only": {}, "@/lib/cliste-plans": {},
    "@/utils/supabase/admin": {createAdminClient: () => admin},
    "@/lib/stripe": {getStripeClient: () => ({subscriptions:{cancel: async (id:string, options:unknown) => {assert.deepEqual(JSON.parse(JSON.stringify(options)),{invoice_now:false,prorate:false});cancelled.push(id);}}})},
  };
  const mod = {exports:{}};
  const source = readFileSync(new URL("./signup-billing-security.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(key:string)=>{assert.ok(key in imports);return imports[key];}});
  return {api:mod.exports as typeof import("./signup-billing-security"),cancelled};
}
const candidate = (id="sub_loser", account="account_1", status="trialing") => ({id,status,metadata:{cliste_signup_flow:"simple_v1",cliste_account_id:account}}) as Parameters<typeof import("./signup-billing-security").cancelSupersededSignupSubscription>[1];
test("a losing checkout is cancelled without invoicing or proration",async()=>{const f=fixture();assert.equal(await f.api.cancelSupersededSignupSubscription("account_1",candidate()),true);assert.deepEqual(f.cancelled,["sub_loser"]);});
test("winning subscription and other tenants cannot be cancelled",async()=>{const f=fixture();for(const sub of [candidate("sub_winner"),candidate("sub_other","account_2")]) assert.equal(await f.api.cancelSupersededSignupSubscription("account_1",sub),false);assert.deepEqual(f.cancelled,[]);});
test("no winner means no cancellation",async()=>{const f=fixture(null);assert.equal(await f.api.cancelSupersededSignupSubscription("account_1",candidate()),false);assert.deepEqual(f.cancelled,[]);});
test("database failure retries instead of cancelling an unverified subscription",async()=>{const f=fixture(null,true);await assert.rejects(()=>f.api.cancelSupersededSignupSubscription("account_1",candidate()),/database unavailable/);assert.deepEqual(f.cancelled,[]);});
test("already cancelled duplicates are idempotent",async()=>{const f=fixture();assert.equal(await f.api.cancelSupersededSignupSubscription("account_1",candidate("sub_loser","account_1","canceled")),true);assert.deepEqual(f.cancelled,[]);});
