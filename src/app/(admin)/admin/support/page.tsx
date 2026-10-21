import { hasAdminPermission } from "@/lib/admin-permissions";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPermission, requireAdminStaffContext } from "@/lib/admin-session";
import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import {
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { adminSupportTicketPath } from "@/lib/admin-route-paths";
import { getAdminGlobalMetricRange } from "@/lib/admin-metric-range";
import { PRODUCT_NAME } from "@/lib/company-details";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableTdTruncateClass,
  adminTableThActionsClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
import { createAdminClient } from "@/utils/supabase/admin";

import { CloseSupportButton } from "./close-support-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Support tickets`,
};

type OrgJoin = { name: string; slug: string };

type SupportTicketAdminRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  organization_id: string;
  organizations: OrgJoin | OrgJoin[] | null;
};

function orgLabel(row: SupportTicketAdminRow): string {
  const o = row.organizations;
  if (!o) return "—";
  const one = Array.isArray(o) ? o[0] : o;
  return one?.name?.trim() || "—";
}

function orgSlug(row: SupportTicketAdminRow): string | null {
  const o = row.organizations;
  if (!o) return null;
  const one = Array.isArray(o) ? o[0] : o;
  const s = one?.slug?.trim();
  return s || null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function messagePreview(body: string, maxLen = 120): string {
  const t = body.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; date?: string; page?: string }> }) {
  const params = await searchParams;
  const query = (params.q || "").trim().slice(0, 200);
  const status = ["open", "closed"].includes(params.status || "") ? params.status! : "all";
  const date = params.date === "today" ? "today" : "all";
  const range = getAdminGlobalMetricRange("day");
  const requestedPage = Number(params.page || 0);
  let page = Number.isFinite(requestedPage) ? Math.max(0, Math.min(1000000, Math.floor(requestedPage))) : 0;
  const size = 8;
  let total = 0;
  await requireAdminPermission("support");
  const staff = await requireAdminStaffContext();
  let tickets: SupportTicketAdminRow[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();
    const request = () => { let builder = admin
      .from("support_tickets")
      .select(
        "id, subject, body, status, created_at, organization_id, organizations ( name, slug )",
        { count: "exact" },
      )
      .order("created_at", { ascending: false }).order("id")
      .range(page * size, (page + 1) * size - 1);
    if (status !== "all") builder = builder.eq("status", status);
    if (date === "today") builder = builder.gte("created_at", range.startIso).lt("created_at", range.endExclusiveIso);
    if (query) builder = builder.ilike("subject", `%${query.replace(/[%_]/g, "\\$&")}%`);
    return builder; };
    let result = await request();
    total = result.count || 0;
    const last = Math.max(0, Math.ceil(total / size) - 1);
    if (page > last) { page = last; result = await request(); }
    const { data, error } = result;

    if (error) throw new Error(error.message);
    tickets = (data ?? []) as SupportTicketAdminRow[];
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load support tickets.";
  }

  const countLabel = `${total} ${status === "all" ? "" : `${status} `}tickets`;

  return (
    <AdminPageShell
      icon={LifeBuoy}
      title="Support"
      description="Customer requests, conversations and resolutions."
      actions={hasAdminPermission(staff, "inbox") ? <Link href="/admin/inbox" className={adminSecondaryButtonClass}>Email inbox</Link> : undefined}
    >
      {loadError ? (
        <AdminErrorCard
          message={loadError}

        />
      ) : (
        <AdminListCard countLabel={countLabel} toolbar={<form action="/admin/support" method="get" className="flex flex-wrap items-center gap-2"><input name="q" defaultValue={query} placeholder="Search subject" aria-label="Search ticket subjects" className="h-9 w-60 rounded-md border border-[#e0e3e6] px-3 text-sm" /><select name="status" defaultValue={status} aria-label="Ticket status" className="h-9 rounded-md border border-[#e0e3e6] px-3 text-sm"><option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option></select><select name="date" defaultValue={date} aria-label="Ticket date" className="h-9 rounded-md border border-[#e0e3e6] px-3 text-sm"><option value="all">All dates</option><option value="today">Today · Dublin</option></select><button type="submit" className={adminSecondaryButtonClass}>Apply</button></form>}>
          <div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1 overflow-auto">
          <table className={adminTableClass}>
            <thead className={adminTableHeadClass}>
              <tr>
                <th className={adminTableThClass}>Client</th>
                <th className={adminTableThClass}>Subject</th>
                <th className={adminTableThClass}>Message</th>
                <th className={adminTableThClass}>Status</th>
                <th className={adminTableThClass}>Submitted</th>
                <th className={adminTableThActionsClass}>Actions</th>
              </tr>
            </thead>
            <tbody className={adminTableBodyClass}>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className={adminTableEmptyClass}>
                    No support tickets yet.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className={adminTableRowClass}>
                    <td className={adminTableTdClass}>
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {orgLabel(t)}
                        </span>
                        {orgSlug(t) ? (
                          <span className="mt-0.5 block font-mono text-xs text-gray-400">
                            {orgSlug(t)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`text-sm text-gray-600 ${adminTableTdClass}`}>
                      {t.subject}
                    </td>
                    <td
                      className={`text-sm text-gray-600 ${adminTableTdTruncateClass}`}
                      title={t.body}
                    >
                      {messagePreview(t.body)}
                    </td>
                    <td className={adminTableTdClass}>
                      <AdminBadge className="capitalize">{t.status}</AdminBadge>
                    </td>
                    <td
                      className={`whitespace-nowrap text-sm text-gray-500 tabular-nums ${adminTableTdClass}`}
                    >
                      {formatWhen(t.created_at)}
                    </td>
                    <td className={`text-right ${adminTableTdClass}`}>
                      <div className="flex flex-col items-end gap-1.5">
                        <Link
                          href={adminSupportTicketPath(t.id)}
                          className={`${adminSecondaryButtonClass} justify-center px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200`}
                        >
                          View
                        </Link>
                        {t.status === "open" ? (
                          <CloseSupportButton ticketId={t.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div><AdminPagination path="/admin/support" filters={{q:query,status,date}} page={page} size={size} total={total} /></div>
        </AdminListCard>
      )}
    </AdminPageShell>
  );
}
