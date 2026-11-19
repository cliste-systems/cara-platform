import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function offersRoute(authorised: boolean, failure = false) {
  let touched = false;
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/admin-session": { requireAdminPermission: async () => { if (!authorised) throw new Error("NEXT_REDIRECT"); } },
    "@/utils/supabase/admin": { createAdminClient: () => { touched = true; return {}; } },
    "@/lib/supervalu-offers-snapshot": { loadSupervaluOffersSnapshot: async () => {
      if (failure) throw new Error("private provider configuration");
      return { offers: [] };
    } },
  };
  const file = new URL("../app/api/admin/supervalu-offers-snapshot/route.ts", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, Error, require(name: string) {
    assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name];
  } });
  return { api: module.exports as { GET(): Promise<Response> }, touched: () => touched };
}

test("unauthorised snapshot requests return 401 before accessing private data", async () => {
  const f = offersRoute(false);
  const response = await f.api.GET();
  assert.equal(response.status, 401);
  assert.equal(f.touched(), false);
  assert.doesNotMatch(await response.text(), /NEXT_REDIRECT|configuration/);
});

test("authorised snapshot download retains its shape and generic errors hide provider details", async () => {
  const success = await offersRoute(true).api.GET();
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { offers: [] });
  const failure = await offersRoute(true, true).api.GET();
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /private provider configuration/);
});
