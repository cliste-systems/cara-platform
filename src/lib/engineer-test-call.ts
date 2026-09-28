import { ADMIN_SIM_CALLER_E164 } from "@/lib/admin-demo-call-lines";

export const ADMIN_DEMO_ROOM_PREFIX = "admin-demo-";

export const ENGINEER_TEST_CALL_BRAND = "HelloCara Engineer";

export const ENGINEER_TEST_CALL_LIST_LABEL = ENGINEER_TEST_CALL_BRAND;

export const ENGINEER_TEST_CALL_DETAIL_TITLE = "HelloCara Engineer Test Call";

export const ENGINEER_TEST_CALL_BADGE_LABEL = "Test";

export const ENGINEER_TEST_CALL_SUMMARY =
  "We run test calls after setup or when troubleshooting. This one isn't billed, and there's no recording or transcript in your dashboard.";

export const ENGINEER_TEST_ARTIFACT_NOTE =
  "This came from a HelloCara test call. You can review it, but you can't action it in your dashboard.";

export const ENGINEER_TEST_TRAINING_BLOCK_MESSAGE =
  "This training item is from a HelloCara test call and can't be answered or dismissed here.";

export const ENGINEER_TEST_TICKET_BLOCK_MESSAGE =
  "This follow-up is from a HelloCara test call — preview only. You can't mark it done or text the caller.";

export const ENGINEER_TEST_CALL_ROW_SUBTITLE = "Test call · not billed";

export const ENGINEER_TEST_CALL_CALLER_LABEL = ENGINEER_TEST_CALL_BRAND;

export function isEngineerTestCallerNumber(
  callerNumber: string | null | undefined,
): boolean {
  return (callerNumber ?? "").trim() === ADMIN_SIM_CALLER_E164;
}

export function isEngineerTestRoomName(
  roomName: string | null | undefined,
): boolean {
  return (roomName ?? "").trim().startsWith(ADMIN_DEMO_ROOM_PREFIX);
}

export function resolveEngineerTestCall(input: {
  engineerTestCall?: boolean | null;
  callerNumber?: string | null;
  roomName?: string | null;
}): boolean {
  if (input.engineerTestCall === true) return true;
  if (isEngineerTestCallerNumber(input.callerNumber)) return true;
  if (isEngineerTestRoomName(input.roomName)) return true;
  return false;
}

/** Browser demo calls are internal test calls, but founders can review them in Call analysis. */
export function isAdminDemoCallRow(row: {
  caller_number?: string | null;
  room_name?: string | null;
}): boolean {
  return isEngineerTestCallerNumber(row.caller_number) && isEngineerTestRoomName(row.room_name);
}

export function isEngineerTestCallRow(row: {
  engineer_test_call?: boolean | null;
  caller_number?: string | null;
  room_name?: string | null;
}): boolean {
  return resolveEngineerTestCall({
    engineerTestCall: row.engineer_test_call,
    callerNumber: row.caller_number,
    roomName: row.room_name,
  });
}
