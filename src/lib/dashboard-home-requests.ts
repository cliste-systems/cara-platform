import {
  classifyActionCategory,
  type ActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
import {
  isCallNeedingHomeAttention,
  type HomeAttentionCallRow,
  type HomeAttentionTicketRow,
} from "@/lib/dashboard-home-attention";
import { normalizeCallOutcome } from "@/lib/call-history-types";
import { isPostCallAttentionStatus } from "@/lib/post-call-processing-types";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  departmentTicketHref,
  resolveTicketDepartmentSlug,
} from "@/app/(dashboard)/dashboard/departments/department-helpers";
import { formatActivityFeedBadge } from "@/lib/dashboard-live-activity";
import { classifyActionDepartment } from "@/lib/classify-action-department";
import {
  isRetailDepartmentSlug,
  retailDepartmentBySlug,
  type RetailDepartmentSlug,
} from "@/lib/retail-department-pack";

/** Max characters for home panel list subtitles (Needs attention, Cara training). */
export const HOME_PANEL_LIST_DESCRIPTION_MAX = 48;

export function truncateHomePanelDescription(
  text: string | null | undefined,
  max = HOME_PANEL_LIST_DESCRIPTION_MAX,
): string {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export type HomeRequestTicketRow = {
  id: string;
  summary: string | null;
  created_at: string;
  status: string | null;
  caller_name?: string | null;
  caller_number?: string | null;
  department_slug?: string | null;
  brief_summary?: string | null;
};

export type HomeRequestRow = {
  id: string;
  href: string;
  title: string;
  description: string;
  time: string;
  departmentSlug?: RetailDepartmentSlug;
};

export type HomeTodaysRequestStats = {
  totalToday: number;
  followUpsDue: number;
  awaitingResponse: number;
};

export type HomeAttentionCategoryCounts = {
  pricingQuestions: number;
  callbackRequests: number;
  generalEnquiries: number;
};

const FOLLOW_UP_CATEGORIES: readonly ActionCategory[] = [
  "callback",
  "follow_up",
];

export function homeNeedsActionDepartmentSlug(input: {
  summary: string | null | undefined;
  department_slug?: string | null;
}): RetailDepartmentSlug {
  return resolveTicketDepartmentSlug({
    department_slug: input.department_slug ?? null,
    summary: input.summary ?? "",
  });
}

export function homeNeedsActionRowTitle(input: {
  summary: string | null | undefined;
  department_slug?: string | null;
}): string {
  return retailDepartmentBySlug(homeNeedsActionDepartmentSlug(input)).shortLabel;
}

/** Needs action second line — Complaint, Enquiry, Order, etc. */
export function homeNeedsActionRowSubtitle(input: {
  summary: string | null | undefined;
}): string {
  return formatActivityFeedBadge({ summary: input.summary });
}

export function homeKnowledgeGapDepartmentSlug(input: {
  gap_summary?: string | null;
  knowledge_folder_id?: string | null;
  knowledge_topic_labels?: string[] | null;
}): Exclude<RetailDepartmentSlug, "general"> {
  const folderId = String(input.knowledge_folder_id ?? "").trim();

  if (folderId && isRetailDepartmentSlug(folderId) && folderId !== "general") {
    return folderId;
  }

  const fromSummary = classifyActionDepartment({ summary: input.gap_summary ?? "" });
  if (fromSummary !== "general") {
    return fromSummary;
  }

  return "management";
}

/** Single second-line label for every Needs input row on the home overview. */
export const HOME_NEEDS_INPUT_ROW_SUBTITLE = "Knowledge gap";

export function homeKnowledgeGapRowTitle(input: {
  gap_summary?: string | null;
  knowledge_folder_id?: string | null;
  knowledge_topic_labels?: string[] | null;
}): string {
  return retailDepartmentBySlug(homeKnowledgeGapDepartmentSlug(input)).shortLabel;
}

/** Needs input second line — one term for every row. */
export function homeKnowledgeGapRowSubtitle(): string {
  return HOME_NEEDS_INPUT_ROW_SUBTITLE;
}

export function buildHomeTodaysRequestRows(input: {
  tickets: HomeRequestTicketRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeRequestRow[] {
  const limit = input.limit ?? 5;

  return [...input.tickets]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((ticket) => {
      const departmentSlug = resolveTicketDepartmentSlug({
        department_slug: ticket.department_slug ?? null,
        summary: ticket.summary ?? "",
      });
      return {
        id: ticket.id,
        href: departmentTicketHref(ticket.id, departmentSlug),
        title: homeNeedsActionRowTitle(ticket),
        description: homeNeedsActionRowSubtitle(ticket),
        time: input.formatTime(ticket.created_at),
        departmentSlug,
      };
    });
}

export function buildHomeTodaysRequestStats(input: {
  tickets: HomeRequestTicketRow[];
  callbackCallsToday: number;
}): HomeTodaysRequestStats {
  const openToday = input.tickets.filter(
    (ticket) => (ticket.status ?? "open") === "open",
  );

  const followUpsDue =
    input.tickets.filter((ticket) => {
      const category = classifyActionCategory(ticket.summary);
      return FOLLOW_UP_CATEGORIES.includes(category);
    }).length + input.callbackCallsToday;

  return {
    totalToday: input.tickets.length,
    followUpsDue,
    awaitingResponse: openToday.length,
  };
}

export function buildHomePostCallAttentionRows(input: {
  calls: HomeAttentionCallRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeRequestRow[] {
  const limit = input.limit ?? 5;

  return [...input.calls]
    .filter((call) => isPostCallAttentionStatus(call.post_call_status))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((call) => ({
      id: `post-call-${call.id}`,
      href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(call.id)}`,
      title: "Management",
      description: "Review",
      time: input.formatTime(call.created_at),
      departmentSlug: "management" as const,
    }));
}

export function mergeHomeNeedsAttentionRows(input: {
  tickets: HomeRequestTicketRow[];
  calls: HomeAttentionCallRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeRequestRow[] {
  const limit = input.limit ?? 5;
  const ticketRows = buildHomeTodaysRequestRows({
    tickets: input.tickets,
    formatTime: input.formatTime,
    limit,
  });
  const callRows = buildHomePostCallAttentionRows({
    calls: input.calls,
    formatTime: input.formatTime,
    limit,
  });

  return [...ticketRows, ...callRows]
    .sort((a, b) => {
      const ta = Date.parse(a.time);
      const tb = Date.parse(b.time);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
      return 0;
    })
    .slice(0, limit);
}

export function buildHomeAttentionCategoryCounts(input: {
  openTickets: HomeAttentionTicketRow[];
  calls: HomeAttentionCallRow[];
}): HomeAttentionCategoryCounts {
  let pricingQuestions = 0;
  let callbackRequests = 0;
  let generalEnquiries = 0;

  for (const ticket of input.openTickets) {
    const category = classifyActionCategory(ticket.summary);
    if (category === "quote") pricingQuestions += 1;
    else if (category === "callback") callbackRequests += 1;
    else generalEnquiries += 1;
  }

  for (const call of input.calls) {
    const outcome = normalizeCallOutcome(String(call.outcome ?? ""));
    if (isPostCallAttentionStatus(call.post_call_status)) generalEnquiries += 1;
    else if (outcome === "callback_requested") callbackRequests += 1;
    else if (isCallNeedingHomeAttention(call.outcome, call.post_call_status)) {
      generalEnquiries += 1;
    }
  }

  return {
    pricingQuestions,
    callbackRequests,
    generalEnquiries,
  };
}

export type HomeCaraTrainingItemRow = {
  id: string;
  gap_summary: string | null;
  status: string | null;
  updated_at: string;
  knowledge_folder_id?: string | null;
  knowledge_topic_labels?: string[] | null;
};

export type HomeCaraTrainingRow = {
  id: string;
  href: string;
  title: string;
  description: string;
  time: string;
  departmentSlug?: RetailDepartmentSlug;
};

export function buildHomeCaraTrainingRows(input: {
  items: HomeCaraTrainingItemRow[];
  isRetail?: boolean;
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeCaraTrainingRow[] {
  const limit = input.limit ?? 5;

  return [...input.items]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      href: DASHBOARD_ROUTES.caraKnowledgeNeedsInputItem(item.id),
      title: input.isRetail === false ? item.gap_summary?.trim() || "Question needs an answer" : homeKnowledgeGapRowTitle(item),
      description: homeKnowledgeGapRowSubtitle(),
      time: input.formatTime(item.updated_at),
      departmentSlug: input.isRetail === false ? undefined : homeKnowledgeGapDepartmentSlug(item),
    }));
}
