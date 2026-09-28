import test from "node:test";
import assert from "node:assert/strict";
import { isAdminDemoCallRow, resolveEngineerTestCall } from "./engineer-test-call";

test("admin browser demos remain engineer calls but are identifiable for review", () => {
  const demo = { caller_number: "+353870000001", room_name: "admin-demo-example" };
  assert.equal(resolveEngineerTestCall({ callerNumber: demo.caller_number, roomName: demo.room_name }), true);
  assert.equal(isAdminDemoCallRow(demo), true);
  assert.equal(isAdminDemoCallRow({ ...demo, room_name: "other-room" }), false);
  assert.equal(isAdminDemoCallRow({ ...demo, caller_number: "+353871234567" }), false);
});
