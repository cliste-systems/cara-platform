"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, Clock3, LifeBuoy, Phone, Server, X, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { formatDashboardFeedRelativeTime } from "@/lib/dashboard-feed-time";
import type { AdminOverview } from "@/lib/admin-overview";
const surface = "flex min-h-0 min-w-0 flex-col rounded-lg border border-[#d9e2dd] bg-[#fbfcfb]";
const pagerButton = "flex size-8 cursor-pointer items-center justify-center rounded-md border border-[#d9e2dd] bg-white text-[#52675e] transition-colors hover:border-[#91a39a] hover:bg-[#e7ede9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white";
function PanelPager({label,page,total,size,busy,onPage}:{label:string;page:number;total:number;size:number;busy:boolean;onPage:(page:number)=>void}) {
  if(total<=size) return null;
  return <nav aria-label={`${label} pages`} className="flex items-center gap-1.5"><button type="button" title="Previous page" aria-label={`Previous ${label.toLowerCase()} page`} disabled={page===0||busy} onClick={()=>onPage(page-1)} className={pagerButton}><ChevronLeft className="size-4"/></button><button type="button" title="Next page" aria-label={`Next ${label.toLowerCase()} page`} disabled={(page+1)*size>=total||busy} onClick={()=>onPage(page+1)} className={pagerButton}><ChevronRight className="size-4"/></button></nav>;
}
const labels = { operational:"Operational", degraded:"Degraded", outage:"Outage", maintenance:"Maintenance", unknown:"Unknown" };
export function AdminGlobalMetricsBoard({ initial }: {initial:AdminOverview}) {
  const [data,setData] = useState(initial);
  const [page,setPage] = useState(0);
  const [issuePage,setIssuePage] = useState(0);
  const [capacity,setCapacity] = useState(8);
  const listBody=useRef<HTMLDivElement>(null);
  const lastServiceCheck=useRef(Date.now());
  const affected=data.services.filter(s=>s.state==="degraded"||s.state==="outage");
  const unknown=data.services.filter(s=>s.state==="unknown");
  const maintenance=data.services.filter(s=>s.state==="maintenance");
  const serviceReports=[...affected,...maintenance];
  const incidentTimes=serviceReports.flatMap(service=>service.reportedAt ? [service.reportedAt]:[]).sort();
  const serviceAt=incidentTimes[0] ?? [...serviceReports,...unknown].map(service=>service.checkedAt).sort().at(-1);
  const hasServiceIssue=affected.length+unknown.length+maintenance.length>0;
  const issueSize=Math.max(1,capacity-(hasServiceIssue ? 1:0));
  useEffect(()=>{
    const node=listBody.current; if(!node)return;
    const observer=new ResizeObserver(([entry])=>{const next=Math.max(1,Math.min(50,Math.floor(entry.contentRect.height/60)));setCapacity(current=>current===next ? current:next);});
    observer.observe(node); return ()=>observer.disconnect();
  },[]);
  const [error,setError] = useState<string|null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const controller = new AbortController();
    let busy=false, queued=false;
    const refresh = async () => {
      if(document.hidden || controller.signal.aborted) return;
      if(busy){queued=true;return;}
      busy=true;
      const services=Date.now()-lastServiceCheck.current>=60000;
      try {
        const res=await fetch(`/api/admin/overview?page=${page}&size=${capacity}&issuePage=${issuePage}&issueSize=${issueSize}&services=${services?1:0}`,{signal:controller.signal,cache:"no-store"});
        if(!res.ok) throw new Error(res.status===401 ? "Your session has expired. Reload to sign in." : "Refresh failed. Showing the last update.");
        const next:AdminOverview=await res.json();
        if (next.page > 0 && next.page * capacity >= next.total) setPage(0);
        if (next.issuePage > 0 && next.issuePage * issueSize >= next.issueTotal) setIssuePage(0);
        setData(previous=>({...next,services:services?next.services:previous.services}));setError(null);
        if(services) lastServiceCheck.current=Date.now();
      } catch(e) { if(!controller.signal.aborted) setError(e instanceof Error ? e.message : "Refresh failed."); }
      finally {busy=false;if(queued&&!controller.signal.aborted){queued=false;void refresh();}}
    };
    const live=new EventSource("/api/admin/overview/events");
    const onCall=()=>{if(page>0)setPage(0);else void refresh();};
    live.addEventListener("call",onCall);
    live.addEventListener("ready",refresh);
    void refresh(); const timer=setInterval(refresh,10000);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return ()=>{controller.abort();live.close();clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[page,capacity,issuePage,issueSize]);
  const format=(v:number|undefined,digits=0)=>v===undefined ? "—" : v.toLocaleString("en-IE",{maximumFractionDigits:digits});
  const openServices=()=>{ if(dialog.current) { dialog.current.showModal(); dialog.current.scrollTop=0; } };
  return <div className="flex min-h-0 flex-1 flex-col gap-4">
    {(error||data.error)&&<p role="alert" className="text-xs text-amber-800">{error||data.error}</p>}
    <AdminStatsGrid className="shrink-0">
      <AdminStatCard label="Calls" value={format(data.stats?.calls)} icon={Phone}/>
      <AdminStatCard label="Minutes used" value={format(data.stats?.minutes,1)} icon={Clock3}/>
      <AdminStatCard label="Support inbox" value={format(data.stats?.support)} icon={LifeBuoy} href="/admin/support"/>
      <AdminStatCard label="Failed reviews" value={format(data.stats?.failed)} icon={ClipboardCheck} tone={data.stats?.failed ? "danger":"neutral"} href="/admin/call-analysis?status=fail"/>
      <button onClick={openServices} className="cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]" aria-label="View complete service status">
        <AdminStatCard className="h-full hover:border-[#a9b9b1]" label="Service status" value={<><span>{affected.length ? `${affected.length} affected` : unknown.length ? "Check needed" : maintenance.length ? "Maintenance" : "Operational"}</span>{unknown.length>0&&<span className="ml-2 text-xs font-normal">{unknown.length} unknown</span>}</>} icon={Server} tone={affected.length ? "danger":unknown.length ? "warning":"neutral"}/>
      </button>
    </AdminStatsGrid>
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <section className={surface}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e3e9e5] px-5"><h2 className="text-sm font-semibold">Needs attention</h2><PanelPager label="Needs attention" page={issuePage} total={data.issueTotal} size={issueSize} busy={issuePage!==data.issuePage||data.issueSize!==issueSize} onPage={setIssuePage}/></header>
        <div className="grid min-h-[300px] flex-1 px-5 lg:min-h-0" style={{gridTemplateRows:`repeat(${capacity}, minmax(0, 1fr))`}}>
          {hasServiceIssue&&<button onClick={openServices} className="flex min-h-0 w-full cursor-pointer items-center gap-3 border-b border-[#e9efeb] text-left hover:bg-[#f5f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]"><Server className="size-4 shrink-0 text-[#b45f52]"/><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{affected.length ? `${affected.length} provider${affected.length === 1 ? "" : "s"} reporting disruption` : unknown.length ? "Service checks need attention" : "Scheduled service maintenance"}</span><span className="block truncate text-xs text-[#6b7c75]">{[affected.map(s=>s.name).join(" · "), unknown.length ? `${unknown.length} status checks unavailable` : "", maintenance.length ? `${maintenance.length} in maintenance` : ""].filter(Boolean).join(" · ")}</span></span>{serviceAt&&<time dateTime={serviceAt} title={incidentTimes.length ? `Earliest ongoing incident: ${serviceAt}` : `Last checked: ${serviceAt}`} className="shrink-0 text-xs text-[#8b9c94]">{incidentTimes.length ? "" : "Checked "}{formatDashboardFeedRelativeTime(serviceAt)}</time>}</button>}
          {data.issues.slice(0,issueSize).map(issue=><Link key={issue.id} href={issue.href} className="flex min-h-0 cursor-pointer items-center gap-3 border-b border-[#e9efeb] last:border-0 hover:bg-[#f5f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]"><span className="size-2 shrink-0 rounded-full bg-[#b45f52]"/><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{issue.title}</span><span className="block truncate text-xs text-[#6b7c75]">{issue.detail}</span></span><time dateTime={issue.at} title={issue.at} className="shrink-0 text-xs text-[#8b9c94]">{issue.time}</time></Link>)}
          {!data.issues.length&&!hasServiceIssue&&<p className="py-4 text-sm text-[#6b7c75]">Nothing needs attention.</p>}
        </div>
      </section>
      <section className={surface}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e3e9e5] px-5"><h2 className="text-sm font-semibold">Recent activity</h2><PanelPager label="Recent activity" page={page} total={data.total} size={capacity} busy={page!==data.page||data.size!==capacity} onPage={setPage}/></header>
        <div ref={listBody} className="grid min-h-[300px] flex-1 px-5 lg:min-h-0" style={{gridTemplateRows:`repeat(${capacity}, minmax(0, 1fr))`}}>{data.calls.slice(0,capacity).map(call=>{
          const content=<><Phone className={`size-4 shrink-0 ${call.active ? "animate-pulse text-emerald-600":"text-[#8b9c94]"}`}/><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{call.name}</span><span className="block truncate text-xs text-[#6b7c75]">{call.detail}</span></span><span className={`shrink-0 text-xs ${call.active ? "rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700":"text-[#8b9c94]"}`}>{call.time}</span></>;
          const rowClass="flex min-h-0 items-center gap-3 border-b border-[#e9efeb] last:border-0";
          return call.callId ? <Link key={call.id} href={`/admin/call-analysis/${call.callId}`} className={`${rowClass} cursor-pointer hover:bg-[#f5f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]`}>{content}</Link> : <div key={call.id} className={`${rowClass} bg-emerald-50/30`} aria-live="polite">{content}</div>;
        })}{!data.calls.length&&<p className="py-4 text-sm text-[#6b7c75]">No calls today.</p>}</div>
      </section>
    </div>
    <dialog ref={dialog} className="m-auto max-h-[85dvh] w-[min(720px,94vw)] rounded-xl border border-[#d9e2dd] bg-[#fbfcfb] p-0 text-[#11181d] shadow-xl backdrop:bg-black/40" aria-labelledby="services-title">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d9e2dd] bg-[#e8eeea] px-6 py-4"><div><h2 id="services-title" className="font-semibold">Service status</h2><p className="mt-1 text-xs text-[#52675e]">HelloCara’s services · Checked every minute</p></div><button onClick={()=>dialog.current?.close()} aria-label="Close service status"><X className="size-5"/></button></header>
      <div className="px-6"><p className="py-4 text-xs text-[#6b7c75]">Only the products and deployment regions used by HelloCara are included. Alerts are relevant provider reports, not a direct availability test.</p>{data.services.map(service=><div key={service.name} className="border-t border-[#e3e9e5] py-4"><div className="flex items-center justify-between gap-4"><div><a href={service.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline">{service.name} ↗</a><p className="text-xs text-[#6b7c75]">{service.purpose}</p></div><span className={`rounded-md px-2 py-1 text-xs font-medium ${service.state==="operational" ? "bg-emerald-50 text-emerald-700":service.state==="unknown"||service.state==="maintenance" ? "bg-amber-50 text-amber-800":"bg-red-50 text-red-700"}`}>{labels[service.state]}</span></div>{service.monitored&&<p className="mt-2 text-xs text-[#6b7c75]">Monitoring: {service.monitored.length ? service.monitored.join(" · ") : "Could not match configured components"}</p>}{service.details.length>0&&<ul className="mt-2 space-y-1 text-xs text-[#52675e]">{service.details.map((detail,index)=><li key={index}>{detail}</li>)}</ul>}<p className="mt-2 text-[11px] text-[#8b9c94]">Checked {new Date(service.checkedAt).toLocaleTimeString("en-IE",{hour:"2-digit",minute:"2-digit"})}</p></div>)}</div>
    </dialog>
  </div>;
}
