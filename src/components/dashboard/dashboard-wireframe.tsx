"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Phone, List, Clock3, ChartNoAxesColumn, CornerUpLeft, MessageCircleQuestion } from "lucide-react";
import type { DashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { DashboardCallAnalytics } from "./dashboard-call-analytics";
import { WhatsNewCard } from "./whats-new-card";
import styles from "./dashboard-wireframe.module.css";

const MotionLink = motion.create(Link);

function knowledgeTopicLabel(question: string) {
 const topic = question.trim()
  .replace(/^(?:what[’']?s|what is) included in (?:the |an? )?/i, "")
  .replace(/^do (?:we|you) (?:offer|service|support|provide|cover) /i, "")
  .replace(/^(?:what (?:is|are)|how (?:does|do)|can (?:we|you)) /i, "")
  .replace(/[?.!]+$/, "");
 return `Question regarding ${topic}`;
}

export function DashboardWireframe({snapshot:s,businessName}:{phoneConnection?:import("@/lib/phone-connection").PhoneConnection|null;snapshot:DashboardHomeSnapshot;businessName?:string|null}) {
 const reduceMotion = useReducedMotion();
 const rowMotion = {
  layout: "position" as const,
  initial: reduceMotion ? false as const : { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 },
  transition: { duration: reduceMotion ? 0 : 0.22 },
 };
 const [greeting,setGreeting]=useState(`Good ${s.greeting.charAt(0).toLowerCase()}${s.greeting.slice(1)}`);
 useEffect(()=>{
  const update=()=>{
   const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Dublin",hour:"numeric",hourCycle:"h23"}).format(new Date()));
   const name=s.greeting.includes(", ")?s.greeting.slice(s.greeting.indexOf(", ")+2):"";
   setGreeting(`Good ${hour<12?"morning":hour<18?"afternoon":"evening"}${name?`, ${name}`:""}`);
  };
  update();const timer=setInterval(update,60_000);return()=>clearInterval(timer);
 },[s.greeting]);
 const metrics=[{label:"Calls answered",value:s.stats[0]?.value??"0",Icon:Phone},{label:"Follow-ups",value:String(s.openActions),Icon:List},{label:"Minutes used",value:s.callMinutes==null?"—":String(Math.round(s.callMinutes)),Icon:Clock3},{label:"Average call",value:s.averageCallSeconds==null?"—":`${Math.floor(s.averageCallSeconds/60)}m ${s.averageCallSeconds%60}s`,Icon:ChartNoAxesColumn}];
 const empty=(text:string)=><p className={styles.emptyCopy}>{text}</p>;
 return <div className={styles.board} data-dashboard-overview>
  <div className={styles.leftPanel}>
  <section className={styles.hero} aria-label={`Call metrics for ${s.metricPeriod || "today"}`}><div className={styles.heroWelcome}><h1>{greeting}</h1><p>Here’s how {businessName?.trim() || "your business"} is doing {s.metricPeriod && s.metricPeriod !== "today" ? `over the ${s.metricPeriod}` : "today"}.</p></div><div className={styles.metrics}>{metrics.map(({label,value,Icon})=><div className={styles.metric} key={label}><Icon aria-hidden="true"/><strong>{value}</strong><span>{label}</span></div>)}</div></section>
  <DashboardCallAnalytics data={s.callAnalytics}/>

  </div>
  <div className={styles.workPanel}>
  <section className={`${styles.shape} ${styles.follow}`}><header><h2>Follow-ups</h2><Link href="/dashboard/calls?filter=follow_up" aria-label="All follow-ups" data-attention={s.openActions > 0}><span>{s.openActions}</span><ArrowUpRight/></Link></header><div className={styles.liveRows}><AnimatePresence initial={false} mode="popLayout">{s.needsAttention.length?s.needsAttention.slice(0,3).map(row=><MotionLink {...rowMotion} href={row.href} key={row.id}><span key="icon" className={`${styles.rowIcon} ${styles.needsAction}`} aria-label="Needs attention"><CornerUpLeft aria-hidden="true"/></span><span key="copy" className={styles.rowCopy}><strong title={row.title}>{row.title}</strong><small title={row.description}>{row.description}</small></span><time key="time" title={row.time}>{row.time}</time><ArrowUpRight key="arrow" aria-hidden="true"/></MotionLink>):empty("No follow-ups need your attention.")}</AnimatePresence></div></section>
  <section className={`${styles.shape} ${styles.training}`}><header><h2>Cara’s knowledge</h2><Link href="/dashboard/cara-knowledge?tab=needs-input" aria-label="All Cara questions" data-attention={s.openTrainingCount > 0}><span>{s.openTrainingCount}</span><ArrowUpRight/></Link></header><div className={styles.liveRows}><AnimatePresence initial={false} mode="popLayout">{s.caraTraining.length?s.caraTraining.slice(0,3).map(row=><MotionLink {...rowMotion} href={row.href} key={row.id}><span key="icon" className={`${styles.rowIcon} ${styles.needsAction}`} aria-label="Needs your answer"><MessageCircleQuestion aria-hidden="true"/></span><span key="copy" className={styles.rowCopy}><strong title={row.title}>{knowledgeTopicLabel(row.title)}</strong><small title={row.description}>{row.description}</small></span><time key="time" title={row.time}>{row.time}</time><ArrowUpRight key="arrow" aria-hidden="true"/></MotionLink>):empty("No questions need your attention.")}</AnimatePresence></div></section>
  <section className={`${styles.shape} ${styles.recent}`}><header><h2>Recent calls</h2><Link href="/dashboard/calls" aria-label="All recent calls"><span>{s.activity.length}</span><ArrowUpRight/></Link></header><div className={styles.liveRows}><AnimatePresence initial={false} mode="popLayout">{s.activity.length?s.activity.slice(0,3).map(row=><MotionLink {...rowMotion} href={row.href} key={row.id}><span key="icon" className={styles.rowIcon}><Phone aria-hidden="true"/></span><span key="copy" className={styles.rowCopy}><strong title={row.title}>{row.title}</strong><small>{row.subtitle || "Call details"}</small></span><time key="time" title={row.time}>{row.time}</time><ArrowUpRight key="arrow" aria-hidden="true"/></MotionLink>):empty("No recent calls to show.")}</AnimatePresence></div></section>
  </div>
  <div className={styles.updatesSlot}><WhatsNewCard/></div>

 </div>;
}
