import { ADMIN_SIM_CALLER_E164 } from "@/lib/admin-demo-call-lines";
import { ADMIN_DEMO_ROOM_PREFIX, isEngineerTestCallRow } from "@/lib/engineer-test-call";

export const ENGINEER_CALL_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164},room_name.like.${ADMIN_DEMO_ROOM_PREFIX}*`;
export const ENGINEER_TICKET_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164}`;
const TEST_CALL_FILTER = `${ENGINEER_CALL_FILTER},is_test_call.eq.true`;
export const CUSTOMER_USAGE_TEST_REASONS = ["engineer_test_call", "test_data", "test_call"] as const;

/** Filter at the database, before count/range/limit, so tests cannot displace customers. */
export function customerCallFilters<T extends {
  eq: (column: string, value: boolean) => T;
  neq: (column: string, value: string) => T;
  or: (filters: string) => T;
}>(query: T): T {
  return query.eq("is_test_call", false).eq("engineer_test_call", false)
    .neq("caller_number", ADMIN_SIM_CALLER_E164)
    .or(`room_name.is.null,room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*`);
}

export function customerTicketFilters<T extends {
  eq: (column: string, value: boolean) => T;
  neq: (column: string, value: string) => T;
}>(query: T): T {
  return query.eq("engineer_test_call", false).neq("caller_number", ADMIN_SIM_CALLER_E164);
}

/** The usage ledger has no engineer flag; preserve normal rows with null metadata. */
export function customerUsageFilters<T extends { or: (filters: string) => T }>(query: T): T {
  return query
    .or(`sync_skip_reason.is.null,and(${CUSTOMER_USAGE_TEST_REASONS.map((reason) => `sync_skip_reason.neq.${reason}`).join(",")})`)
    .or(`caller_number.is.null,caller_number.neq.${ADMIN_SIM_CALLER_E164}`)
    .or(`room_name.is.null,and(room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*,room_name.not.like.text-rehearsal-*)`)
    .or("call_sid.is.null,and(call_sid.not.like.RT-TEST-*,call_sid.not.like.KAV-TEST-*,call_sid.not.like.DEMO-5PART-*)");
}

type SourceFilterQuery<T> = {
  or: (filters: string, options?: { referencedTable?: string }) => T;
  is: (column: string, value: null) => T;
};

/** Empty embeds filter optional sources without exposing their contents. */
export const CUSTOMER_TRAINING_JOINS =
  "test_call:call_logs(),test_ticket:action_tickets(),test_ticket_call:action_tickets(test_call:call_logs!inner())";

export function customerTrainingFilters<T extends SourceFilterQuery<T>>(query: T): T {
  return query.or(TEST_CALL_FILTER, { referencedTable: "test_call" })
    .or(ENGINEER_TICKET_FILTER, { referencedTable: "test_ticket" })
    .or(TEST_CALL_FILTER, { referencedTable: "test_ticket_call.test_call" })
    .is("test_call", null).is("test_ticket", null).is("test_ticket_call", null);
}

const TRAINING_SOURCE_JOINS =
  "test_training_call:cara_training_items(test_call:call_logs!inner()),test_training_ticket:cara_training_items(test_ticket:action_tickets!inner()),test_training_ticket_call:cara_training_items(test_ticket:action_tickets!inner(test_call:call_logs!inner()))";
export const CUSTOMER_KNOWLEDGE_EVENT_JOINS = `test_call:call_logs(),${TRAINING_SOURCE_JOINS}`;
export const CUSTOMER_TEMPORAL_JOINS = TRAINING_SOURCE_JOINS;

export function customerTemporalFilters<T extends SourceFilterQuery<T>>(query: T): T {
  return query.or(TEST_CALL_FILTER, { referencedTable: "test_training_call.test_call" })
    .or(ENGINEER_TICKET_FILTER, { referencedTable: "test_training_ticket.test_ticket" })
    .or(TEST_CALL_FILTER, { referencedTable: "test_training_ticket_call.test_ticket.test_call" })
    .is("test_training_call", null).is("test_training_ticket", null).is("test_training_ticket_call", null);
}

export function customerKnowledgeEventFilters<T extends SourceFilterQuery<T>>(query: T): T {
  return customerTemporalFilters(query)
    .or(TEST_CALL_FILTER, { referencedTable: "test_call" }).is("test_call", null);
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
  return !isEngineerTestCallRow({ engineer_test_call: row.engineerTestCall, caller_number: row.callerId });
}
