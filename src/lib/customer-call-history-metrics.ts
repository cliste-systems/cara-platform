import {
  resolveLiveCallHistoryMetrics,
  type CallHistoryMetrics,
} from "@/app/(dashboard)/dashboard/call-history/call-history-helpers";
import { isCustomerCallListItem } from "@/lib/dashboard-customer-data";

/** Informational engineer rows never participate in client-side metric refreshes. */
export function resolveCustomerCallHistoryMetrics(
  input: Parameters<typeof resolveLiveCallHistoryMetrics>[0],
): CallHistoryMetrics {
  return resolveLiveCallHistoryMetrics({
    ...input,
    calls: input.calls.filter(isCustomerCallListItem),
  });
}
