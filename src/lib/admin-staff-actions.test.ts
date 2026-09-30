import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as staffInput from "./admin-staff-input";

function fixture(options: { deny?: boolean; member?: Record<string, unknown> | null; customer?: boolean; rpcError?: boolean; saveError?: boolean; emailFailure?: boolean } = {}) {
  const mutations: { operation: string; value: unknown }[] = [];
  const audits: Record<string, unknown>[] = [];
  let checked = 0; let prepared = 0; let sent = 0; let dbCreated = 0;
  const actor = { id: "current-owner", email: "owner@example.invalid" };
  const admin = {
    from(table: string) {
      const q = {
        select() { return q; }, eq() { return q; },
        maybeSingle: async () => ({ data: table === "admin_staff" ? options.member ?? null : options.customer ? { organization_id: "customer-org", account_id: "customer-account" } : null, error: null }),
        limit: async () => ({ data: options.customer ? [{ account_id: "customer-account" }] : [], error: null }),
        insert: async (value: unknown) => { mutations.push({ operation: "insert", value }); return { error: options.saveError ? { message: "database unavailable" } : null }; },
        update(value: unknown) { mutations.push({ operation: "update", value }); return q; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ error: null }).then(resolve); },
      };
      return q;
    },
    rpc: async (name: string, value: unknown) => { mutations.push({ operation: name, value }); return { error: options.rpcError ? { message: "cannot change own or last owner" } : null }; },
  };
  const imports: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "next/headers": { headers: async () => new Headers() },
    "@/lib/admin-session": { requireAdminPermission: async (permission: string) => { checked++; assert.equal(permission, "team"); if (options.deny) throw new Error("FORBIDDEN"); return actor; } },
    "@/lib/admin-sessions": { revokeAdminStaffSessions: async (userId: string) => { mutations.push({ operation: "revoke", value: userId }); return 2; } },
    "@/lib/admin-staff-input": staffInput,
    "@/lib/admin-staff-invitation": {
      findStaffAuthUser: async () => options.customer ? { id: "existing-customer" } : null,
      prepareStaffInvitation: async () => { prepared++; return { userId: "invited-user", actionLink: "never-log-this-token", requiresPassword: true }; },
      dispatchStaffInvitation: async () => { sent++; return options.emailFailure ? { ok: false, message: "Provider unavailable" } : { ok: true }; },
    },
    "@/lib/resend-mail": { isResendConfigured: () => true },
    "@/lib/security-events": { buildSecurityEventContext: () => ({}), logSecurityEvent: async (_context: unknown, payload: Record<string, unknown>) => { audits.push(payload); } },
    "@/utils/supabase/admin": { createAdminClient: () => { dbCreated++; return admin; } },
  };
  const filename = fileURLToPath(new URL("../app/(admin)/admin/team/actions.ts", import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const isolatedModule = { exports: {} };
  vm.runInNewContext(compiled, { module: isolatedModule, exports: isolatedModule.exports, require(name: string) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, Date, Error, FormData, Headers });
  return { actions: isolatedModule.exports as typeof import("../app/(admin)/admin/team/actions"), mutations, audits, checked: () => checked, prepared: () => prepared, sent: () => sent, dbCreated: () => dbCreated };
}
function form() { const data = new FormData(); data.set("displayName", "Teammate"); data.set("email", "teammate@example.invalid"); data.set("permissions", "support"); return data; }

test("every team mutation independently requires owner team permission before any privileged work", async () => {
  const f = fixture({ deny: true });
  for (const call of [() => f.actions.inviteStaffMember({}, form()), () => f.actions.updateStaffAccess({}, form()), () => f.actions.changeStaffStatus("other", "disabled"), () => f.actions.resendStaffInvitation("other"), () => f.actions.signOutStaffSessions("other")]) await assert.rejects(call(), /FORBIDDEN/);
  assert.equal(f.checked(), 5); assert.equal(f.dbCreated(), 0); assert.equal(f.sent(), 0);
});

test("status changes use the protected RPC with the authenticated actor before revoking sessions", async () => {
  const member = { user_id: "another-owner", role: "owner" };
  const f = fixture({ member });
  assert.ok((await f.actions.changeStaffStatus("another-owner", "disabled")).success);
  assert.equal(f.mutations[0].operation, "admin_staff_set_status");
  assert.equal((f.mutations[0].value as { p_actor_user_id: string }).p_actor_user_id, "current-owner");
  assert.equal((f.mutations[0].value as { p_target_user_id: string }).p_target_user_id, "another-owner");
  assert.equal(f.mutations[1].operation, "revoke");
  const denied = fixture({ member, rpcError: true });
  assert.ok((await denied.actions.changeStaffStatus("another-owner", "disabled")).error);
  assert.equal(denied.mutations.some((mutation) => mutation.operation === "revoke"), false);
});

test("owners cannot overwrite owner permissions or change their own status", async () => {
  const owner = fixture({ member: { role: "owner", user_id: "another-owner" } });
  const data = form(); data.set("userId", "another-owner");
  assert.ok((await owner.actions.updateStaffAccess({}, data)).error); assert.equal(owner.mutations.length, 0);
  const self = fixture({ member: { role: "owner", user_id: "current-owner" } });
  assert.ok((await self.actions.changeStaffStatus("current-owner", "disabled")).error); assert.equal(self.mutations.length, 0);
});

test("session sign-out targets only an existing other staff member and retains account access", async () => {
  const f = fixture({ member: { user_id: "team-user" } });
  assert.ok((await f.actions.signOutStaffSessions("team-user")).success);
  assert.deepEqual(f.mutations, [{ operation: "revoke", value: "team-user" }]);
  assert.ok((await f.actions.signOutStaffSessions("current-owner")).error);
  assert.ok((await fixture().actions.signOutStaffSessions("missing-staff")).error);
});

test("customer identities are rejected before staff preparation or email delivery", async () => {
  const f = fixture({ customer: true });
  assert.match((await f.actions.inviteStaffMember({}, form())).error ?? "", /customer account/);
  assert.equal(f.prepared(), 0); assert.equal(f.sent(), 0); assert.equal(f.mutations.length, 0);
});

test("failed staff save never dispatches a usable invitation", async () => {
  const f = fixture({ saveError: true });
  assert.ok((await f.actions.inviteStaffMember({}, form())).error);
  assert.equal(f.prepared(), 1); assert.equal(f.sent(), 0);
});

test("email failure preserves the staff row and retry state without logging invite tokens", async () => {
  const f = fixture({ emailFailure: true });
  assert.match((await f.actions.inviteStaffMember({}, form())).warning ?? "", /Team member saved/);
  assert.equal(f.mutations[0].operation, "insert");
  assert.equal((f.mutations[1].value as { invitation_error: string }).invitation_error, "Provider unavailable");
  assert.equal(f.audits.some((event) => event.eventType === "admin_staff_invitation_sent" && event.outcome === "failure"), true);
  assert.equal(JSON.stringify(f.audits).includes("never-log-this-token"), false);
});
