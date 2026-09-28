import assert from "node:assert/strict";
import test from "node:test";
import { clientAccountAccessError, clientSlug, supportsInvoiceClientSetup } from "./admin-client-account";

const existing = { accountId: "group-a", profileAccountId: "group-a", hasProfile: true, membershipAccountIds: ["group-a"], isStaff: false };

test("the same group contact can manage an additional store", () => {
  assert.equal(clientAccountAccessError(existing), null);
});

test("an existing contact cannot be reassigned to another legal organisation", () => {
  assert.match(clientAccountAccessError({ ...existing, accountId: "group-b" })!, /another organisation/);
  assert.match(clientAccountAccessError({ ...existing, accountId: null })!, /another organisation/);
});

test("conflicting memberships fail closed even when the profile matches", () => {
  assert.match(clientAccountAccessError({ ...existing, membershipAccountIds: ["group-a", "group-b"] })!, /another organisation/);
});

test("a new or unlinked invite can be completed but staff cannot become a customer", () => {
  assert.equal(clientAccountAccessError({ accountId: "group-a", profileAccountId: null, hasProfile: false, membershipAccountIds: [], isStaff: false }), null);
  assert.match(clientAccountAccessError({ ...existing, isStaff: true })!, /staff admin/);
});

test("store identifiers normalize punctuation and accents safely", () => {
  assert.equal(clientSlug(" Murphy’s SuperValu, Killarney "), "murphys-supervalu-killarney");
});

test("legacy retail setup markers are eligible but a real card subscription is preserved", () => {
  for (const subscriptionId of [null, "dev_seed_skipped", "kavanaghs_demo_seed"]) {
    assert.equal(supportsInvoiceClientSetup({billingMethod: null, subscriptionId, storeNiches: ["retail"]}), true);
  }
  assert.equal(supportsInvoiceClientSetup({billingMethod: null, subscriptionId: "sub_live123", storeNiches: ["retail"]}), false);
  assert.equal(supportsInvoiceClientSetup({billingMethod: "card", subscriptionId: null, storeNiches: ["retail"]}), false);
});
