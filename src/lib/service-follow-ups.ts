import { customerCallFilters } from "./dashboard-customer-data";

/** Requests produced by live call processing, including urgent enquiries. */
export const SERVICE_FOLLOW_UP_FILTER =
  "call_resolution.eq.needs_follow_up,outcome.in.(action_created,callback_requested),is_urgent.eq.true,post_call_expected_ticket.eq.true";
export const SERVICE_FOLLOW_UP_COLUMNS =
  "id,caller_number,caller_name,ai_summary,created_at,follow_up_completed_at,is_urgent";
export type ServiceFollowUpRow = {
  id: string;
  caller_number: string;
  caller_name: string | null;
  ai_summary: string | null;
  created_at: string;
  follow_up_completed_at: string | null;
  is_urgent: boolean;
};
export function serviceFollowUpFilters<T extends object>(
  query: T,
  status?: "open" | "resolved",
  knowledgeCallIds: string[] = [],
): T {
  customerCallFilters(query);
  const q = query as unknown as {
    or: (filter: string) => unknown;
    is: (column: string, value: null) => unknown;
    not: (column: string, operator: string, value: null) => unknown;
    neq: (column: string, value: string) => unknown;
  };
  const safeIds = knowledgeCallIds.filter(id => /^[0-9a-f-]{36}$/i.test(id));
  q.or(safeIds.length ? `${SERVICE_FOLLOW_UP_FILTER},id.in.(${safeIds.join(",")})` : SERVICE_FOLLOW_UP_FILTER);
  q.is("caller_data_erased_at", null);
  q.neq("post_call_status", "pending");
  if (status === "open") q.is("follow_up_completed_at", null);
  if (status === "resolved") q.not("follow_up_completed_at", "is", null);
  return query;
}
