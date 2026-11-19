import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { customerCallFilters } from "./dashboard-customer-data";
import { isServiceFollowUp, SERVICE_CALL_COLUMNS } from "./service-calls";

const id = "06a25c7e-ce9f-41ba-a7b6-cd212257ef91";
function fixture(options: { authorized?: boolean; knowledge?: boolean; pending?: boolean; erased?: boolean; failed?: boolean; completed?: boolean } = {}) {
  const writes: Record<string, unknown>[] = [];
  const scopes: unknown[][] = [];
  const call = { id, outcome: "answered", post_call_status: options.pending ? "pending" : "complete", call_resolution: null, follow_up_completed_at: options.completed ? "2026-10-26T13:00:00Z" : null, follow_up_completed_by: options.completed ? "owner" : null, caller_data_erased_at: options.erased ? "2026-10-26T13:00:00Z" : null };
  const supabase = { from(table: string) {
    let writing = false;
    const q = {
      select() { return q; }, eq(...args: unknown[]) { scopes.push(args); return q; }, neq() { return q; }, or() { return q; }, is() { return q; },
      update(patch: Record<string, unknown>) { writes.push(patch); writing = true; return q; },
      async maybeSingle() { return { data: writing ? options.failed ? null : { id } : table === "organizations" ? { niche: "other" } : call, error: options.failed && writing ? {} : null }; },
    };
    return q;
  } };
  const imports: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "@/lib/dashboard-admin": { requireDashboardAdmin: async () => { if (options.authorized === false) throw Error("Unauthorized"); return { organizationId: "session-org", user: { id: "owner" }, supabase }; } },
    "@/lib/dashboard-customer-data": { customerCallFilters },
    "@/lib/service-call-knowledge": { loadServiceCallKnowledge: async () => ({ error: false, questions: new Map(options.knowledge ? [[id, { question: "Weekend call-outs?", needsInput: true }]] : []) }) },
    "@/lib/service-calls": { isServiceFollowUp, SERVICE_CALL_COLUMNS },
  };
  const testModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/(dashboard)/dashboard/call-history/service-call-completion-actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: testModule, exports: testModule.exports, require: (name: string) => imports[name] });
  return { writes, scopes, ...(testModule.exports as { updateServiceCallCompletion: (id: string, status: "open" | "resolved", performedBy?: string) => Promise<{ ok: boolean }> }) };
}
test("completion requires owner access and refuses ordinary, pending or erased calls", async () => {
  await assert.rejects(fixture({ authorized: false }).updateServiceCallCompletion(id, "resolved", "Alex"));
  for (const options of [{}, { knowledge: true, pending: true }, { knowledge: true, erased: true }]) {
    const f = fixture(options);
    assert.equal((await f.updateServiceCallCompletion(id, "resolved", "Alex")).ok, false);
    assert.equal(f.writes.length, 0);
  }
});
test("knowledge completion persists owner audit fields in the session organization and can reopen", async () => {
  const f = fixture({ knowledge: true });
  assert.equal((await f.updateServiceCallCompletion(id, "resolved", "Alex")).ok, true);
  assert.equal(f.writes[0].follow_up_completed_by, "owner");
  assert.ok(f.writes[0].follow_up_completed_at);
  assert.equal(f.writes[0].follow_up_completed_by_label, "Alex");
  assert.ok(f.scopes.some(args => args[0] === "organization_id" && args[1] === "session-org"));
  const reopened = fixture({ knowledge: true, completed: true });
  assert.equal((await reopened.updateServiceCallCompletion(id, "open")).ok, true);
  assert.equal(reopened.writes[0].follow_up_completed_at, null);
  assert.equal(reopened.writes[0].follow_up_completed_by, null);
  assert.equal(reopened.writes[0].follow_up_completed_by_label, null);
});
test("invalid ids never write and failed saves are not reported as complete", async () => {
  const invalid = fixture({ knowledge: true });
  assert.equal((await invalid.updateServiceCallCompletion("invalid", "resolved")).ok, false);
  assert.equal(invalid.writes.length, 0);
  assert.equal((await fixture({ knowledge: true, failed: true }).updateServiceCallCompletion(id, "resolved", "Alex")).ok, false);
});

test("completion refuses missing or oversized staff names without writing", async () => {
  for (const name of [undefined, "   ", "x".repeat(81)]) {
    const f = fixture({knowledge:true});
    assert.equal((await f.updateServiceCallCompletion(id,"resolved",name)).ok,false);
    assert.equal(f.writes.length,0);
  }
});
