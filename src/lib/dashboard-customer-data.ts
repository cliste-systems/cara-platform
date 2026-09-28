import { ADMIN_SIM_CALLER_E164 } from "@/lib/admin-demo-call-lines";
import { ADMIN_DEMO_ROOM_PREFIX, isEngineerTestCallRow } from "@/lib/engineer-test-call";

export const ENGINEER_CALL_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164},room_name.like.${ADMIN_DEMO_ROOM_PREFIX}*`;
export const ENGINEER_TICKET_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164}`;
const TEST_CALL_FILTER = `${ENGINEER_CALL_FILTER},is_test_call.eq.true`;
export const CUSTOMER_USAGE_TEST_REASONS = ["engineer_test_call", "test_data", "test_call"] as const;

/**
 * PostgREST filters mutate their builder and return `this`. Preserve the original
 * query type without recursively constraining every method's return type to T;
 * that constraint causes TS2589 when Supabase narrows complex result types.
 */
type CallFilterQuery = {
  eq: (column: string, value: boolean) => unknown;
  neq: (column: string, value: string) => unknown;
  or: (filters: string) => unknown;
};

/** Filter at the database, before count/range/limit, so tests cannot displace customers. */
export function customerCallFilters<T extends CallFilterQuery>(query: T): T {
  query.eq("is_test_call", false);
  query.eq("engineer_test_call", false);
  query.neq("caller_number", ADMIN_SIM_CALLER_E164);
  query.or(`room_name.is.null,room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*`);
  return query;
}

export function customerTicketFilters<T extends Pick<CallFilterQuery, "eq" | "neq">>(query: T): T {
  query.eq("engineer_test_call", false);
  query.neq("caller_number", ADMIN_SIM_CALLER_E164);
  return query;
}

/** The usage ledger has no engineer flag; preserve normal rows with null metadata. */
export function customerUsageFilters<T extends Pick<CallFilterQuery, "or">>(query: T): T {
  query.or(`sync_skip_reason.is.null,and(${CUSTOMER_USAGE_TEST_REASONS.map((reason) => `sync_skip_reason.neq.${reason}`).join(",")})`);
  query.or(`caller_number.is.null,caller_number.neq.${ADMIN_SIM_CALLER_E164}`);
  query.or(`room_name.is.null,and(room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*,room_name.not.like.text-rehearsal-*)`);
  query.or("call_sid.is.null,and(call_sid.not.like.RT-TEST-*,call_sid.not.like.KAV-TEST-*,call_sid.not.like.DEMO-5PART-*)");
  return query;
}

type SourceFilterQuery = {
  or: (filters: string, options?: { referencedTable?: string }) => unknown;
  is: (column: string, value: null) => unknown;
};

/** Empty embeds filter optional sources without exposing their contents. */
export const CUSTOMER_TRAINING_JOINS =
  "test_call:call_logs(),test_ticket:action_tickets(),test_ticket_call:action_tickets(test_call:call_logs!inner())";

export function customerTrainingFilters<T extends SourceFilterQuery>(query: T): T {
  query.or(TEST_CALL_FILTER, { referencedTable: "test_call" });
  query.or(ENGINEER_TICKET_FILTER, { referencedTable: "test_ticket" });
  query.or(TEST_CALL_FILTER, { referencedTable: "test_ticket_call.test_call" });
  query.is("test_call", null);
  query.is("test_ticket", null);
  query.is("test_ticket_call", null);
  return query;
}

const TRAINING_SOURCE_JOINS =
  "test_training_call:cara_training_items(test_call:call_logs!inner()),test_training_ticket:cara_training_items(test_ticket:action_tickets!inner()),test_training_ticket_call:cara_training_items(test_ticket:action_tickets!inner(test_call:call_logs!inner()))";
export const CUSTOMER_KNOWLEDGE_EVENT_JOINS = `test_call:call_logs(),${TRAINING_SOURCE_JOINS}`;
export const CUSTOMER_TEMPORAL_JOINS = TRAINING_SOURCE_JOINS;

export function customerTemporalFilters<T extends SourceFilterQuery>(query: T): T {
  query.or(TEST_CALL_FILTER, { referencedTable: "test_training_call.test_call" });
  query.or(ENGINEER_TICKET_FILTER, { referencedTable: "test_training_ticket.test_ticket" });
  query.or(TEST_CALL_FILTER, { referencedTable: "test_training_ticket_call.test_ticket.test_call" });
  query.is("test_training_call", null);
  query.is("test_training_ticket", null);
  query.is("test_training_ticket_call", null);
  return query;
}

export function customerKnowledgeEventFilters<T extends SourceFilterQuery>(query: T): T {
  customerTemporalFilters(query);
  query.or(TEST_CALL_FILTER, { referencedTable: "test_call" });
  query.is("test_call", null);
  return query;
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
