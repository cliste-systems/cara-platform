import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
function fixture(fail = false) {
  const rows: Record<string, unknown>[] = [];
  const compiled = ts.transpileModule(readFileSync(new URL("./application-monitoring.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports:{}};
  vm.runInNewContext(compiled,{module:mod,exports:mod.exports,process:{env:{NODE_ENV:"test"}},AbortSignal,console:{warn(){}},require(name:string){if(name === "server-only")return {};assert.equal(name,"@/utils/supabase/admin");return {createAdminClient:()=>({from:()=>({insert:(row:Record<string,unknown>)=>{if(fail)throw new Error("offline");rows.push(row);return {abortSignal:async()=>({error:null})};}})})};}});
  return {rows,api:mod.exports as typeof import("./application-monitoring")};
}
test("monitoring stores only bounded metadata, not arbitrary context or error contents",async()=>{
  const f=fixture();
  await f.api.recordApplicationEvent({kind:"slow",operation:"billing/prepare",code:"over_3_seconds",organizationId:"not-an-id",durationMs:4000000});
  assert.equal(f.rows[0].organization_id,null);
  assert.equal(f.rows[0].duration_ms,3600000);
  assert.deepEqual(Object.keys(f.rows[0]).sort(),["code","duration_ms","environment","kind","operation","organization_id"]);
});
test("monitoring storage failure never prevents the customer operation from recovering",async()=>{
  await assert.doesNotReject(()=>fixture(true).api.recordApplicationEvent({kind:"error",operation:"billing/prepare",code:"failed"}));
});
