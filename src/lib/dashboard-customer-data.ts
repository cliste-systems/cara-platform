import { ADMIN_SIM_CALLER_E164 } from "@/lib/admin-demo-call-lines";
import { ADMIN_DEMO_ROOM_PREFIX, isEngineerTestCallRow } from "@/lib/engineer-test-call";

export const ENGINEER_CALL_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164},room_name.like.${ADMIN_DEMO_ROOM_PREFIX}*`;
export const ENGINEER_TICKET_FILTER =
  `engineer_test_call.eq.true,caller_number.eq.${ADMIN_SIM_CALLER_E164}`;
const TEST_CALL_FILTER = `${ENGINEER_CALL_FILTER},is_test_call.eq.true`;
export const CUSTOMER_USAGE_TEST_REASONS = ["engineer_test_call", "test_data", "test_call"] as const;

type CallFilterQuery = {
  eq: (column: string, value: boolean) => unknown;
  neq: (column: string, value: string) => unknown;
  or: (filters: string) => unknown;
};
type SourceFilterQuery = {
  or: (filters: string, options?: { referencedTable?: string }) => unknown;
  is: (column: string, value: null) => unknown;
};

/**
 * Validate a small runtime interface separately from the generic result type.
 * Structurally comparing Supabase's overloaded methods in a generic constraint
 * recursively expands the complete query builder and can produce TS2589.
 * The original T is returned unchanged, preserving its selected-row types.
 */
function requireMethods(value: unknown, names: string[]): asserts value is object {
  if (value === null || typeof value !== "object" || names.some((name) => typeof Reflect.get(value, name) !== "function")) {
    throw new TypeError(`Customer data filters require query methods: ${names.join(", ")}`);
  }
}
function callQuery(value: unknown): CallFilterQuery {
  requireMethods(value, ["eq", "neq", "or"]);
  return value as CallFilterQuery;
}
function ticketQuery(value: unknown): Pick<CallFilterQuery, "eq" | "neq"> {
  requireMethods(value, ["eq", "neq"]);
  return value as Pick<CallFilterQuery, "eq" | "neq">;
}
function usageQuery(value: unknown): Pick<CallFilterQuery, "or"> {
  requireMethods(value, ["or"]);
  return value as Pick<CallFilterQuery, "or">;
}
function sourceQuery(value: unknown): SourceFilterQuery {
  requireMethods(value, ["or", "is"]);
  return value as SourceFilterQuery;
}

/** Filter at the database, before count/range/limit, so tests cannot displace customers. */
export function customerCallFilters<T extends object>(query: T): T {
  const filters = callQuery(query);
  filters.eq("is_test_call", false);
  filters.eq("engineer_test_call", false);
  filters.neq("caller_number", ADMIN_SIM_CALLER_E164);
  filters.or(`room_name.is.null,room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*`);
  return query;
}

export function customerTicketFilters<T extends object>(query: T): T {
  const filters = ticketQuery(query);
  filters.eq("engineer_test_call", false);
  filters.neq("caller_number", ADMIN_SIM_CALLER_E164);
  return query;
}

/** The usage ledger has no engineer flag; preserve normal rows with null metadata. */
export function customerUsageFilters<T extends object>(query: T): T {
  const filters = usageQuery(query);
  filters.or(`sync_skip_reason.is.null,and(${CUSTOMER_USAGE_TEST_REASONS.map((reason) => `sync_skip_reason.neq.${reason}`).join(",")})`);
  filters.or(`caller_number.is.null,caller_number.neq.${ADMIN_SIM_CALLER_E164}`);
  filters.or(`room_name.is.null,and(room_name.not.like.${ADMIN_DEMO_ROOM_PREFIX}*,room_name.not.like.text-rehearsal-*)`);
  filters.or("call_sid.is.null,and(call_sid.not.like.RT-TEST-*,call_sid.not.like.KAV-TEST-*,call_sid.not.like.DEMO-5PART-*)");
  return query;
}

/** Empty embeds filter optional sources without exposing their contents. */
export const CUSTOMER_TRAINING_JOINS =
  "test_call:call_logs(),test_ticket:action_tickets(),test_ticket_call:action_tickets(test_call:call_logs!inner())";

export function customerTrainingFilters<T extends object>(query: T): T {
  const filters = sourceQuery(query);
  filters.or(TEST_CALL_FILTER, { referencedTable: "test_call" });
  filters.or(ENGINEER_TICKET_FILTER, { referencedTable: "test_ticket" });
  filters.or(TEST_CALL_FILTER, { referencedTable: "test_ticket_call.test_call" });
  filters.is("test_call", null);
  filters.is("test_ticket", null);
  filters.is("test_ticket_call", null);
  return query;
}

const TRAINING_SOURCE_JOINS =
  "test_training_call:cara_training_items(test_call:call_logs!inner()),test_training_ticket:cara_training_items(test_ticket:action_tickets!inner()),test_training_ticket_call:cara_training_items(test_ticket:action_tickets!inner(test_call:call_logs!inner()))";
export const CUSTOMER_KNOWLEDGE_EVENT_JOINS = `test_call:call_logs(),${TRAINING_SOURCE_JOINS}`;
export const CUSTOMER_TEMPORAL_JOINS = TRAINING_SOURCE_JOINS;

export function customerTemporalFilters<T extends object>(query: T): T {
  const filters = sourceQuery(query);
  filters.or(TEST_CALL_FILTER, { referencedTable: "test_training_call.test_call" });
  filters.or(ENGINEER_TICKET_FILTER, { referencedTable: "test_training_ticket.test_ticket" });
  filters.or(TEST_CALL_FILTER, { referencedTable: "test_training_ticket_call.test_ticket.test_call" });
  filters.is("test_training_call", null);
  filters.is("test_training_ticket", null);
  filters.is("test_training_ticket_call", null);
  return query;
}

export function customerKnowledgeEventFilters<T extends object>(query: T): T {
  customerTemporalFilters(query);
  const filters = sourceQuery(query);
  filters.or(TEST_CALL_FILTER, { referencedTable: "test_call" });
  filters.is("test_call", null);
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
