import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin-session";
import { ClipboardCheck } from "lucide-react";
import { AdminPageShell, AdminErrorCard } from "@/components/admin/admin-page-shell";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { adminSecondaryButtonClass } from "@/components/admin/admin-interactive";
import { adminTableClass, adminTableHeadClass, adminTableThClass, adminTableTdClass, adminTableBodyClass, adminTableEmptyClass, adminTableRowClass } from "@/components/admin/admin-table";
import { normalizeCallOutcome, formatDurationLabel, formatE164ForDisplay } from "@/lib/call-history-types";
import { parseAdminCallDirectoryFilters } from "@/lib/admin-call-directory-filters";
import { loadAdminCallDirectory } from "@/lib/load-admin-call-directory";
import { DeleteCallButton } from "./delete-call-button";
import { AnalysisRefresh } from "./analysis-controls";
import { AnalysisStatusBadge, ANALYSIS_STATUS_LABELS } from "./analysis-status";
export const dynamic = "force-dynamic";
export const metadata = { title: "Calls — HelloCara Admin" };
export default async function CallAnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
 await requireAdminPermission("calls");
 const filters = parseAdminCallDirectoryFilters(await searchParams);
 let data: Awaited<ReturnType<typeof loadAdminCallDirectory>> | null = null;
 let error: string | null = null;
 try { data = await loadAdminCallDirectory(filters); } catch (cause) { error = cause instanceof Error ? cause.message : "Calls unavailable."; }
 const counts = data?.counts;
 const control = "h-10 w-full min-w-0 rounded-md border border-[#e0e3e6] bg-white px-2.5 text-[13px]";
 const paginationFilters = {q: filters.query, status: filters.status, customer: filters.customer, date: filters.date, kind: filters.kind, outcome: filters.outcome, processing: filters.processing ? "issues" : "all"};
 return <AdminPageShell icon={ClipboardCheck} title="Calls" description={`${filters.date === "today" ? "Today in Ireland" : "Retained calls from the last 30 days"} · Outcomes, reviews and processing status.`} actions={<AnalysisRefresh active />}>
  {error ? <AdminErrorCard message={error} /> : data && <>
   <details className="shrink-0 rounded-lg border border-slate-200 px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Review breakdown · {data.total} matching calls</summary><AdminStatsGrid className="mt-4"><AdminStatCard label="Matching calls" value={data.total} /><AdminStatCard label="Passed reviews" value={counts?.pass} /><AdminStatCard label="Failed reviews" value={counts?.fail} tone={counts?.fail ? "danger" : "neutral"} /><AdminStatCard label="Needs review" value={counts?.review} /><AdminStatCard label="Pending / needs update" value={(counts?.pending || 0)+(counts?.queued || 0)+(counts?.unreviewed || 0)+(counts?.outdated || 0)} /><AdminStatCard label="Analysis errors" value={counts?.error} tone={counts?.error ? "danger" : "neutral"} /></AdminStatsGrid></details>
   <details className="shrink-0 rounded-lg border border-slate-200 px-4 py-3" open={Boolean(filters.query || filters.status!=="all" || filters.customer || filters.date==="today" || filters.kind!=="all" || filters.outcome!=="all" || filters.processing)}><summary className="cursor-pointer text-sm font-medium">Filter calls</summary><form action="/admin/call-analysis" method="get" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <input name="q" defaultValue={filters.query} placeholder="Search caller or customer" aria-label="Search calls" className={`${control}`} />
    <select name="date" defaultValue={filters.date} aria-label="Call date" className={control}><option value="all">Last 30 days</option><option value="today">Today</option></select>
    <select name="kind" defaultValue={filters.kind} aria-label="Call type" className={control}><option value="all">All call types</option><option value="customer">Customer</option><option value="demo">Demo</option><option value="engineer">Engineer test</option><option value="verification">Verification</option></select>
    <select name="customer" defaultValue={filters.customer} aria-label="Customer" className={control}><option value="">All customers</option>{data.customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
    <select name="status" defaultValue={filters.status} aria-label="Review result" className={control}><option value="all">All reviews</option><option value="backlog">Queued / analysing</option>{Object.entries(ANALYSIS_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <select name="outcome" defaultValue={filters.outcome} aria-label="Call outcome" className={control}><option value="all">All outcomes</option><option value="failed">Failed calls</option></select>
    <select name="processing" defaultValue={filters.processing ? "issues" : "all"} aria-label="Post-call processing" className={control}><option value="all">All processing</option><option value="issues">Processing issues</option></select>
    <button type="submit" className={adminSecondaryButtonClass}>Apply</button><Link href="/admin/call-analysis" className="px-2 text-xs text-[#697078] hover:underline">Clear</Link>
   </form></details>
   <AdminListCard fillRemaining={false} countLabel={`${data.total} matching calls`}>
    <div className="flex min-h-0 flex-col"><div className="divide-y divide-slate-200 md:hidden">{data.calls.map(call=><div key={call.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/admin/call-analysis/${call.id}`} className="text-sm font-semibold hover:underline">{call.caller_name || formatE164ForDisplay(call.caller_number) || "Unknown caller"}</Link><p className="mt-1 text-xs text-slate-500">{call.organization_name}</p></div><AnalysisStatusBadge analysis={call.analysis} /></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span>{normalizeCallOutcome(call.outcome).replaceAll("_"," ")}</span><span>{formatDurationLabel(call.duration_seconds)}</span><span>{new Date(call.created_at).toLocaleString("en-IE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Dublin"})}</span></div>{call.processing_issue && <p className="mt-2 text-xs text-amber-800">Post-call processing needs attention</p>}<Link href={`/admin/call-analysis/${call.id}`} className="mt-4 inline-flex text-sm font-medium underline underline-offset-4">Review call →</Link></div>)}{!data.calls.length && <p className="p-8 text-center text-sm text-slate-500">No calls match these filters.</p>}</div><div className="hidden overflow-x-auto md:block"><table className={adminTableClass}><thead className={adminTableHeadClass}><tr>{["Call / customer", "Type", "Call outcome", "Review", "Issues", "Duration", "Actions"].map(label => <th key={label} className={adminTableThClass}>{label}</th>)}</tr></thead><tbody className={adminTableBodyClass}>
     {data.calls.length ? data.calls.map(call => <tr key={call.id} className={adminTableRowClass}>
      <td className={adminTableTdClass}><Link href={`/admin/call-analysis/${call.id}`} className="font-medium hover:underline">{call.caller_name || formatE164ForDisplay(call.caller_number) || "Unknown caller"}</Link><p className="mt-1 text-[11px] leading-4 text-[#697078]">{call.organization_name} · <time>{new Date(call.created_at).toLocaleString("en-IE", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Dublin"})}</time></p></td>
      <td className={`${adminTableTdClass} text-xs capitalize`}>{call.kind === "engineer" ? "Engineer test" : call.kind}</td>
      <td className={`${adminTableTdClass} text-xs`}><span className={normalizeCallOutcome(call.outcome) === "failed" ? "font-medium text-red-700" : ""}>{normalizeCallOutcome(call.outcome).replaceAll("_", " ")}</span>{call.processing_issue && <p className="mt-1 text-amber-700">Processing {call.post_call_status === "pending" ? "overdue" : call.post_call_status}</p>}</td>
      <td className={adminTableTdClass}><AnalysisStatusBadge analysis={call.analysis} /></td>
      <td className={`${adminTableTdClass} text-xs text-[#697078]`}>{call.analysis?.result ? <>{call.analysis.result.failedCount} problems<p className="mt-1">{call.analysis.result.unverifiedCount} unverified</p></> : "—"}</td>
      <td className={`${adminTableTdClass} whitespace-nowrap text-xs tabular-nums`}>{formatDurationLabel(call.duration_seconds)}</td>
      <td className={adminTableTdClass}><div className="flex items-center gap-2"><Link href={`/admin/call-analysis/${call.id}`} className={adminSecondaryButtonClass}>View</Link><DeleteCallButton callId={call.id} label={`${call.caller_name || formatE164ForDisplay(call.caller_number) || "Unknown caller"} · ${call.organization_name} · ${new Date(call.created_at).toLocaleString("en-IE", {timeZone:"Europe/Dublin"})}`} /></div></td>
     </tr>) : <tr><td colSpan={7} className={adminTableEmptyClass}>No calls match these filters.</td></tr>}
    </tbody></table></div><AdminPagination path="/admin/call-analysis" filters={paginationFilters} page={data.page} size={data.size} total={data.total} /></div>
   </AdminListCard>
  </>}
 </AdminPageShell>;
}
