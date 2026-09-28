import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

import * as teamRoles from "./team-roles";
import * as identifiers from "./rate-limit-identifiers";
import * as ownerAccess from "./account-owner-access";

// Exercise the real server entry points while preventing every external side effect.
function isolated<T>(relativePath: string, imports: Record<string, unknown>): T {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const isolatedModule = { exports: {} };
  vm.runInNewContext(source, {
    module: isolatedModule, exports: isolatedModule.exports,
    require(name: string) {
      assert.ok(name in imports, `Unexpected dependency: ${name}`);
      return imports[name];
    },
    process: { env: {} }, console: { warn() {}, error() {} },
    Date, FormData, Headers, Set, URL,
  }, { filename });
  return isolatedModule.exports as T;
}

function redirect(path: string): never { throw new Error(`REDIRECT:${path}`); }

function adminGuards(level: "aal1" | "aal2", email = "brendan@clistesystems.ie") {
  const user = { id: "audit-admin", email, app_metadata: {} };
  return isolated<typeof import("./admin-session")>("./admin-session.ts", {
    react: { cache: (fn: unknown) => fn },
    "next/navigation": { redirect },
    "@/lib/supabase-env": { allowAdminDevWithoutSupabase: () => false },
    "@/utils/supabase/server": { createClient: async () => ({ auth: {
      getUser: async () => ({ data: { user }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: level }, error: null }) },
    } }) },
  });
}

test("both current and legacy admin guards reject a password-only session", async () => {
  const guards = adminGuards("aal1");
  await assert.rejects(guards.requireAdminSessionUser(), /REDIRECT:\/admin\/mfa/);
  await assert.rejects(guards.requireAdminMfaSessionUser(), /REDIRECT:\/admin\/mfa/);
  assert.equal((await guards.requireAdminMfaSetupSessionUser()).id, "audit-admin");
});

test("verified MFA preserves authorized admin access and never promotes a tenant", async () => {
  assert.equal((await adminGuards("aal2").requireAdminSessionUser()).id, "audit-admin");
  await assert.rejects(adminGuards("aal2", "tenant@example.invalid").requireAdminSessionUser(), /forbidden/);
});

test("only an explicit owner role grants configuration privileges", () => {
  assert.equal(teamRoles.canManageDashboardConfig("admin"), true);
  for (const role of ["member", "owner", "", null, undefined]) {
    assert.equal(teamRoles.canManageDashboardConfig(role), false);
  }
});

function dashboardGuard(role: string, membershipRole: string | null = role) {
  const membership = { select: () => membership, eq: () => membership, maybeSingle: async () => ({ data: membershipRole ? { role: membershipRole } : null, error: null }) };
  return isolated<typeof import("./dashboard-admin")>("./dashboard-admin.ts", {
    "next/navigation": { redirect },
    "@/lib/team-roles": teamRoles,
    "./account-owner-access": ownerAccess,
    "./dashboard-session": { requireDashboardSession: async () => ({
      user: { id: "audit-user" }, organizationId: "audit-org", accountId: "audit-account", profile: { role }, supabase: { from: () => membership },
    }) },
  });
}

function erasure(role: string, boundary: () => never) {
  return isolated<typeof import("../app/(dashboard)/dashboard/privacy/actions")>(
    "../app/(dashboard)/dashboard/privacy/actions.ts", {
      "next/cache": {}, "next/headers": {}, "@/lib/security-events": {},
      "@/lib/booking-reference": { normalizeCustomerPhoneE164: (value: string) => value },
      "@/lib/call-recordings-server": {}, "@/lib/dashboard-session": {},
      "@/lib/dashboard-admin": dashboardGuard(role),
      "@/utils/supabase/admin": { createAdminClient: boundary },
    },
  );
}

function erasureInput() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ phone: "+353870000000", confirm: "ERASE", reason: "Audit", performedBy: "Audit" })) data.set(key, value);
  return data;
}

test("view-only erasure stops before service-role access; an owner reaches the scoped operation", async () => {
  let reached = false;
  const boundary = (): never => { reached = true; throw new Error("DATABASE_BOUNDARY"); };
  await assert.rejects(erasure("member", boundary).eraseCustomerData(erasureInput()), /REDIRECT:\/dashboard/);
  assert.equal(reached, false);
  await assert.rejects(erasure("admin", boundary).eraseCustomerData(erasureInput()), /DATABASE_BOUNDARY/);
  assert.equal(reached, true);
});

test("view-only users cannot mint a billing portal session or upload agent knowledge", async () => {
  const guard = dashboardGuard("member");
  const billing = isolated<typeof import("../app/(dashboard)/dashboard/billing/actions")>(
    "../app/(dashboard)/dashboard/billing/actions.ts", {
      "next/cache": {}, "@/lib/booking-site-origin": {}, "@/lib/company-details": {},
      "@/lib/cliste-plans": {}, "@/lib/dashboard-admin": guard,
      "@/lib/platform-billing-checkout": {}, "@/lib/stripe": { stripeIsConfigured: () => true },
      "@/utils/supabase/admin": {},
    });
  await assert.rejects(billing.openBillingPortal(), /REDIRECT:\/dashboard/);
  const files = isolated<typeof import("../app/(dashboard)/dashboard/agent-setup/business-files-actions")>(
    "../app/(dashboard)/dashboard/agent-setup/business-files-actions.ts", {
      "next/cache": {}, "@/lib/business-files-server": {}, "@/lib/business-files": {},
      "@/lib/cara-prompt-from-org": {}, "@/lib/dashboard-routes": {},
      "@/lib/dashboard-session": {}, "@/lib/dashboard-admin": guard,
      "@/lib/service-catalog": {}, "./agent-faqs": {},
    });
  await assert.rejects(files.uploadBusinessFile(new FormData()), /REDIRECT:\/dashboard/);
});

function limiter(rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>) {
  return isolated<typeof import("./auth-rate-limit")>("./auth-rate-limit.ts", {
    "@/utils/supabase/admin": { createAdminClient: () => ({ rpc }) },
    "./rate-limit-identifiers": identifiers,
  });
}

test("login counter outage, missing RPC, and malformed responses fail closed", async () => {
  for (const response of [
    { data: null, error: { code: "PGRST202" } },
    { data: [], error: null },
    { data: [{ failure_count: 0, retry_after_seconds: "0", requires_captcha: false }], error: null },
  ]) {
    const api = limiter(async () => response);
    const status = await api.getRateLimitStatus("authenticate", "audit-fingerprint");
    assert.equal(status.allowed, false);
    assert.ok(status.retryAfterSeconds > 0);
    assert.equal((await api.recordRateLimitFailure("authenticate", "audit-fingerprint")).allowed, false);
  }
  assert.equal((await limiter(async () => { throw new Error("offline"); }).getRateLimitStatus("authenticate", "audit")).allowed, false);
});

test("record failures uses the atomic database counter with the full lock interval", async () => {
  const api = limiter(async (name, args) => {
    assert.equal(name, "auth_rate_limit_record_failure");
    assert.equal(args.p_window_seconds, 600);
    assert.equal(args.p_lock_seconds, 900);
    assert.equal(args.p_max_failures, 6);
    return { data: [{ failure_count: 6, locked_until: "2030-01-01", retry_after_seconds: 899, requires_captcha: true }], error: null };
  });
  const status = await api.recordRateLimitFailure("authenticate", "audit");
  assert.equal(status.allowed, false);
  assert.equal(status.retryAfterSeconds, 899);
});

test("an owner profile cannot bypass a revoked or downgraded account membership", async () => {
  for (const membership of [null, "member"]) {
    await assert.rejects(dashboardGuard("admin", membership).requireDashboardAdmin(), /REDIRECT:\/dashboard/);
  }
  assert.equal((await dashboardGuard("admin", "admin").requireDashboardAdmin()).accountId, "audit-account");
});

test("paid voice budgets admit the configured count, deny the next request, and fail closed", async () => {
  let count = 0;
  const voice = isolated<typeof import("./voice-api-rate-limit")>("./voice-api-rate-limit.ts", {
    "@/utils/supabase/admin": { createAdminClient: () => ({ rpc: async (name: string, args: Record<string, number | string>) => {
      assert.equal(name, "auth_rate_limit_record_failure");
      assert.equal(args.p_max_failures, 21);
      count = Math.min(count + 1, 21);
      return { error: null, data: [{ failure_count: count, retry_after_seconds: count === 21 ? 60 : 0 }] };
    } }) },
    "./rate-limit-identifiers": identifiers,
    "@/lib/onboarding-dev": { isSignupOnboardingDevRelaxed: () => false },
  });
  const outcomes = await Promise.all(Array.from({ length: 25 }, () => voice.reserveVoiceApiRequest("voice_preview", "audit-actor")));
  assert.equal(outcomes.filter((entry) => entry.allowed).length, 20);
  assert.equal(outcomes.filter((entry) => !entry.allowed).length, 5);
  const unavailable = isolated<typeof import("./voice-api-rate-limit")>("./voice-api-rate-limit.ts", {
    "@/utils/supabase/admin": { createAdminClient: () => ({ rpc: async () => ({ error: { code: "PGRST202" }, data: null }) }) },
    "./rate-limit-identifiers": identifiers,
    "@/lib/onboarding-dev": { isSignupOnboardingDevRelaxed: () => false },
  });
  assert.equal((await unavailable.reserveVoiceApiRequest("greeting_review", "audit")).allowed, false);
});

test("confirmation retries reserve stable network and email counters before successful sends", async () => {
  const reserved: string[] = [];
  let sends = 0;
  const allowed = { allowed: true, retryAfterSeconds: 0, requiresCaptcha: false, failuresInWindow: 0 };
  const resend = isolated<typeof import("../app/signup/resend-confirmation")>("../app/signup/resend-confirmation.ts", {
    "next/headers": { headers: async () => new Headers({ "user-agent": `changing-browser-${sends}` }) },
    "@/lib/onboarding-dev": { isSignupOnboardingDevRelaxed: () => false },
    "@/lib/auth-rate-limit": {
      ...identifiers, getRateLimitStatus: async () => allowed,
      recordRateLimitFailure: async (_scope: string, fingerprint: string) => { reserved.push(fingerprint); return allowed; },
    },
    "@/lib/signup-confirmation-email": { sendSignupConfirmationEmail: async () => { sends += 1; return { ok: true }; } },
  });
  await resend.resendSignupConfirmationEmail("retry@example.invalid");
  await resend.resendSignupConfirmationEmail(" RETRY@example.invalid ");
  assert.equal(sends, 2);
  assert.equal(reserved.length, 4);
  assert.equal(reserved[0], reserved[2]);
  assert.equal(reserved[1], reserved[3]);
  assert.notEqual(reserved[0], reserved[1]);
});
