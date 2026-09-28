import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Search } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { adminSecondaryButtonClass, adminTextLinkClass } from "@/components/admin/admin-interactive";
import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { adminTableBodyClass, adminTableClass, adminTableEmptyClass, adminTableHeadClass, adminTableRowClass, adminTableTdClass, adminTableTdDateClass, adminTableThClass } from "@/components/admin/admin-table";
import { requireAdminMfaSessionUser } from "@/lib/admin-session";
import { adminCallAnalysisPath } from "@/lib/admin-route-paths";
import { formatDurationLabel, formatE164ForDisplay } from "@/lib/call-history-types";
import { PRODUCT_NAME } from "@/lib/company-details";
import { AnalysisRefresh } from "./analysis-controls";
import { ANALYSIS_STATUS_LABELS, AnalysisStatusBadge, analysisDisplayStatus } from "./analysis-status";
import { CALL_ANALYSIS_LIST_LIMIT, loadCallAnalysisList } from "./load-call-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata: Metadata = { title: `${PRODUCT_NAME} Admin — Call Analysis` };

export default async function CallAnalysisPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; customer?: string }> }) {
  await requireAdminMfaSessionUser();
  const filters = await searchParams;
  const query = typeof filters.q === "string" ? filters.q.trim().slice(0, 200) : "";
  const status = typeof filters.status === "string" && filters.status in ANALYSIS_STATUS_LABELS ? filters.status : "all";
  const customer = typeof filters.customer === "string" ? filters.customer : "";
  let calls: Awaited<ReturnType<typeof loadCallAnalysisList>> = [];
  let loadError: string | null = null;
  try { calls = await loadCallAnalysisList(); } catch { loadError = "Call analyses could not be loaded. Please refresh to try again."; }
  const customers = [...new Map(calls.map((call) => [call.organization_id, call.organization_name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = calls.filter((call) => {
    if (status !== "all" && analysisDisplayStatus(call.analysis) !== status) return false;
    if (customer && call.organization_id !== customer) return false;
    if (!query) return true;
    return [call.organization_name, call.caller_name, call.caller_number, call.analysis?.result?.summary, call.id].join(" ").toLowerCase().includes(query.toLowerCase());
  });
  const counts = calls.reduce((acc, call) => { acc[analysisDisplayStatus(call.analysis)] += 1; return acc; }, { pass: 0, fail: 0, review: 0, outdated: 0, pending: 0, error: 0, queued: 0, unreviewed: 0 });
  return <AdminPageShell icon={ClipboardCheck} title="Call analysis" description="Conversation outcomes and technical health, call by call." actions={<AnalysisRefresh active />}>
    {loadError ? <AdminErrorCard message={loadError} /> : <>
    <AdminStatsGrid><AdminStatCard label="Calls" value={calls.length} /><AdminStatCard label="Passed" value={counts.pass} tone="success" /><AdminStatCard label="Failed" value={counts.fail} tone="danger" /><AdminStatCard label="Needs review" value={counts.review} tone="warning" /><AdminStatCard label="Not yet analysed" value={counts.pending + counts.queued + counts.unreviewed + counts.outdated} /><AdminStatCard label="Analysis errors" value={counts.error} tone={counts.error ? "danger" : "neutral"} /></AdminStatsGrid>
    <AdminListCard
      countLabel={`${rows.length} of ${calls.length} recent calls`}
      toolbar={<form action={adminCallAnalysisPath()} method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative"><label htmlFor="analysis-search" className="sr-only">Search calls</label><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-gray-400" aria-hidden /><input id="analysis-search" name="q" defaultValue={query} placeholder="Search caller or summary" className="h-9 w-52 rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400" /></div>
        <label htmlFor="analysis-customer" className="sr-only">Customer</label><select id="analysis-customer" name="customer" defaultValue={customer} className="h-9 max-w-48 rounded-md border border-gray-200 bg-white px-2 text-sm"><option value="">All customers</option>{customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <label htmlFor="analysis-status" className="sr-only">Analysis result</label><select id="analysis-status" name="status" defaultValue={status} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"><option value="all">All results</option>{Object.entries(ANALYSIS_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className={adminSecondaryButtonClass} type="submit">Filter</button>
        {query || status !== "all" || customer ? <Link href={adminCallAnalysisPath()} className={`${adminTextLinkClass} text-xs text-gray-500`}>Clear</Link> : null}
      </form>}

      banner={<p className="text-xs text-[#6b7c75]">Latest {CALL_ANALYSIS_LIST_LIMIT} eligible calls · 30-day review window</p>}
    >
      <table className={adminTableClass}><thead className={adminTableHeadClass}><tr><th className={adminTableThClass}>Call</th><th className={adminTableThClass}>Customer</th><th className={adminTableThClass}>Result</th><th className={adminTableThClass}>Issues</th><th className={adminTableThClass}>Call summary</th><th className={adminTableThClass}>Duration</th><th className={`${adminTableThClass} text-right`}>Review</th></tr></thead>
        <tbody className={adminTableBodyClass}>{rows.length ? rows.map((call) => {
          const result = call.analysis?.result;
          return <tr key={call.id} className={adminTableRowClass}>
            <td className={adminTableTdClass}><Link href={adminCallAnalysisPath(call.id)} className={`${adminTextLinkClass} text-gray-900`}>{call.caller_name || formatE164ForDisplay(call.caller_number) || "Unknown caller"}</Link><span className="mt-1 block whitespace-nowrap text-xs text-gray-500">{new Date(call.created_at).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" })}</span></td>
            <td className={adminTableTdClass}><span className="text-gray-700">{call.organization_name}</span>{call.is_test_call ? <span className="mt-1 block"><AdminBadge>Test call</AdminBadge></span> : null}</td>
            <td className={adminTableTdClass}><AnalysisStatusBadge analysis={call.analysis} /></td>
            <td className={`${adminTableTdClass} whitespace-nowrap text-xs text-gray-500`}>{result && call.analysis?.status === "completed" ? <><span className={result.failedCount ? "font-medium text-red-700" : ""}>{result.failedCount} problems</span><span className="mt-1 block">{result.unverifiedCount} unable to verify</span></> : "—"}</td>
            <td className={`${adminTableTdClass} max-w-md`}><p className="line-clamp-2 text-sm text-gray-600">{analysisDisplayStatus(call.analysis) === "outdated" ? "Older review. Open this call to update it to the new questions." : call.analysis?.status === "completed" ? result?.summary || "Open the call for details." : call.analysis?.status === "error" ? call.analysis.next_attempt_at ? "Analysis will retry automatically." : call.analysis.error_message || "Analysis could not finish. Open the call for details." : call.analysis?.status === "running" ? "Automatic post-call review is in progress." : call.analysis ? "Automatic review pending. Results appear here when ready." : "No automatic review was scheduled for this call."}</p></td>
            <td className={adminTableTdDateClass}>{formatDurationLabel(call.duration_seconds)}</td>
            <td className={`${adminTableTdClass} text-right`}><Link href={adminCallAnalysisPath(call.id)} className={adminSecondaryButtonClass}>View</Link></td>
          </tr>;
        }) : <tr><td colSpan={7} className={adminTableEmptyClass}>{calls.length ? "No calls match these filters." : "No saved calls to analyse yet."}</td></tr>}</tbody>
      </table>
    </AdminListCard></>}
  </AdminPageShell>;
}
