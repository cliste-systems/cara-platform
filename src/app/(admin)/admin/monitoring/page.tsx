import Link from "next/link";
import { Activity } from "lucide-react";
import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminPermission } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Errors & performance — HelloCara Admin" };

function recentCutoff() { return new Date(Date.now() - 86400000).toISOString(); }

export default async function MonitoringPage({searchParams}: {searchParams: Promise<{kind?: string; environment?: string}>}) {
  await requireAdminPermission("team");
  const params = await searchParams;
  const kind = params.kind === "error" || params.kind === "slow" ? params.kind : "all";
  const environment = params.environment === "development" ? "development" : "production";
  let query = createAdminClient().from("application_events").select("id,created_at,kind,operation,code,organization_id,duration_ms").eq("environment", environment).gte("created_at", recentCutoff()).order("created_at", {ascending:false}).limit(200);
  if (kind !== "all") query = query.eq("kind",kind);
  const {data, error} = await query;
  const events = data ?? [];
  return <AdminPageShell icon={Activity} title="Errors & performance" description="Recorded server failures and slow billing requests · last 24 hours · retained for 30 days" actions={<Link href={`/admin/monitoring?environment=${environment}&kind=${kind}`} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-100">Refresh</Link>}>
    <form className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Environment<select name="environment" defaultValue={environment} className="ml-2 rounded-lg border bg-white p-2"><option value="production">Production</option><option value="development">Local development</option></select></label>
      <label className="text-sm">Show<select name="kind" defaultValue={kind} className="ml-2 rounded-lg border bg-white p-2"><option value="all">All events</option><option value="error">Errors</option><option value="slow">Slow requests</option></select></label>
      <button className="cursor-pointer rounded-full bg-[#262626] px-5 py-2 text-sm text-white hover:bg-[#444]">Apply</button>
    </form>
    {error ? <AdminErrorCard message="Monitoring could not be loaded. Please retry."/> : <>
      <div className="rounded-xl border bg-white p-4 text-sm"><strong>{events.length}{events.length === 200 ? "+" : ""} recorded events</strong><p className="mt-1 text-gray-500">{new Set(events.map(e=>e.organization_id).filter(Boolean)).size} identifiable customers affected in this list. Events without a customer can include pre-signup failures. No events does not prove every service is healthy.</p></div>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{["Time (UTC)","Type","Operation","Failure / threshold","Duration","Customer"].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{events.map(event=><tr key={event.id} className="border-t"><td className="whitespace-nowrap p-3">{new Date(event.created_at).toISOString().replace("T"," ").slice(0,19)}</td><td className="p-3">{event.kind === "error" ? "Error" : "Slow"}</td><td className="p-3">{event.operation}</td><td className="p-3">{event.code.replaceAll("_"," ")}</td><td className="p-3">{event.duration_ms == null ? "—" : `${(event.duration_ms/1000).toFixed(1)}s`}</td><td className="p-3">{event.organization_id ? <Link className="underline" href={`/admin/customers/${event.organization_id}`}>View customer</Link> : "Not identified"}</td></tr>)}</tbody></table>{!events.length && <p className="p-8 text-center text-sm text-gray-500">No recorded events for these filters.</p>}</div>
      <p className="text-xs text-gray-500">Coverage: unhandled server errors, existing observed background failures, checkout preparation failures and billing preparation over 3 seconds. Browser-only failures and general page speed are not yet collected here.</p>
    </>}
  </AdminPageShell>;
}
