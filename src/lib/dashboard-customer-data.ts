import { ADMIN_SIM_CALLER_E164 } from "@/lib/admin-demo-call-lines";
import {
  ADMIN_DEMO_ROOM_PREFIX,
  isEngineerTestCallRow,
} from "@/lib/engineer-test-call";

/** Keep legacy rows identifiable even when their engineer flag was not backfilled. */
export const ENGINEER_CALL_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164},room_name.like.${ADMIN_DEMO_ROOM_PREFIX}*`;

export const ENGINEER_TICKET_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164}`;

/** Apply before count/range/limit: test traffic must not displace customer data. */
export function customerCallFilters<T extends {
  eq: (column: string, value: boolean) => T;
  neq: (column: string, value: string) => T;
  or: (filters: string) => T;
}>(query: T): T {
  return query
    .eq("is_test_call", false)
    .eq("engineer_test_call", false)
    .neq("caller_number", ADMIN_SIM_CALLER_E164)
    .or(`room_name.is.null,room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*`);
}

export function customerTicketFilters<T extends {
  eq: (column: string, value: boolean) => T;
  neq: (column: string, value: string) => T;
}>(query: T): T {
  return query
    .eq("engineer_test_call", false)
    .neq("caller_number", ADMIN_SIM_CALLER_E164);
}

/** Usage has no engineer flag. Honour ledger skip reasons AND legacy markers. */
export function customerUsageFilters<T extends {
  or: (filters: string) => T;
}>(query: T): T {
  return query
    .or("sync_skip_reason.is.null,and(sync_skip_reason.neq.engineer_test_call,sync_skip_reason.neq.test_data)")
    .or(`caller_number.is.null,caller_number.neq.${ADMIN_SIM_CALLER_E164}`)
    .or(`room_name.is.null,and(room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*,room_name.not.like.text-rehearsal-*)`)
    .or("call_sid.is.null,and(call_sid.not.like.RT-TEST-*,call_sid.not.like.KAV-TEST-*,call_sid.not.like.DEMO-5PART-*)");
}

/** Empty embeds support anti-joins without returning caller data to the UI. */
export const CUSTOMER_TRAINING_JOINS =
  "test_call:call_logs(),test_ticket:action_tickets()";

/** Exclude source-linked test training before exact counts and list limits. */
export function customerTrainingFilters<T extends {
  or: (filters: string, options?: { referencedTable?: string }) => T;
  is: (column: string, value: null) => T;
}>(query: T): T {
  return query
    .or(`${ENGINEER_CALL_FILTER},is_test_call.eq.true`, { referencedTable: "test_call" })
    .or(ENGINEER_TICKET_FILTER, { referencedTable: "test_ticket" })
    .is("test_call", null)
    .is("test_ticket", null);
}

export function isCustomerCallRow(row: {
  is_test_call?: boolean | null;
  engineer_test_call?: boolean | null;
  caller_number?: string | null;
  room_name?: string | null;
}): boolean {
  return row.is_test_call !== true && !isEngineerTestCallRow(row);
}

export function isCustomerCallListItem(row: {
  engineerTestCall?: boolean | null;
  callerId?: string | null;
}): boolean {
  return !isEngineerTestCallRow({
    engineer_test_call: row.engineerTestCall,
    caller_number: row.callerId,
  });
}
