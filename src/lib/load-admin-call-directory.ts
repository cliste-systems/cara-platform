import "server-only";
import { requireAdminPermission } from "./admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAdminGlobalMetricRange } from "./admin-metric-range";
import { CALL_ANALYSIS_VERSION } from "./call-analysis-simple";
import { parseAdminCallDirectoryFilters } from "./admin-call-directory-filters";
import type { AnalysisCall } from "@/app/(admin)/admin/call-analysis/load-call-analysis";
export type AdminCallDirectory = {
 total: number; page: number; size: number;
 calls: (AnalysisCall & { kind: string; post_call_status: string | null; processing_issue: boolean })[];
 customers: { id: string; name: string }[];
 counts: Record<"pass" | "fail" | "review" | "outdated" | "pending" | "error" | "queued" | "unreviewed", number>;
};
export async function loadAdminCallDirectory(filters: ReturnType<typeof parseAdminCallDirectoryFilters>): Promise<AdminCallDirectory> {
 await requireAdminPermission("calls");
 const range = filters.date === "today" ? getAdminGlobalMetricRange("day") : null;
 const { data, error } = await createAdminClient().rpc("admin_call_directory", {
  p_start: range?.startIso ?? null, p_end: range?.endExclusiveIso ?? null,
  p_status: filters.status, p_outcome: filters.outcome, p_processing: filters.processing,
  p_query: filters.query, p_customer: filters.customer, p_kind: filters.kind,
  p_page: filters.page, p_size: 10, p_version: CALL_ANALYSIS_VERSION,
 });
 if (error || !data) throw new Error("Call records could not be loaded. Refresh to try again.");
 return data as AdminCallDirectory;
}
