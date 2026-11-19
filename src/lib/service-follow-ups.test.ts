import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  serviceFollowUpFilters,
  SERVICE_FOLLOW_UP_FILTER,
} from "./service-follow-ups";

test("follow-up queries use live requests, exclude tests and erased callers, and keep completed work separate", () => {
  const filters: unknown[][] = [];
  const q = {
    eq(...v: unknown[]) {
      filters.push(["eq", ...v]);
      return this;
    },
    neq(...v: unknown[]) {
      filters.push(["neq", ...v]);
      return this;
    },
    is(...v: unknown[]) {
      filters.push(["is", ...v]);
      return this;
    },
    not(...v: unknown[]) {
      filters.push(["not", ...v]);
      return this;
    },
    or(...v: unknown[]) {
      filters.push(["or", ...v]);
      return this;
    },
  };
  assert.equal(serviceFollowUpFilters(q, "open"), q);
  assert.ok(filters.some((f) => f[1] === "is_test_call" && f[2] === false));
  assert.ok(
    filters.some((f) => f[1] === "caller_data_erased_at" && f[2] === null),
  );
  assert.ok(filters.some((f) => f[1] === SERVICE_FOLLOW_UP_FILTER));
  assert.ok(
    filters.some((f) => f[0] === "is" && f[1] === "follow_up_completed_at"),
  );
  filters.length = 0;
  serviceFollowUpFilters(q, "resolved");
  assert.ok(
    filters.some((f) => f[0] === "not" && f[1] === "follow_up_completed_at"),
  );
});
function actionFixture(authorized = true, failed = false) {
  const calls: unknown[][] = [];
  const imports: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "@/lib/dashboard-admin": {
      requireDashboardAdmin: async () => {
        if (!authorized) throw Error("Unauthorized");
        return {
          organizationId: "session-org",
          supabase: {
            rpc: async (...args: unknown[]) => {
              calls.push(args);
              return {
                data: !failed,
                error: failed ? { message: "failure" } : null,
              };
            },
          },
        };
      },
    },
  };
  const testModule = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL(
          "../app/(dashboard)/dashboard/call-history/follow-up-actions.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      module: testModule,
      exports: testModule.exports,
      require: (name: string) => imports[name],
    },
  );
  return {
    calls,
    ...(testModule.exports as {
      updateFollowUp: (
        id: string,
        status: "open" | "resolved",
      ) => Promise<{ ok: boolean }>;
    }),
  };
}
const id = "06a25c7e-ce9f-41ba-a7b6-cd212257ef91";
test("only owners can complete follow-ups and all writes use the session organization", async () => {
  const denied = actionFixture(false);
  await assert.rejects(denied.updateFollowUp(id, "resolved"));
  assert.equal(denied.calls.length, 0);
  const f = actionFixture();
  assert.equal((await f.updateFollowUp(id, "resolved")).ok, true);
  const args = f.calls[0][1] as Record<string, unknown>;
  assert.equal(args.p_organization_id, "session-org");
  assert.equal(args.p_completed, true);
  assert.equal((await f.updateFollowUp(id, "open")).ok, true);
  assert.equal((f.calls[1][1] as Record<string, unknown>).p_completed, false);
});
test("invalid identifiers never write and failed saves remain errors", async () => {
  const f = actionFixture();
  assert.equal((await f.updateFollowUp("bad", "resolved")).ok, false);
  assert.equal(f.calls.length, 0);
  assert.equal(
    (await actionFixture(true, true).updateFollowUp(id, "resolved")).ok,
    false,
  );
});
