"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type KeyboardEvent } from "react";
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Clock3, PieChart } from "lucide-react";
import { chartAxis, durationChartAxis, durationLineSegments, formatCallDuration, formatChartCount, type DashboardCallAnalytics, type CallAnalyticsBucket } from "@/lib/dashboard-call-analytics";
import styles from "./dashboard-call-analytics.module.css";

type View = "activity" | "outcomes" | "duration";
const tabs: { id: View; label: string }[] = [{ id: "activity", label: "Activity" }, { id: "outcomes", label: "Outcomes" }, { id: "duration", label: "Duration" }];
const number = (value: number) => new Intl.NumberFormat("en-IE").format(value);
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("button") ?? []);
  const index = items.indexOf(event.currentTarget);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
  event.preventDefault(); items[next]?.focus();
}
function tickLabel(bucket: CallAnalyticsBucket, index: number, length: number) {
  const indexes = new Set(Array.from({ length: Math.min(5, length) }, (_, i) => Math.round(i * (length - 1) / Math.max(1, Math.min(5, length) - 1))));
  return indexes.has(index) ? bucket.shortLabel : "";
}

export function DashboardCallAnalytics({ data }: { data?: DashboardCallAnalytics | null }) {
  const [view, setView] = useState<View>("activity");
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const active = data?.buckets.find(bucket => bucket.id === selected);
  const activityAxis = chartAxis(Math.max(0, ...(data?.buckets.map(bucket => bucket.calls) ?? [])));
  const durationAxis = durationChartAxis(Math.max(0, ...(data?.buckets.map(bucket => bucket.averageSeconds ?? 0) ?? [])));
  const selection = active ? view === "activity" ? `${active.label} · ${number(active.calls)} ${active.calls === 1 ? "call" : "calls"}` : `${active.label} · ${formatCallDuration(active.averageSeconds)} average · ${number(active.measured)} measured` : view === "activity" ? "Calls by hour" : "Average call length by hour";
  const emptyText = view === "duration" && data?.total ? "No recorded durations in this period." : "No calls in this period yet.";
  const EmptyIcon = view === "duration" ? Clock3 : view === "outcomes" ? PieChart : ChartNoAxesColumn;
  function changeView(next: View) { setView(next); setSelected(null); }
  const buckets = data?.buckets ?? [];
  const pickedBucket = active ?? buckets.find(bucket => bucket.calls > 0) ?? buckets[0];
  const pickedIndex = buckets.findIndex(bucket => bucket.id === pickedBucket?.id);
  function stepHour(direction: number) {
    const next = buckets[(pickedIndex + direction + buckets.length) % buckets.length];
    if (next) setSelected(next.id);
  }

  return <section className={styles.analytics} aria-label="Call analytics">
    <header className={styles.heading}>
      <h2>Call analytics</h2>
      <div role="tablist" aria-label="Analytics view" className={styles.tabs}>
        {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`${id}-tab-${tab.id}`} aria-selected={view === tab.id} aria-controls={`${id}-panel`} tabIndex={view === tab.id ? 0 : -1} onClick={() => changeView(tab.id)} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          changeView(tabs[next].id); document.getElementById(`${id}-tab-${tabs[next].id}`)?.focus();
        }}>{tab.label}</button>)}
      </div>
    </header>
    <div key={view} className={styles.panel} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${view}`} tabIndex={0}>
      {!data ? <div className={styles.empty}><ChartNoAxesColumn aria-hidden="true"/><strong>Analytics couldn’t load.</strong><p>We’ll try again automatically.</p></div> : view === "outcomes" ? <>
        {data.total > 0 ? <div className={styles.outcomes} data-many={data.outcomes.length > 6}>
          <div className={styles.ring} role="img" aria-label={data.outcomes.map(row => `${row.label}: ${number(row.count)}, ${row.percent}%`).join(". ")}>
            <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="62" fill="none" stroke="#ffffff0a" strokeWidth="18"/>{data.outcomes.map((row, index) => {
              const before = data.outcomes.slice(0, index).reduce((sum, item) => sum + item.count, 0) / data.total * 100;
              return <circle key={row.id} cx="80" cy="80" r="62" pathLength="100" fill="none" stroke={row.shade} strokeWidth="18" strokeDasharray={`${row.count / data.total * 100} 100`} strokeDashoffset={-before} transform="rotate(-90 80 80)"/>;
            })}</svg><span><strong>{formatChartCount(data.total)}</strong><small>{data.total === 1 ? "call" : "calls"}</small></span>
          </div>
          <ul className={styles.legend}>{data.outcomes.map(row => <li key={row.id}><i style={{ background: row.shade }}/><span>{row.label}</span><strong>{number(row.count)}</strong><small>{row.percent === 0 ? "<1" : row.percent}%</small></li>)}</ul>
        </div> : <div className={styles.empty}><EmptyIcon aria-hidden="true"/><strong>{emptyText}</strong><p>Your call outcomes will appear here.</p></div>}
      </> : <>
        {(view === "activity" ? data.total : data.measured) > 0 ? <>
          <p className={styles.detail} aria-live="polite" aria-atomic="true">{selection}</p>
          <div className={styles.hourPicker}>
            <div className={styles.hourStepper} role="group" aria-label="Chart hour">
              <button type="button" aria-label="Previous hour" onClick={() => stepHour(-1)}><ChevronLeft aria-hidden="true"/></button>
              <span aria-live="polite" className={styles.changingValue}><AnimatePresence initial={false} mode="popLayout"><motion.span key={pickedBucket?.id} initial={{opacity:0,y:reducedMotion?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-4}} transition={{duration:reducedMotion?0:0.18}}>{pickedBucket?.label}</motion.span></AnimatePresence></span>
              <button type="button" aria-label="Next hour" onClick={() => stepHour(1)}><ChevronRight aria-hidden="true"/></button>
            </div>
            <span aria-live="polite" className={styles.changingValue}><AnimatePresence initial={false} mode="popLayout"><motion.span key={`${view}-${pickedBucket?.id}`} initial={{opacity:0,y:reducedMotion?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-4}} transition={{duration:reducedMotion?0:0.18}}>{pickedBucket ? view === "activity" ? `${number(pickedBucket.calls)} ${pickedBucket.calls === 1 ? "call" : "calls"}` : `${formatCallDuration(pickedBucket.averageSeconds)} average` : ""}</motion.span></AnimatePresence></span>
          </div>
        </> : null}
        {(view === "activity" ? data.total : data.measured) === 0 ? <div className={styles.empty}><EmptyIcon aria-hidden="true"/><strong>{emptyText}</strong><p>{view === "duration" ? "Recorded call lengths will build this trend." : "Your busiest hours will appear as calls arrive."}</p></div> : <>
          <div className={styles.chart}>
            <div className={styles.axis} aria-hidden="true">{(view === "activity" ? activityAxis : durationAxis).ticks.slice().reverse().map(tick => <span key={tick}>{view === "activity" ? formatChartCount(tick) : formatCallDuration(tick, true)}</span>)}</div>
            <div className={styles.plot}>
              <div className={styles.grid} aria-hidden="true">{(view === "activity" ? activityAxis : durationAxis).ticks.map(tick => <i key={tick}/>)}</div>
              {view === "activity" ? <div className={styles.bars} style={{ gridTemplateColumns: `repeat(${buckets.length},minmax(0,1fr))` }}>{buckets.map(bucket => <button key={bucket.id} type="button" className={styles.barTarget} aria-label={`${bucket.label}, ${number(bucket.calls)} ${bucket.calls === 1 ? "call" : "calls"}`} data-active={selected === bucket.id} onMouseEnter={() => { if (window.matchMedia("(hover: hover) and (min-width: 601px)").matches) setSelected(bucket.id); }} onFocus={() => setSelected(bucket.id)} onClick={() => setSelected(bucket.id)} onKeyDown={moveFocus}><span style={{ height: `${bucket.calls / activityAxis.max * 100}%`, minHeight: bucket.calls > 0 ? 3 : 0 }}/></button>)}</div> : <div className={styles.line}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{durationLineSegments(buckets, durationAxis.max).map((points, i) => <polyline key={i} pathLength="1" points={points} fill="none" stroke="#e7e7e7" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</svg>
                {buckets.map((bucket, i) => bucket.averageSeconds != null && bucket.measured > 0 ? <button type="button" key={bucket.id} className={styles.point} data-active={selected === bucket.id} style={{ left: `${buckets.length === 1 ? 50 : i / (buckets.length - 1) * 100}%`, top: `${100 - bucket.averageSeconds / durationAxis.max * 100}%` }} aria-label={`${bucket.label}, average ${formatCallDuration(bucket.averageSeconds)}, ${number(bucket.measured)} measured ${bucket.measured === 1 ? "call" : "calls"}`} onMouseEnter={() => { if (window.matchMedia("(hover: hover) and (min-width: 601px)").matches) setSelected(bucket.id); }} onFocus={() => setSelected(bucket.id)} onClick={() => setSelected(bucket.id)} onKeyDown={moveFocus}><i/></button> : null)}
              </div>}
            </div>
            <div className={styles.xLabels} style={{ gridTemplateColumns: `repeat(${buckets.length},minmax(0,1fr))` }} aria-hidden="true">{buckets.map((bucket, i) => <span key={bucket.id}>{tickLabel(bucket, i, buckets.length)}</span>)}</div>
          </div>
          {view === "duration" ? <p className={styles.footnote}>{ `${number(data.measured)} measured ${data.measured === 1 ? "call" : "calls"}${data.total > data.measured ? ` · ${number(data.total - data.measured)} without duration` : ""} · Longest ${formatCallDuration(data.longestSeconds)}`}</p> : null}
          <table className={`${styles.dataTable} sr-only`}><caption>{view === "activity" ? "Call volume" : "Average call duration"} by {data.granularity}</caption><thead><tr><th>Time</th><th>Calls</th><th>Measured calls</th><th>Average duration</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.id}><th>{bucket.label}</th><td>{bucket.calls}</td><td>{bucket.measured}</td><td>{formatCallDuration(bucket.averageSeconds)}</td></tr>)}</tbody></table>
        </>}
      </>}
    </div>
  </section>;
}
