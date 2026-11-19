import { test } from "node:test";
import assert from "node:assert/strict";
import { navItemsForVertical } from "./dashboard-nav-items";
import { verticalPackForNiche } from "./verticals";
const baseNav = [
  {href:"/dashboard", label:"Overview", section:"core" as const},
  {href:"/dashboard/calls", label:"Calls", section:"core" as const},
];
test("retail retains departments and products while services businesses share the V1 navigation", () => {
  const retail=navItemsForVertical(baseNav,verticalPackForNiche("retail"));
  assert.ok(retail.some(item=>item.href==="/dashboard/departments"));
  assert.ok(retail.some(item=>item.href==="/dashboard/products"));
  assert.ok(!retail.some(item=>item.href==="/dashboard/services"));
  for (const niche of ["electrician","hair_salon","plumber",null]) {
    const nav=navItemsForVertical(baseNav,verticalPackForNiche(niche));
    assert.equal(nav.length,7);
    assert.ok(nav.some(item=>item.href==="/dashboard/services"));
    assert.ok(nav.some(item=>item.label==="Settings & billing"));
    assert.ok(!nav.some(item=>/products|departments|bookings/.test(item.href)));
  }
});

test("each business page has exactly one selected navigation item", async () => {
 const {isDashboardNavItemActive}=await import("./dashboard-nav-active");
 const nav=navItemsForVertical(baseNav,verticalPackForNiche("electrician"));
 for (const path of ["/dashboard/business/profile","/dashboard/business/hours","/dashboard/cara/greeting","/dashboard/settings/phone-setup"]) {
  const selected=nav.filter(item=>isDashboardNavItemActive(path,item));
  assert.deepEqual(selected.map(item=>item.label),["Your business"]);
 }
 assert.deepEqual(nav.filter(item=>isDashboardNavItemActive("/dashboard/settings",item)).map(item=>item.label),["Settings & billing"]);
});
