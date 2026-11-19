"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Phone, Radio } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ServiceReport, ServiceState } from "@/lib/admin-service-status";
import styles from "./service-dashboard.module.css";
import { PhoneLineDialog } from "./phone-line-dialog";

const compactServiceLabels: Record<ServiceState, string> = { operational: "Operational", degraded: "Partly affected", outage: "Service outage", maintenance: "Partly affected", unknown: "Not verified" };
const labels: Record<ServiceState, string> = { operational: "Operational", degraded: "Disruption", outage: "Outage", maintenance: "Maintenance", unknown: "Status unavailable" };
function overall(reports: ServiceReport[]): ServiceState {
  for (const state of ["outage", "degraded", "maintenance", "unknown"] as const) {
    if (reports.some(report => report.state === state)) return state;
  }
  return reports.length ? "operational" : "unknown";
}

export function CaraStatusCard({ connected, compact = false, previewState, phoneConnection }: { connected: boolean; phoneConnection?: import("@/lib/phone-connection").PhoneConnection | null; compact?: boolean; previewState?: "operational" | "degraded" | "outage" }) {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [open, setOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [updatesOpen, setUpdatesOpen] = useState(false);

  useEffect(() => {
    if (previewState) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    async function refresh() {
      controller?.abort();
      const activeController = new AbortController();
      controller = activeController;
      if (!cancelled) setChecking(true);
      try {
        const response = await fetch("/api/dashboard/service-status", { cache: "no-store", signal: activeController.signal });
        if (!response.ok) throw new Error("Status unavailable");
        const next = await response.json() as { services: ServiceReport[] };
        if (!cancelled && !activeController.signal.aborted) { setReports(next.services); }
      } catch {
        if (!cancelled && !activeController.signal.aborted) setReports([]);
      } finally {
        if (!cancelled && !activeController.signal.aborted) setChecking(false);
      }
    }
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; controller?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [previewState]);
  const state = previewState ?? overall(reports);
  return <section className={`${styles.cornerStack} ${compact ? styles.compactStatus : ""}`} aria-label="Cara status and updates">
    <div className={styles.connectionPanel}><header hidden={compact} className={styles.connectionHeading}><h2>Connection status</h2><button type="button" onClick={()=>setOpen(true)} aria-label="View service status details"><ArrowRight aria-hidden="true"/></button></header><div className={styles.statusTiles}>

    <button type="button" onClick={()=>setPhoneOpen(true)} className={styles.healthRow} aria-haspopup="dialog">
      <span className={styles.squareIcon}><Phone aria-hidden="true"/></span><span className={styles.healthRowCopy}><strong>{compact ? "Phone line" : "Phone connection"}</strong><span className={styles.healthState} data-state={connected ? "operational" : "setup"}><i/>{compact ? (connected ? "Connection verified" : "Setup pending") : (connected ? "Connection verified" : "Setup needed")}</span></span>{compact ? <span className={styles.signalBars} data-state={connected ? "operational" : "outage"} aria-hidden="true"><i/><i/><i/><i/><i/></span> : null}<ArrowRight aria-hidden="true"/>
    </button>
    <button type="button" className={styles.healthRow} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className={styles.squareIcon}><Radio aria-hidden="true"/></span><span className={styles.healthRowCopy}><strong>Cara services</strong><span className={styles.healthState} data-state={state} title={labels[state]}><i/>{!previewState && checking && !reports.length ? "Checking status" : compact ? compactServiceLabels[state] : labels[state]}</span></span>{compact ? <span className={styles.signalBars} data-state={state} aria-hidden="true"><i/><i/><i/><i/><i/></span> : null}<ArrowRight aria-hidden="true"/>
    </button>
    </div></div>
    <button hidden={compact} type="button" className={styles.updatesCard} onClick={() => setUpdatesOpen(true)} aria-haspopup="dialog">
      <span className={styles.updatesArt} aria-hidden="true"/>
      <span className={styles.updatesCopy}><strong>What’s new with Cara?</strong><span>Explore your latest dashboard updates.</span><span className={styles.updatesCta}>Take a look<ArrowRight aria-hidden="true"/></span></span>
    </button>
    <PhoneLineDialog incidentUpdate={phoneConnection?.verified_at ? `Connection verified on ${new Date(phoneConnection.verified_at).toLocaleString("en-IE")}.` : undefined} connection={phoneConnection} open={phoneOpen} onOpenChange={setPhoneOpen} state={connected ? "operational" : "setup"}/>
    <Dialog open={updatesOpen} onOpenChange={setUpdatesOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>What’s new with Cara</DialogTitle><DialogDescription>A fresh view of your business, with the details that matter close at hand.</DialogDescription>
      <div className={styles.updateEntries}>
        <article><span className={styles.updateEyebrow}>Dashboard update · 25 October 2026</span><h3>Your day in four numbers</h3><p>See calls answered, follow-ups, minutes used and average call length together. Call metrics reflect the selected period; follow-ups show your outstanding work.</p><Link href="/dashboard/calls">Explore your calls<ArrowRight aria-hidden="true"/></Link></article>
        <article><h3>Your connections, at a glance</h3><p>Check your phone setup and view the latest provider reports for Cara services from the overview.</p><button type="button" onClick={() => {setUpdatesOpen(false);setOpen(true);}}>View service reports<ArrowRight aria-hidden="true"/></button></article>
        <article><h3>Hear your welcome</h3><p>Use Preview greeting on your overview to hear how Cara welcomes callers, or open your greeting settings to make changes.</p><Link href="/dashboard/cara/greeting">Open greeting settings<ArrowRight aria-hidden="true"/></Link></article>
      </div>
    </DialogContent></Dialog>

    <PhoneLineDialog incidentUpdate={reports.length ? `Provider reports last checked ${new Date(reports[0].checkedAt).toLocaleString("en-IE")}.` : "Provider reports are currently unavailable."} kind="services" open={open} onOpenChange={setOpen} state={state === "unknown" ? "unknown" : state === "operational" ? "operational" : state === "outage" ? "outage" : "degraded"}/>
  </section>;
}
