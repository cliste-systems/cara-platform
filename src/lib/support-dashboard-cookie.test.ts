import assert from "node:assert/strict";
import test from "node:test";
import { createSupportDashboardCookieValue, readSupportDashboardCookieValue } from "./support-dashboard-cookie";

const scope = {
  userId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  organizationId: "33333333-3333-4333-8333-333333333333",
};

test("support store scope is signed and cannot be substituted", async () => {
  const previous = process.env.CLISTE_SUPPORT_DASHBOARD_SECRET;
  process.env.CLISTE_SUPPORT_DASHBOARD_SECRET = "test-only-support-secret";
  try {
    const cookie = await createSupportDashboardCookieValue(scope);
    assert.ok(cookie);
    assert.deepEqual(await readSupportDashboardCookieValue(cookie), scope);
    assert.equal(await readSupportDashboardCookieValue(cookie.replace(scope.organizationId, "44444444-4444-4444-8444-444444444444")), null);
    assert.equal(await readSupportDashboardCookieValue(`${cookie}.extra`), null);
    assert.equal(await readSupportDashboardCookieValue(await createSupportDashboardCookieValue()), null);
    assert.equal(await createSupportDashboardCookieValue({ ...scope, userId: "invalid" }), null);
  } finally {
    if (previous === undefined) delete process.env.CLISTE_SUPPORT_DASHBOARD_SECRET;
    else process.env.CLISTE_SUPPORT_DASHBOARD_SECRET = previous;
  }
});
