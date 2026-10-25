import "../../scripts/mock-server-only.ts";
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadInternalCaraRuntimeConfig } from "./internal-cara-runtime-config";

function fixture(access: boolean) {
  const reads: string[] = [];
  const client = (privileged: boolean) => ({ from(table: string) {
    return { select(columns: string) { reads.push(`${privileged}:${table}:${columns}`);return {
      eq(field: string,id: unknown) {
        if(table==='organizations')assert.deepEqual([field,id],['id','test-org']);
        return { maybeSingle: async()=>({error:null,data:table==='platform_cara_rules'?null:
          privileged?{admin_notes:'Private configuration'}:access?{id:'test-org'}:null}) };
      },
    }; } };
  } }) as unknown as SupabaseClient;
  return {reads,session:client(false),internal:client(true)};
}

test('foreign or missing tenant access is rejected before creating a privileged client',async()=>{
  const f=fixture(false);let created=false;
  await assert.rejects(loadInternalCaraRuntimeConfig(f.session,'test-org',()=>{created=true;return f.internal;}),/access could not be verified/);
  assert.equal(created,false);
  assert.deepEqual(f.reads,['false:organizations:id']);
});
test('private notes and runtime rules use the privileged path after tenant access succeeds',async()=>{
  const f=fixture(true);
  const config=await loadInternalCaraRuntimeConfig(f.session,'test-org',()=>f.internal);
  assert.equal(config.adminNotes,'Private configuration');
  assert.deepEqual(f.reads.slice(0,2),['false:organizations:id','true:organizations:admin_notes']);
  assert.ok(f.reads[2]?.startsWith('true:platform_cara_rules:'));
});
