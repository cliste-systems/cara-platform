import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { prepareStaffInvitationAuthentication } from "./admin-staff-auth";
import { buildStaffInvitationEmail } from "./admin-staff-email";
import { canEditStaffMember, parseStaffAccess, parseStaffEmail } from "./admin-staff-input";

const user = { id: "staff-user", email: "teammate@example.com", app_metadata: { existing_claim: "preserved" }, last_sign_in_at: "2026-09-28T10:00:00Z" } as User;
function mockAuth(options: { generatedUser?: User; metadataError?: boolean; token?: string } = {}) {
  const calls: { operation: string; input: unknown }[] = [];
  const admin = { auth: { admin: {
    generateLink: async (input: unknown) => { calls.push({ operation: "generate", input }); return { data: { user: options.generatedUser ?? user, properties: { hashed_token: options.token ?? "one-time-token" } }, error: null }; },
    updateUserById: async (id: string, input: unknown) => { calls.push({ operation: "update", input: { id, ...input as object } }); return { error: options.metadataError ? { message: "failed" } : null }; },
  } } } as unknown as SupabaseClient;
  return { admin, calls };
}
const input = { email: user.email!, displayName: "Team mate", origin: "https://app.hellocara.ie" };

test("an existing established user keeps credentials and receives ordinary sign-in", async () => {
  const { admin, calls } = mockAuth();
  const result = await prepareStaffInvitationAuthentication(admin, { ...input, existingUser: user });
  assert.deepEqual(result, { userId: user.id, actionLink: "https://app.hellocara.ie/authenticate", requiresPassword: false });
  assert.equal(calls.length, 0);
});

test("a new staff identity is gated before its single-use link is returned", async () => {
  const { admin, calls } = mockAuth();
  const result = await prepareStaffInvitationAuthentication(admin, { ...input, existingUser: null });
  assert.equal(result.requiresPassword, true);
  assert.deepEqual(calls.map((call) => call.operation), ["generate", "update"]);
  assert.deepEqual(calls[1].input, { id: user.id, app_metadata: { existing_claim: "preserved", admin_needs_password: true } });
  assert.equal(new URL(result.actionLink).searchParams.get("type"), "invite");
  assert.equal(new URL(result.actionLink).searchParams.get("token_hash"), "one-time-token");
});

test("resending a pending setup keeps its password gate and binds to the same identity", async () => {
  const pending = { ...user, app_metadata: { admin_needs_password: true } };
  const { admin, calls } = mockAuth({ generatedUser: pending });
  const result = await prepareStaffInvitationAuthentication(admin, { ...input, existingUser: pending });
  assert.equal(new URL(result.actionLink).searchParams.get("type"), "magiclink");
  assert.equal((calls[0].input as { type: string }).type, "magiclink");
});

test("changed identity or failed trusted metadata write cannot return an invitation", async () => {
  const pending = { ...user, app_metadata: { admin_needs_password: true } };
  await assert.rejects(prepareStaffInvitationAuthentication(mockAuth({ generatedUser: { ...pending, id: "different" } }).admin, { ...input, existingUser: pending }), /account changed/);
  await assert.rejects(prepareStaffInvitationAuthentication(mockAuth({ metadataError: true }).admin, { ...input, existingUser: null }), /secure the team account/);
});

test("team access rejects unknown capabilities, empty choices and invalid names", () => {
  const form = new FormData(); form.set("displayName", "Alex");
  assert.equal(parseStaffAccess(form).ok, false);
  form.append("permissions", "team"); assert.equal(parseStaffAccess(form).ok, false);
  form.set("permissions", "support"); form.append("permissions", "support");
  assert.deepEqual(parseStaffAccess(form), { ok: true, displayName: "Alex", permissions: ["support"] });
  form.set("displayName", " "); assert.equal(parseStaffAccess(form).ok, false);
});

test("member editing cannot change an owner or the acting user's own account", () => {
  assert.equal(canEditStaffMember({ role: "owner", user_id: "other" }, "actor"), false);
  assert.equal(canEditStaffMember({ role: "member", user_id: "actor" }, "actor"), false);
  assert.equal(canEditStaffMember({ role: "member", user_id: "other" }, "actor"), true);
  assert.equal(parseStaffEmail("  Team@Example.com "), "team@example.com");
  assert.equal(parseStaffEmail("not-an-email"), null);
});

test("email escapes names and links, includes exact chosen access and text alternative", () => {
  const mail = buildStaffInvitationEmail({ recipientName: "<img onerror=alert(1)>", actionLink: "https://app.hellocara.ie/auth/callback?token_hash=a&b=c", requiresPassword: true, permissions: ["support"] });
  assert.ok(mail.html.includes("&lt;img onerror=alert(1)&gt;"));
  assert.ok(!mail.html.includes("<img onerror"));
  assert.ok(mail.html.includes("token_hash=a&amp;b=c"));
  assert.ok(mail.text.includes("Your access: Support."));
  assert.ok(!mail.text.includes("Billing"));
  assert.ok(mail.text.includes("only be used once"));
});
