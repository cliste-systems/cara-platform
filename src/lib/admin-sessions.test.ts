import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import type { SupabaseClient } from "@supabase/supabase-js";

const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const otherSessionId = "33333333-3333-4333-8333-333333333333";

function isolated<T>(relativePath: string, imports: Record<string, unknown>): T {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  vm.runInNewContext(source, { module: m, exports: m.exports, require(name: string) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; }, Date, FormData, Headers, Error }, { filename });
  return m.exports as T;
}

function helpers(rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> = async () => ({ data: true, error: null })) {
  return isolated<typeof import("./admin-sessions")>("./admin-sessions.ts", {
    "server-only": {}, "@/utils/supabase/admin": { createAdminClient: () => ({ rpc }) },
  });
}
function auth(claims: Record<string, unknown> | null, error: unknown = null): SupabaseClient {
  return { auth: { getClaims: async () => ({ data: { claims }, error }) } } as unknown as SupabaseClient;
}

test("live session validity is scoped to the verified user and verified session claim", async () => {
  let checked = false;
  const h = helpers(async (name, args) => { checked = true; assert.equal(name, "admin_auth_session_active"); assert.equal(args.p_user_id, userId); assert.equal(args.p_session_id, sessionId); return { data: true, error: null }; });
  assert.equal(await h.isActiveAdminSession({ id: userId }, auth({ sub: userId, session_id: sessionId })), true);
  assert.equal(checked, true);
});

test("invalid, missing, mismatched and unverified JWT session claims fail without a lookup", async () => {
  const h = helpers(async () => { throw new Error("Lookup should not run"); });
  for (const claims of [null, { sub: userId }, { sub: userId, session_id: "bad" }, { sub: "other-user", session_id: sessionId }]) {
    assert.equal(await h.isActiveAdminSession({ id: userId }, auth(claims)), false);
  }
  assert.equal(await h.isActiveAdminSession({ id: userId }, auth({ sub: userId, session_id: sessionId }, new Error("bad JWT"))), false);
});

test("revocation and unavailable session lookup fail closed even with a valid signed JWT", async () => {
  for (const outcome of [{ data: false, error: null }, { data: true, error: { message: "offline" } }, { data: "true", error: null }]) {
    assert.equal(await helpers(async () => outcome).isActiveAdminSession({ id: userId }, auth({ sub: userId, session_id: sessionId })), false);
  }
  assert.equal(await helpers(async () => { throw new Error("offline"); }).isActiveAdminSession({ id: userId }, auth({ sub: userId, session_id: sessionId })), false);
});

test("session lists expose masked device information and never raw IP/user-agent or tokens", async () => {
  const h = helpers(async (name, args) => {
    assert.equal(name, "admin_list_auth_sessions"); assert.equal(args.p_user_id, userId);
    return { data: [{ id: sessionId, created_at: "2026-09-28T10:00:00Z", refreshed_at: "2026-09-28T11:00:00Z", not_after: null, aal: "aal2", ip: "192.0.2.46", user_agent: "Mozilla Macintosh Mac OS X Chrome/150.0 Safari/537.36", refresh_token: "never-pass" }], error: null };
  });
  const [session] = await h.listAdminStaffSessions(userId, sessionId);
  assert.equal(session.device, "Chrome on Mac"); assert.equal(session.ipMasked, "192.0.x.x");
  assert.equal(session.isCurrent, true); assert.equal(session.mfaVerified, true);
  assert.equal("refresh_token" in session, false); assert.equal("ip" in session, false); assert.equal("user_agent" in session, false);
});

test("IPv4 and IPv6 addresses are masked and unknown clients use an honest fallback", () => {
  const h = helpers();
  assert.equal(h.maskSessionIp("203.0.113.42"), "203.0.x.x");
  assert.equal(h.maskSessionIp("2001:db8:1234:5678::1"), "2001:db8:••••");
  assert.equal(h.maskSessionIp("not an address"), null);
  assert.equal(h.sessionDeviceLabel("node"), "Unidentified device");
  assert.equal(h.sessionDeviceLabel("Mozilla Windows Chrome/10 Edg/10"), "Edge on Windows");
  assert.equal(h.sessionDeviceLabel("Mozilla iPhone CriOS/20 Safari/10"), "Chrome on iPhone");
});

test("scoped session revocation sends one target or an exclusion, always with the staff user", async () => {
  const calls: Record<string, unknown>[] = [];
  const h = helpers(async (name, args) => { assert.equal(name, "admin_revoke_auth_sessions"); calls.push(args); return { data: 2, error: null }; });
  assert.equal(await h.revokeAdminStaffSessions(userId, { sessionId }), 2);
  assert.equal(await h.revokeAdminStaffSessions(userId, { exceptSessionId: sessionId }), 2);
  assert.equal(await h.revokeAdminStaffSessions(userId), 2);
  assert.equal(calls[0].p_user_id, userId); assert.equal(calls[0].p_session_id, sessionId); assert.equal(calls[0].p_except_session_id, null);
  assert.equal(calls[1].p_session_id, null); assert.equal(calls[1].p_except_session_id, sessionId);
  assert.equal(calls[2].p_session_id, null); assert.equal(calls[2].p_except_session_id, null);
});

test("invalid revocation targets never reach the privileged database function", async () => {
  const h = helpers(async () => { throw new Error("Must not call"); });
  await assert.rejects(h.revokeAdminStaffSessions("bad-user"), /valid session/);
  await assert.rejects(h.revokeAdminStaffSessions(userId, { sessionId: "" }), /valid session/);
  await assert.rejects(h.revokeAdminStaffSessions(userId, { sessionId, exceptSessionId: sessionId }), /valid session/);
});

function actions() {
  const revoked: { userId: string; options: { sessionId?: string; exceptSessionId?: string } }[] = [];
  let authenticated = 0;
  let changedPassword: string | null = null;
  const a = isolated<typeof import("../app/(admin)/admin/security/actions")>("../app/(admin)/admin/security/actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect(path: string) { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/admin-session": { requireAdminStaffContext: async () => { authenticated++; return { user: { id: userId, email: "staff@example.invalid" } }; } },
    "@/lib/admin-sessions": { getAdminSessionId: async () => sessionId, revokeAdminStaffSessions: async (target: string, options: { sessionId?: string; exceptSessionId?: string }) => { revoked.push({ userId: target, options }); return 1; } },
    "@/lib/invite-onboarding": { validateInvitePassword: (password: unknown, confirmation: unknown) => typeof password === "string" && password.length >= 12 && password === confirmation ? null : "Invalid password" },
    "@/lib/security-events": { buildSecurityEventContext() { return {}; }, logSecurityEvent: async () => {} },
    "@/utils/supabase/server": { createClient: async () => ({ auth: { updateUser: async ({ password }: { password: string }) => { changedPassword = password; return { error: null }; }, signOut: async () => ({ error: null }) } }) },
  });
  return { a, revoked, authenticated: () => authenticated, changedPassword: () => changedPassword };
}

test("sign-out actions derive the target user from MFA context and cannot accept another user", async () => {
  const { a, revoked, authenticated } = actions(); const form = new FormData();
  form.set("mode", "one"); form.set("sessionId", otherSessionId); form.set("userId", "attacker-selected-user");
  assert.ok((await a.revokeOwnAdminSession({}, form)).success);
  assert.equal(authenticated(), 1); assert.equal(revoked[0].userId, userId); assert.equal(revoked[0].options.sessionId, otherSessionId);
});

test("an empty single-session target cannot become a sign-out-everywhere request", async () => {
  const { a, revoked } = actions(); const form = new FormData(); form.set("mode", "one");
  assert.match((await a.revokeOwnAdminSession({}, form)).error ?? "", /valid session/);
  assert.equal(revoked.length, 0);
  form.set("sessionId", "");
  assert.match((await a.revokeOwnAdminSession({}, form)).error ?? "", /valid session/);
  assert.equal(revoked.length, 0);
});

test("signing out this device requires explicit confirmation and redirects after revocation", async () => {
  const { a, revoked } = actions(); const form = new FormData(); form.set("mode", "one"); form.set("sessionId", sessionId);
  assert.match((await a.revokeOwnAdminSession({}, form)).error ?? "", /Confirm/); assert.equal(revoked.length, 0);
  form.set("confirmCurrent", "yes"); await assert.rejects(a.revokeOwnAdminSession({}, form), /REDIRECT:\/authenticate/); assert.equal(revoked.length, 1);
});

test("sign out others preserves the server-resolved current session", async () => {
  const { a, revoked } = actions(); const form = new FormData(); form.set("mode", "others"); form.set("sessionId", otherSessionId);
  assert.ok((await a.revokeOwnAdminSession({}, form)).success); assert.equal(revoked[0].options.exceptSessionId, sessionId);
});

test("password changes require a valid confirmed password and revoke other sessions", async () => {
  const { a, revoked, changedPassword, authenticated } = actions(); const form = new FormData(); form.set("password", "too-short");
  assert.ok((await a.changeAdminPassword({}, form)).error); assert.equal(changedPassword(), null); assert.equal(revoked.length, 0);
  form.set("password", "unique-long-test-password"); form.set("confirmation", "unique-long-test-password");
  assert.ok((await a.changeAdminPassword({}, form)).success); assert.equal(changedPassword(), "unique-long-test-password");
  assert.equal(authenticated(), 2); assert.equal(revoked[0].userId, userId); assert.equal(revoked[0].options.exceptSessionId, sessionId);
});
