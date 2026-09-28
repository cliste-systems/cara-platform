import { formatE164ForDisplay } from "@/lib/call-history-types";
import { resolveCallerDisplayName } from "@/lib/caller-identity";
import {
  CALLER_DATA_ERASED_LABEL,
  isErasedCallerNumber,
} from "@/lib/caller-data-erasure";
import { classifyActionDepartment } from "@/lib/classify-action-department";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { isEngineerTestCallRow } from "@/lib/engineer-test-call";
import {
  isRetailDepartmentSlug,
  retailDepartmentBySlug,
  retailDepartmentLabel,
  departmentWorkspaceSlug,
  RETAIL_DEPARTMENTS,
  type RetailDepartmentSlug,
} from "@/lib/retail-department-pack";

import {
  ACTION_CATEGORY_SHORT,
  classifyActionCategory,
  type ActionCategory,
} from "../action-inbox/categories";
import {
  formatActionDateTimeLabel,
  isUnderReviewTicket,
  resolveContactEmail,
  sortActionInboxItems,
  type ActionInboxItem,
  type ActionInboxMetrics,
} from "../action-inbox/action-inbox-helpers";
import type { ActionTicketDeliveryStatus } from "@/lib/post-call-processing-types";
import type { TicketCallLink } from "@/lib/resolve-ticket-call-log";

export type DepartmentTicketRow = {
  id: string;
  call_log_id?: string | null;
  caller_number: string;
  caller_name: string | null;
  summary: string;
  brief_summary: string | null;
  department_slug: string | null;
  status: string;
  created_at: string;
  delivery_status?: string | null;
  engineer_test_call?: boolean | null;
};

export type DepartmentOverviewCard = {
  slug: RetailDepartmentSlug;
  label: string;
  shortLabel: string;
  href: string;
  openCount: number;
  urgentCount: number;
};

export type DepartmentOverviewMetrics = {
  totalOpen: number;
  totalUrgent: number;
  departments: DepartmentOverviewCard[];
};

export function resolveTicketDepartmentSlug(
  row: Pick<DepartmentTicketRow, "department_slug" | "summary">,
): RetailDepartmentSlug {
  const stored = String(row.department_slug ?? "").trim();
  if (stored && isRetailDepartmentSlug(stored) && stored !== "general") return stored;
  return classifyActionDepartment({ summary: row.summary ?? "" });
}

/** Workspace route slug — unassigned tickets land in Management, not a 404. */
export { departmentWorkspaceSlug } from "@/lib/retail-department-pack";

export function departmentTicketMatchesWorkspace(
  itemDepartmentSlug: RetailDepartmentSlug,
  workspaceSlug: RetailDepartmentSlug,
): boolean {
  if (itemDepartmentSlug === workspaceSlug) return true;
  if (workspaceSlug === "management" && itemDepartmentSlug === "general") return true;
  return false;
}

export function departmentTicketHref(ticketId: string, departmentSlug: RetailDepartmentSlug): string {
  const workspace = departmentWorkspaceSlug(departmentSlug);
  return `${DASHBOARD_ROUTES.department(workspace)}?ticket=${encodeURIComponent(ticketId)}`;
}

export function toDepartmentInboxItem(
  row: DepartmentTicketRow,
  callerNameByPhone: Map<string, string | null>,
  clientsByPhone: Map<string, { name: string; email: string | null }>,
  categoryLabels: Record<ActionCategory, string>,
  callLink?: TicketCallLink | null,
): ActionInboxItem {
  const departmentSlug = resolveTicketDepartmentSlug(row);
  const category = classifyActionCategory(row.summary);
  const deliveryStatus = (row.delivery_status as ActionTicketDeliveryStatus) ?? "confirmed";
  const callerNumber = row.caller_number?.trim() ?? "";
  const callerDisplay = isErasedCallerNumber(callerNumber) ? CALLER_DATA_ERASED_LABEL : formatE164ForDisplay(callerNumber) || "";
  const key = phoneKey(callerNumber);
  const client = key ? clientsByPhone.get(key) : undefined;
  const callLogName = key ? (callerNameByPhone.get(key) ?? null) : null;
  const callerName = isErasedCallerNumber(callerNumber)
    ? CALLER_DATA_ERASED_LABEL
    : resolveCallerDisplayName([row.caller_name, client?.name, callLogName], callerDisplay);

  return {
    id: row.id,
    callLogId: callLink?.callLogId ?? (row.call_log_id ? String(row.call_log_id) : null),
    callLogCreatedAt: callLink?.callCreatedAt ?? (callLink?.callLogId || row.call_log_id ? row.created_at : null),
    callerNumber,
    callerDisplay,
    callerName,
    contactLabel: callerName,
    contactEmail: resolveContactEmail(client?.email, row.summary),
    summary: row.summary ?? "",
    briefSummary: row.brief_summary?.trim() || undefined,
    status: row.status === "resolved" ? "resolved" : "open",
    createdAt: row.created_at,
    createdAtLabel: formatActionDateTimeLabel(row.created_at),
    category,
    categoryTitle: categoryLabels[category],
    categoryShort: ACTION_CATEGORY_SHORT[category],
    departmentSlug,
    departmentLabel: retailDepartmentLabel(departmentSlug),
    deliveryStatus,
    underReview: isUnderReviewTicket({ underReview: false, deliveryStatus }),
    engineerTestCall: isEngineerTestCallRow(row),
  };
}

function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

export function buildDepartmentOverviewMetrics(rows: DepartmentTicketRow[]): DepartmentOverviewMetrics {
  const openRows = rows.filter((row) => row.status === "open" && !isEngineerTestCallRow(row));
  const counts = new Map<RetailDepartmentSlug, { open: number; urgent: number }>();
  for (const dept of RETAIL_DEPARTMENTS) counts.set(dept.slug, { open: 0, urgent: 0 });
  let totalOpen = 0;
  let totalUrgent = 0;
  for (const row of openRows) {
    const slug = departmentWorkspaceSlug(resolveTicketDepartmentSlug(row));
    const bucket = counts.get(slug) ?? { open: 0, urgent: 0 };
    bucket.open += 1;
    totalOpen += 1;
    if (classifyActionCategory(row.summary) === "urgent") { bucket.urgent += 1; totalUrgent += 1; }
    counts.set(slug, bucket);
  }
  const departments = RETAIL_DEPARTMENTS.filter((dept) => dept.slug !== "general").map((dept) => {
    const bucket = counts.get(dept.slug) ?? { open: 0, urgent: 0 };
    return {
      slug: dept.slug,
      label: dept.label,
      shortLabel: dept.shortLabel,
      href: DASHBOARD_ROUTES.department(dept.slug),
      openCount: bucket.open,
      urgentCount: bucket.urgent,
    };
  });
  return { totalOpen, totalUrgent, departments };
}

export function buildDepartmentInboxMetrics(items: ActionInboxItem[]): ActionInboxMetrics {
  let openCount = 0;
  let urgentCount = 0;
  let callbackCount = 0;
  let resolvedCount = 0;
  for (const item of items) {
    if (isEngineerTestCallRow({ engineer_test_call: item.engineerTestCall, caller_number: item.callerNumber })) continue;
    if (item.status === "resolved") { resolvedCount += 1; continue; }
    openCount += 1;
    if (item.category === "urgent") urgentCount += 1;
    if (item.category === "callback") callbackCount += 1;
  }
  return { openCount, urgentCount, callbackCount, resolvedCount };
}

export function sortDepartmentInboxItems(items: ActionInboxItem[]): ActionInboxItem[] {
  return sortActionInboxItems(items);
}

export function departmentPageTitle(slug: string): string {
  return retailDepartmentBySlug(slug).label;
}
