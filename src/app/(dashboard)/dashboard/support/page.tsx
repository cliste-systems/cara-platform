import { FormFeedback } from "@/components/ui/form-feedback";
import { DASHBOARD_HOME_CONTENT_COLUMN, DASHBOARD_PAGE_SHELL_FILL_WHITE } from "@/components/dashboard/dashboard-surface";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { cn } from "@/lib/utils";

import { SupportView } from "./support-view";
import type { SupportTicketRow } from "./support-helpers";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: rows, error } = await supabase
    .from("support_tickets")
    .select(
      `id, subject, body, status, created_at,
       support_ticket_messages ( id, author_kind, body, created_at )`,
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const tickets: SupportTicketRow[] =
    !error && rows
      ? (rows as SupportTicketRow[]).map((row) => ({
          ...row,
          support_ticket_messages: [...(row.support_ticket_messages ?? [])].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          ),
        }))
      : [];

  return (
    <div
      className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "overflow-hidden")}
      data-dashboard-fill
    >
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
      {error ? (
        <FormFeedback title="Help requests couldn’t load" message="Please refresh to try again. Your existing requests haven’t changed." />
      ) : (
        <SupportView className="min-h-0 flex-1" initialTickets={tickets} />
      )}
      </div>
    </div>
  );
}
