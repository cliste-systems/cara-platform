import assert from "node:assert/strict";
import test from "node:test";

import { managedClientSetupRequirement } from "./managed-onboarding-access";

const managedUser = {
  id: "invited-user",
  app_metadata: { managed_onboarding: true, needs_password: true },
};

test("legacy password flags do not block authenticated managed users with current agreements", async () => {
  const result = await managedClientSetupRequirement({
    user: managedUser, organizationId: "store-1",
    hasCurrentLegalAcceptances: async () => true,
  });
  assert.equal(result, null);
});

test("user-editable metadata cannot remove the managed agreement gate", async () => {
  const user = { ...managedUser, user_metadata: { managed_onboarding: false, needs_password: false } };
  assert.equal(await managedClientSetupRequirement({
    user, organizationId: "store-1", hasCurrentLegalAcceptances: async () => false,
  }), "agreements");
});

test("password completion alone does not unlock the API", async () => {
  const user = { ...managedUser, app_metadata: { managed_onboarding: true, needs_password: false } };
  assert.equal(await managedClientSetupRequirement({
    user, organizationId: "store-1", hasCurrentLegalAcceptances: async () => false,
  }), "agreements");
});

test("the invited user and current store must have accepted current agreements", async () => {
  const user = { ...managedUser, app_metadata: { managed_onboarding: true, needs_password: false } };
  const lookups: string[][] = [];
  assert.equal(await managedClientSetupRequirement({
    user, organizationId: "store-1",
    hasCurrentLegalAcceptances: async (userId, organizationId) => {
      lookups.push([userId, organizationId]);
      return true;
    },
  }), null);
  assert.deepEqual(lookups, [["invited-user", "store-1"]]);
});

test("missing profiles and unavailable acceptance records fail closed", async () => {
  const user = { ...managedUser, app_metadata: { managed_onboarding: true, needs_password: false } };
  assert.equal(await managedClientSetupRequirement({
    user, organizationId: null, hasCurrentLegalAcceptances: async () => true,
  }), "agreements");
  assert.equal(await managedClientSetupRequirement({
    user, organizationId: "store-1", hasCurrentLegalAcceptances: async () => { throw new Error("Unavailable"); },
  }), "agreements");
});

test("self-serve onboarding keeps its existing API access without a managed agreement lookup", async () => {
  let queried = false;
  assert.equal(await managedClientSetupRequirement({
    user: { id: "self-serve-user", app_metadata: {} }, organizationId: "store-2",
    hasCurrentLegalAcceptances: async () => { queried = true; return false; },
  }), null);
  assert.equal(queried, false);
});
