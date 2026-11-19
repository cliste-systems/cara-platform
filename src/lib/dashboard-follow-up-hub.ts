import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { VerticalId } from "@/lib/verticals";

export function dashboardFollowUpHubHref(_verticalId: VerticalId): string {
  return _verticalId === "retail" ? DASHBOARD_ROUTES.calls : `${DASHBOARD_ROUTES.calls}?filter=follow_up`;
}

export function dashboardFollowUpHubLabel(_verticalId: VerticalId): string {
  return "Open Calls";
}

export function dashboardFollowUpTicketHref(_input: {
  verticalId: VerticalId;
  ticketId: string;
  departmentSlug?: string | null;
  summary?: string | null;
}): string {
  return _input.verticalId === "retail" ? DASHBOARD_ROUTES.calls : `${DASHBOARD_ROUTES.calls}?filter=follow_up&followUp=${encodeURIComponent(_input.ticketId)}`;
}
