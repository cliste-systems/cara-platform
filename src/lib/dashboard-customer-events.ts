import { CUSTOMER_USAGE_TEST_REASONS, isCustomerCallRow } from "@/lib/dashboard-customer-data";
import type { DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Classify raw metadata BEFORE reducing a Realtime row to a customer event. */
export function customerIncomingCallDetail(
  row: Record<string, unknown>,
  source: "call_log" | "usage",
): DashboardIncomingCallDetail | null {
  if (!isCustomerCallRow({
    engineer_test_call: row.engineer_test_call === true,
    is_test_call: row.is_test_call === true,
    caller_number: stringField(row, "caller_number"),
    room_name: stringField(row, "room_name"),
  })) return null;
  const room = stringField(row, "room_name");
  const sid = stringField(row, "call_sid");
  if (room?.startsWith("text-rehearsal-")) return null;
  if (sid && ["RT-TEST-", "KAV-TEST-", "DEMO-5PART-"].some((prefix) => sid.startsWith(prefix))) return null;

  if (source === "usage") {
    if (row.ended_at != null) return null;
    const reason = stringField(row, "sync_skip_reason");
    if (CUSTOMER_USAGE_TEST_REASONS.some((value) => value === reason)) return null;
    return {
      phase: "in_progress",
      callerNumber: stringField(row, "caller_number"),
      startedAt: stringField(row, "started_at") ?? new Date().toISOString(),
      usageRecordId: stringField(row, "id"),
    };
  }
  return {
    phase: "loading",
    callLogId: stringField(row, "id"),
    callerNumber: stringField(row, "caller_number"),
    startedAt: stringField(row, "created_at") ?? new Date().toISOString(),
  };
}
