import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { StatusPill } from "@/components/dashboard/status-pill";
import { ACTION_INBOX_TICKET_LIMIT } from "@/lib/dashboard-list-limits";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { customerTicketFilters } from "@/lib/dashboard-customer-data";

import { buildDepartmentOverviewMetrics } from "./department-helpers";
import type { DepartmentTicketRow } from "./department-helpers";

export default async function DepartmentsOverviewPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data, error } = await customerTicketFilters(supabase
    .from("action_tickets")
    .select(
      "id, caller_number, caller_name, summary, brief_summary, department_slug, status, created_at, engineer_test_call",
    ))
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(ACTION_INBOX_TICKET_LIMIT);

  const metrics = buildDepartmentOverviewMetrics((data ?? []) as DepartmentTicketRow[]);

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections>
          <ClistePageHeader
            tone="inbox"
            icon={LayoutGrid}
            title="Departments"
            description="Open follow-ups by shop department — meat counter, deli, bakery, and the rest."
            summary={[
              { value: String(metrics.totalOpen), label: "open" },
              { value: String(metrics.totalUrgent), label: "urgent" },
              { value: String(metrics.departments.filter((d) => d.openCount > 0).length), label: "with work" },
            ]}
          />
          {error ? (
            <p className="shrink-0 text-[13px] text-red-700">Could not load departments: {error.message}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.departments.map((dept) => (
                <Link key={dept.slug} href={dept.href}
                  className={`${DASHBOARD_CARD_SURFACE} group flex flex-col gap-3 p-4 transition hover:border-[#9da9a4] hover:bg-white`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[15px] font-semibold text-[#11181d] group-hover:text-[#0b1220]">{dept.label}</h2>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {dept.openCount === 0 ? "Nothing open" : `${dept.openCount} open follow-up${dept.openCount === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    {dept.openCount > 0 ? <StatusPill variant="brand" dot>{dept.openCount}</StatusPill> : null}
                  </div>
                  {dept.urgentCount > 0 ? <StatusPill variant="attention" className="w-fit">{dept.urgentCount} urgent</StatusPill> : null}
                  <span className="text-[12px] font-medium text-[#353D42]">Open workspace →</span>
                </Link>
              ))}
            </div>
          )}
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
