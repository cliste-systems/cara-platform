"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight,
  Phone, RefreshCw, Users, X,
  type LucideIcon,
} from "lucide-react";
import type { AdminOverview, OverviewIssue } from "@/lib/admin-overview";
import { type OverviewIssueFilter } from "@/lib/admin-overview-model";
import { formatDashboardFeedRelativeTime } from "@/lib/dashboard-feed-time";
import styles from "../admin-design.module.css";

const PAGE_SIZE = 3;
const ISSUE_FILTERS = ["all", "customers", "calls", "reviews", "support"] as const;
const serviceLabels = { operational: "Operational", degraded: "Degraded", outage: "Outage", maintenance: "Maintenance", unknown: "Unknown" };

function IconWell({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return <span className={`${styles.iconWell} ${className}`}><Icon size={22} strokeWidth={1.7} aria-hidden /></span>;
}

function Metric({ icon, label, value, hint, href }: { icon: LucideIcon; label: string; value: ReactNode; hint: ReactNode; href?: string }) {
  const content = <><IconWell icon={icon} /><div className="min-w-0"><div className={styles.metricLabel}>{label}</div><div className={styles.value}>{value}</div><div className={styles.hint}>{hint}</div></div></>;
  return href ? <Link href={href} className={styles.metric}>{content}</Link> : <div className={styles.metric}>{content}</div>;
}

function PanelPager({ label, page, total, busy, onPage }: { label: string; page: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return <nav aria-label={`${label} pages`} className={styles.pager}>
    <button className={styles.iconButton} disabled={page === 0 || busy} aria-label={`Previous ${label} page`} onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button>
    <span className={styles.time}>{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
    <button className={styles.iconButton} disabled={(page + 1) * PAGE_SIZE >= total || busy} aria-label={`Next ${label} page`} onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button>
  </nav>;
}

export function AdminGlobalMetricsBoard({ initial }: { initial: AdminOverview }) {
  const [data, setData] = useState(initial);
  const [page, setPage] = useState(0);
  const [issuePage, setIssuePage] = useState(0);
  const [issueFilter, setIssueFilter] = useState<OverviewIssueFilter>("all");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastServiceCheck = useRef(Date.now());

  useEffect(() => {
    const controller = new AbortController();
    let busy = false, queued = false;
    const refresh = async () => {
      if (document.hidden || controller.signal.aborted) return;
      if (busy) { queued = true; return; }
      busy = true;
      setRefreshing(true);
      const includeServices = Date.now() - lastServiceCheck.current >= 60000;
      try {
        const response = await fetch(`/api/admin/overview?page=${page}&size=${PAGE_SIZE}&issuePage=${issuePage}&issueSize=${PAGE_SIZE}&issueFilter=${issueFilter}&services=${includeServices ? 1 : 0}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 ? "Your session has expired. Reload to sign in." : "Refresh failed. Showing the last successful update.");
        const next: AdminOverview = await response.json();
        if (controller.signal.aborted) return;
        if (next.error) throw new Error(next.error);
        if (next.page > 0 && next.page * PAGE_SIZE >= next.total) setPage(0);
        if (next.issuePage > 0 && next.issuePage * PAGE_SIZE >= next.issueTotal) setIssuePage(0);
        setData(previous => ({ ...next, services: includeServices ? next.services : previous.services }));
        setError(null);
        if (includeServices) lastServiceCheck.current = Date.now();
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Refresh failed.");
      } finally {
        busy = false;
        if (!controller.signal.aborted) {
          setRefreshing(false);
          if (queued) { queued = false; void refresh(); }
        }
      }
    };
    const live = new EventSource("/api/admin/overview/events");
    live.addEventListener("call", () => void refresh());
    live.addEventListener("ready", () => void refresh());
    live.addEventListener("issue", () => void refresh());
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    void refresh();
    return () => { controller.abort(); live.close(); clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [page, issuePage, issueFilter, revision]);

  async function markReviewed(issue: OverviewIssue) {
    setReviewing(issue.id); setNotice(null);
    try {
      const response = await fetch("/api/admin/overview/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: issue.callId, signature: issue.signature }) });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not mark this issue reviewed.");
      }
      setNotice("Marked reviewed. New issues on this call will appear again.");
      setRevision(value => value + 1);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Could not update this issue."); }
    finally { setReviewing(null); }
  }

  const format = (value: number | undefined, digits = 0) => value === undefined ? "—" : value.toLocaleString("en-IE", { maximumFractionDigits: digits });
  const todayServices = data.services;
  const affected = todayServices.filter(service => service.state === "outage" || service.state === "degraded");
  const unknown = todayServices.filter(service => service.state === "unknown");
  const maintenance = todayServices.filter(service => service.state === "maintenance");
  const serviceIssues = [...affected, ...maintenance];
  const reportedAt = serviceIssues.flatMap(service => service.reportedAt ? [service.reportedAt] : []).sort()[0];

  return <div data-admin-fill className={styles.overview}>
    <header className={styles.heading}>
      <div><h1>Overview</h1><p className={styles.subtitle}>Your next actions, customer readiness and today’s calls.</p></div>
      <div className={styles.actions}>
        <span className={styles.date}><CalendarDays size={17} aria-hidden />Today · Dublin</span>
      </div>
    </header>
    {(error || data.error) ? <p className={styles.error} role="alert">{error || data.error}</p> : null}
    <section className={styles.metricRail} aria-label="Operations metrics">
      <Metric icon={Phone} label="Calls today" value={format(data.stats?.calls)} hint={data.stats ? `${data.stats.customer} customer · ${data.stats.engineer + data.stats.demo + data.stats.verification} test` : "Counts unavailable"} href="/admin/call-analysis?date=today" />
      <Metric icon={Users} label="Live now" value={format(data.stats?.active)} hint="Calls in progress" href="#overview-calls-title" />
      <Metric icon={AlertTriangle} label="Needs attention" value={data.error ? "—" : data.issueTotal} hint={`${data.issueFilter === "all" ? "All categories" : data.issueFilter[0].toUpperCase() + data.issueFilter.slice(1)} · all dates`} href="#overview-attention-title" />
    </section>
    <div className={styles.overviewSections}>
      <section className={styles.attentionSection} aria-labelledby="overview-attention-title">
        <div className={styles.panelHeader}><h2 id="overview-attention-title">Needs attention</h2><div className="flex items-center gap-3"><button type="button" className={styles.link} onClick={() => dialog.current?.showModal()}>Provider reports{unknown.length ? ` · ${unknown.length} unavailable` : ""} <ArrowRight size={14} aria-hidden /></button><PanelPager label="attention" page={issuePage} total={data.issueTotal} busy={issuePage !== data.issuePage || data.issueFilter !== issueFilter} onPage={setIssuePage} /></div></div>
        <div className={styles.queueTabs} role="tablist" aria-label="Attention category">{ISSUE_FILTERS.map(filter => <button key={filter} id={`attention-tab-${filter}`} type="button" role="tab" aria-selected={issueFilter === filter} aria-controls="attention-queue" tabIndex={issueFilter === filter ? 0 : -1} onKeyDown={event => { const index = ISSUE_FILTERS.indexOf(filter); const next = event.key === "ArrowRight" ? ISSUE_FILTERS[(index + 1) % ISSUE_FILTERS.length] : event.key === "ArrowLeft" ? ISSUE_FILTERS[(index + ISSUE_FILTERS.length - 1) % ISSUE_FILTERS.length] : event.key === "Home" ? ISSUE_FILTERS[0] : event.key === "End" ? ISSUE_FILTERS[ISSUE_FILTERS.length - 1] : null; if (next) { event.preventDefault(); setIssueFilter(next); setIssuePage(0); document.getElementById(`attention-tab-${next}`)?.focus(); } }} className={`${styles.queueTab} ${issueFilter === filter ? styles.selectedTab : ""}`} onClick={() => { setIssueFilter(filter); setIssuePage(0); }}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div>
        <div id="attention-queue" role="tabpanel" aria-labelledby={`attention-tab-${issueFilter}`} className={styles.queueContent} aria-busy={refreshing}>
        {(issueFilter === "all" || issueFilter === "calls") && (serviceIssues.length ? <div className={styles.incident}>
          <div className={styles.incidentRow}>
            <span className={styles.alertWell}><AlertTriangle size={23} aria-hidden /></span>
            <div className="min-w-0 flex-1"><p className={styles.incidentTitle}>{affected.length ? `${affected.length} provider report${affected.length === 1 ? "" : "s"}` : unknown.length ? "Provider checks unavailable" : "Provider maintenance"}</p><p className={styles.incidentDetail}>{serviceIssues.map(service => service.name).join(" · ")}</p></div>
            {reportedAt ? <time className={styles.time} dateTime={reportedAt} title={reportedAt}>Reported {formatDashboardFeedRelativeTime(reportedAt)}</time> : null}
            <button className={styles.outline} onClick={() => dialog.current?.showModal()} aria-label="Inspect provider reports">Inspect <ArrowRight size={15} aria-hidden /></button>
          </div>
          <p className={styles.incidentNote}>Provider-reported status; customer impact is not verified.{unknown.length ? ` ${unknown.length} check${unknown.length === 1 ? " is" : "s are"} unavailable.` : ""}</p>
        </div> : null)}
        {data.issueFilter === issueFilter && data.issues.map(issue => <div className={styles.issueRow} key={issue.id}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${issue.priority === 1 ? "bg-[#b6664c]" : "bg-[#d2a14b]"}`} aria-hidden />
          <Link href={issue.href} className={styles.issueBody}><p className={styles.rowTitle}>{issue.title}</p><p className={styles.rowSubtitle}>{issue.detail}{issue.reasons.length > 1 ? ` · ${issue.reasons.slice(1).join(" · ")}` : ""}</p></Link>
          <time className={styles.time} dateTime={issue.at}>{issue.time}</time>
          {issue.callId && issue.signature ? <button className={styles.iconButton} disabled={reviewing !== null} aria-label={`Mark reviewed: ${issue.title} for ${issue.detail}`} title="Mark reviewed after inspecting the call" onClick={() => void markReviewed(issue)}><Check size={16} aria-hidden /></button> : <Link href={issue.href} className={styles.iconButton} aria-label={`Inspect ${issue.title}`}><ArrowRight size={16} aria-hidden /></Link>}
        </div>)}
        {data.issueFilter !== issueFilter ? <p className={styles.queueEmpty}>Loading attention queue…</p> : !data.issues.length ? <p className={styles.queueEmpty}>{data.stats ? issueFilter === "all" ? "No outstanding work in this queue." : "No unresolved issues in this category." : "Attention queue unavailable."}</p> : null}
        </div>

        <p className={styles.panelFooter}>Open support and customer readiness across all dates. Call evidence is retained for 30 days.</p>
        {notice ? <p className={`${styles.hint} mt-3`} role="status">{notice}</p> : null}
      </section>
      <section className={styles.activitySection} aria-labelledby="overview-calls-title">
        <div className={styles.panelHeader}><h2 id="overview-calls-title">Recent activity</h2><div className="flex items-center gap-3"><PanelPager label="calls" page={page} total={data.total} busy={page !== data.page} onPage={setPage} /><Link href="/admin/call-analysis?date=today" className={styles.link}>View calls <ArrowRight size={14} aria-hidden /></Link></div></div>
        <div className={styles.activityContent}><table className={styles.activityTable}><thead><tr><th>Time</th><th>Call / customer</th><th>Call status</th><th>Review</th></tr></thead><tbody>{data.calls.map(call => <tr key={call.id}><td><time dateTime={call.at}>{call.time}</time></td><td>{call.callId ? <Link href={`/admin/call-analysis/${call.callId}`} className={`${styles.rowTitle} ${styles.activityName}`} title={call.name}>{call.name}</Link> : <span className={`${styles.rowTitle} ${styles.activityName}`} title={call.name}>{call.name}</span>}<p className={styles.rowSubtitle}>{call.kind}{!call.active ? ` · ${call.minutes} min` : ""}</p></td><td>{call.active ? "In progress" : call.status}</td><td><span className={`${styles.badge} ${call.analysisStatus === "error" || call.verdict === "fail" ? styles.danger : ""}`}>{call.analysisStatus === "error" ? "Analysis error" : call.analysisStatus === "completed" ? call.verdict === "pass" ? "Passed" : call.verdict === "fail" ? "Failed" : "Needs review" : call.analysisStatus === "running" ? "Analysing" : call.analysisStatus === "pending" ? "Queued" : "Not assessed"}</span></td></tr>)}</tbody></table>{!data.calls.length ? <p className={styles.activityEmpty}>{data.stats ? "No calls today. Live conversations will appear here." : "Call activity is unavailable."}</p> : null}</div>
      </section>
    </div>
    <footer className={styles.refresh}><div className="flex items-center gap-2"><button className={styles.iconButton} disabled={refreshing} aria-label="Refresh overview" onClick={() => { lastServiceCheck.current = 0; setRevision(value => value + 1); }}><RefreshCw size={16} aria-hidden /></button><span>{error || data.error ? "Refresh needs attention" : "Last refreshed"} {new Date(data.checkedAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Dublin" })}</span></div><div className="flex items-center gap-3"><Link href="/admin/call-analysis?date=today&status=backlog" className="hover:underline">{format(data.stats?.pendingReviews)} reviews pending today</Link><span>{format(data.stats?.minutes, 1)} recorded minutes · Europe/Dublin</span></div></footer>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="overview-services-title">
      <div className={styles.dialogHeader}><div><h2 id="overview-services-title">Provider reports</h2><p className={`${styles.hint} mt-1`}>Current service reports · Checked every minute</p></div><button className={styles.iconButton} aria-label="Close provider reports" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <div className={styles.dialogBody}><p className={`${styles.hint} py-4`}>Reports cover the products and regions HelloCara uses. They are not direct tests of your account or customer calls.</p>{todayServices.map(service => <div key={service.name} className={styles.serviceRow}><div className="flex items-start justify-between gap-4"><div><a href={service.url} target="_blank" rel="noopener noreferrer" className={styles.rowTitle}>{service.name} ↗</a><p className={styles.rowSubtitle}>{service.purpose}</p></div><span className={`${styles.badge} ${service.state === "degraded" || service.state === "outage" ? styles.danger : service.state === "operational" ? styles.live : ""}`}>{serviceLabels[service.state]}</span></div>{service.monitored ? <p className={`${styles.hint} mt-2`}>Monitoring: {service.monitored.length ? service.monitored.join(" · ") : "Configured components could not be matched"}</p> : null}{service.details.length ? <ul className={`${styles.hint} mt-2 space-y-1`}>{service.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul> : null}<p className={`${styles.time} mt-2`}>Checked {new Date(service.checkedAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" })}</p></div>)}</div>
    </dialog>
  </div>;
}
