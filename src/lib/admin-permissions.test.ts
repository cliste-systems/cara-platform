import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_PERMISSIONS, adminLandingPath, hasAdminPermission, isAdminPermission, type AdminStaffAccess } from "./admin-permissions";

test("disabled owners and missing staff never receive any capability", () => {
  for (const staff of [null, { role: "owner", status: "disabled", permissions: ADMIN_PERMISSIONS } as AdminStaffAccess]) {
    for (const permission of [...ADMIN_PERMISSIONS, "team"] as const) assert.equal(hasAdminPermission(staff, permission), false);
  }
});

test("members only receive their assigned capability and never team ownership", () => {
  for (const permission of ADMIN_PERMISSIONS) {
    const staff: AdminStaffAccess = { role: "member", status: "active", permissions: [permission] };
    for (const candidate of ADMIN_PERMISSIONS) assert.equal(hasAdminPermission(staff, candidate), candidate === permission);
    assert.equal(hasAdminPermission(staff, "team"), false);
  }
});

test("owner access, safe landing routes, and invalid permissions", () => {
  const owner: AdminStaffAccess = { role: "owner", status: "active", permissions: [] };
  for (const permission of [...ADMIN_PERMISSIONS, "team"] as const) assert.equal(hasAdminPermission(owner, permission), true);
  assert.equal(adminLandingPath(owner), "/admin");
  assert.equal(adminLandingPath({ role: "member", status: "active", permissions: ["support"] }), "/admin/support");
  assert.equal(adminLandingPath({ role: "member", status: "active", permissions: [] }), "/admin/security");
  assert.equal(adminLandingPath({ ...owner, status: "disabled" }), "/authenticate");
  for (const candidate of ["team", "owner", "*", null, 1, {}]) assert.equal(isAdminPermission(candidate), false);
});
