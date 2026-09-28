import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareInviteAuthentication } from "./invite-auth-preparation";

const input = { email: "owner@example.com", redirectTo: "https://app.hellocara.ie/auth/callback?next=setup", recipientName: "Jane", managedOnboarding: true };
function mockAdmin(options: { existing?: boolean; needsPassword?: boolean; updateFails?: boolean; id?: string; generateFails?: boolean; signedIn?: boolean; invited?: boolean } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const admin = { auth: { admin: {
    getUserById: async (...args: unknown[]) => {
      calls.push({ method: "getUserById", args });
      return { data: { user: { id: "user-1", invited_at: options.invited ? "2026-09-28T10:00:00Z" : null, last_sign_in_at: options.signedIn ? "2026-09-28T11:00:00Z" : null } }, error: null };
    },
    generateLink: async (...args: unknown[]) => {
      calls.push({ method: "generateLink", args });
      return options.generateFails
        ? { data: { user: null }, error: { message: "User already registered" } }
        : { data: { user: { id: options.id ?? "user-1", app_metadata: { provider: "email", ...(options.existing ? { needs_password: options.needsPassword ?? false } : {}) } }, properties: { hashed_token: "single-use-token" } }, error: null };
    },
    updateUserById: async (...args: unknown[]) => { calls.push({ method: "updateUserById", args }); return { error: options.updateFails ? { message: "unavailable" } : null }; },
    deleteUser: async () => { throw new Error("Never delete an account during invitation preparation"); },
  } } } as unknown as SupabaseClient;
  return { admin, calls };
}

test("new invitations receive trusted setup state before a link can be sent", async () => {
  const { admin, calls } = mockAdmin();
  const result = await prepareInviteAuthentication(admin, input);
  assert.equal(result.ok, true);
  assert.deepEqual(calls[1], { method: "updateUserById", args: ["user-1", { app_metadata: { provider: "email", needs_password: true, managed_onboarding: true } }] });
  if (result.ok) {
    assert.equal(result.requiresPassword, true);
    const url = new URL(result.actionLink);
    assert.equal(url.searchParams.get("next"), "setup");
    assert.equal(url.searchParams.get("type"), "invite");
    assert.equal(url.searchParams.get("token_hash"), "single-use-token");
  }
});

test("an established managed invite enables the agreement gate without resetting credentials", async () => {
  const { admin, calls } = mockAdmin({ existing: true });
  const result = await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1" });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args, [{ type: "magiclink", email: input.email, options: { redirectTo: input.redirectTo } }]);
  assert.deepEqual(calls[1], { method: "updateUserById", args: ["user-1", { app_metadata: { provider: "email", needs_password: false, managed_onboarding: true } }] });
  if (result.ok) assert.equal(result.requiresPassword, false);
});

test("an unfinished existing invitation keeps its trusted password gate", async () => {
  const { admin } = mockAdmin({ existing: true, needsPassword: true });
  const result = await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1" });
  if (!result.ok) assert.fail(result.message);
  assert.equal(result.requiresPassword, true);
});

test("failed setup metadata cannot yield a usable prepared invitation", async () => {
  const { admin } = mockAdmin({ updateFails: true });
  assert.equal((await prepareInviteAuthentication(admin, input)).ok, false);
});

test("unexpected existing identities are rejected without mutating or deleting them", async () => {
  const { admin, calls } = mockAdmin({ id: "other-user" });
  assert.equal((await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1" })).ok, false);
  assert.equal(calls.length, 1);
});

test("registered addresses are never silently converted into an unvalidated magiclink", async () => {
  const { admin, calls } = mockAdmin({ generateFails: true });
  assert.equal((await prepareInviteAuthentication(admin, input)).ok, false);
  assert.equal(calls.length, 1);
});


test("an orphan invitation can recover its trusted setup flags before first sign-in", async () => {
  const { admin, calls } = mockAdmin({ existing: true, invited: true });
  const result = await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1", initializePendingSetup: true });
  assert.equal(result.ok, true);
  assert.equal(calls.at(-1)?.method, "updateUserById");
  if (result.ok) assert.equal(result.requiresPassword, true);
});

test("orphan recovery refuses accounts with a sign-in history or no invitation", async () => {
  for (const options of [{ existing: true, invited: true, signedIn: true }, { existing: true, invited: false }]) {
    const { admin, calls } = mockAdmin(options);
    assert.equal((await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1", initializePendingSetup: true })).ok, false);
    assert.equal(calls.length, 1);
  }
});


test("an established unmanaged invite does not change authentication metadata", async () => {
  const { admin, calls } = mockAdmin({ existing: true });
  const result = await prepareInviteAuthentication(admin, { ...input, managedOnboarding: false, existingUserId: "user-1" });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
});

test("an established managed invitation cannot proceed if its data gate could not be set", async () => {
  const { admin } = mockAdmin({ existing: true, updateFails: true });
  assert.equal((await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1" })).ok, false);
});

test("an established login without a password flag stays without one when joining managed onboarding", async () => {
  const { admin, calls } = mockAdmin();
  const result = await prepareInviteAuthentication(admin, { ...input, existingUserId: "user-1" });
  assert.equal(result.ok, true);
  assert.deepEqual(calls[1], { method: "updateUserById", args: ["user-1", { app_metadata: { provider: "email", managed_onboarding: true } }] });
  if (result.ok) assert.equal(result.requiresPassword, false);
});
