import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as permissions from "./admin-permissions";
import type { AdminStaffRecord } from "./admin-staff-access";

const initial: AdminStaffRecord = { user_id: "staff-test", email: "staff@example.invalid", display_name: "Test", role: "member", status: "invited", permissions: ["support"] };

function accessFixture(start: AdminStaffRecord | null, options?: { skipUpdate?: boolean; readError?: boolean }) {
  let current = start ? { ...start } : null;
  let updates = 0;
  let reads = 0;
  const admin = { from() {
    let updating = false;
    const filters = new Map<string, unknown>();
    const query = {
      select: () => query,
      update: () => { updating = true; return query; },
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      maybeSingle: async () => {
        if (updating) {
          if (options?.skipUpdate || !current || filters.get("status") !== current.status) return { data: null, error: null };
          updates++;
          current = { ...current, status: "active" };
          return { data: { ...current }, error: null };
        }
        reads++;
        return { data: current ? { ...current } : null, error: options?.readError ? { message: "Database unavailable" } : null };
      },
    };
    return query;
  } };
  const filename = fileURLToPath(new URL("./admin-staff-access.ts", import.meta.url));
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const isolatedModule = { exports: {} };
  const imports: Record<string, unknown> = {
    "server-only": {}, react: { cache: (fn: unknown) => fn },
    "@/lib/admin-permissions": permissions,
    "@/utils/supabase/admin": { createAdminClient: () => admin },
  };
  vm.runInNewContext(source, { module: isolatedModule, exports: isolatedModule.exports, Date, require(name: string) { assert.ok(name in imports); return imports[name]; } }, { filename });
  return { api: isolatedModule.exports as typeof import("./admin-staff-access"), counts: () => ({ updates, reads }), set: (next: AdminStaffRecord | null) => { current = next; } };
}

test("simultaneous first requests activate once and both obtain active staff access", async () => {
  const fixture = accessFixture(initial);
  const [first, second] = await Promise.all([
    fixture.api.activateAdminStaffMembership(initial.user_id),
    fixture.api.activateAdminStaffMembership(initial.user_id),
  ]);
  assert.equal(first?.status, "active");
  assert.equal(second?.status, "active");
  assert.deepEqual(fixture.counts(), { updates: 1, reads: 1 });
});

test("already-activated membership reloads current permissions instead of stale invitation permissions", async () => {
  const fixture = accessFixture({ ...initial, status: "active", permissions: ["inbox"] });
  const record = await fixture.api.activateAdminStaffMembership(initial.user_id);
  assert.equal(record?.status, "active");
  assert.deepEqual(Array.from(record?.permissions ?? []), ["inbox"]);
  assert.deepEqual(fixture.counts(), { updates: 0, reads: 1 });
});

test("a disabled, deleted or still-invited membership cannot be treated as successfully activated", async () => {
  for (const record of [{ ...initial, status: "disabled" as const }, null, initial]) {
    const fixture = accessFixture(record, { skipUpdate: true });
    assert.equal(await fixture.api.activateAdminStaffMembership(initial.user_id), null);
  }
});

test("activation returns the database's current permissions and fails closed when the reload fails", async () => {
  const fixture = accessFixture({ ...initial, permissions: ["calls"] });
  assert.deepEqual(Array.from((await fixture.api.activateAdminStaffMembership(initial.user_id))?.permissions ?? []), ["calls"]);
  const unavailable = accessFixture({ ...initial, status: "active" }, { readError: true });
  await assert.rejects(unavailable.api.activateAdminStaffMembership(initial.user_id), /Could not verify staff access/);
});
