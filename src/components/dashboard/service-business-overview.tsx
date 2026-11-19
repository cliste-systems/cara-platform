"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Loader2, Phone, Play, Square } from "lucide-react";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { DashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { speakVoicePreview, stopVoicePreview } from "@/components/onboarding/onboarding-voice-preview";
import { buildFullVoiceGreeting } from "@/lib/voice-greeting";
import { CaraStatusCard } from "./cara-status-card";
import styles from "./service-overview.module.css";

function Panel({title,count,href,children}:{title:string;count?:number;href:string;children:ReactNode}) {
 return <section className={styles.panel}><header className={styles.panelHeading}><h2>{title}</h2><div>{count!==undefined&&<span className={styles.count}>{count}</span>}<Link href={href} className={styles.circleLink} aria-label={`View ${title.toLowerCase()}`}><ArrowRight aria-hidden="true"/></Link></div></header><div className={styles.rows}>{children}</div></section>;
}
function Empty({title,children}:{title:string;children:ReactNode}){return <div className={styles.empty}><strong>{title}</strong><p>{children}</p></div>;}
export function ServiceBusinessOverview({snapshot:s,refreshError,onRetry,greeting}:{snapshot:DashboardHomeSnapshot;refreshError:string|null;onRetry:()=>void;greeting?:{intro:string;closing:string}}) {
 const router=useRouter();
 const [voice,setVoice]=useState<"idle"|"loading"|"playing">("idle");
 const [voiceError,setVoiceError]=useState<string|null>(null);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();stopVoicePreview();},[]);
 async function preview(){
  if(voice!=="idle"){request.current?.abort();stopVoicePreview();setVoice("idle");return;}
  if(!greeting?.intro||!greeting.closing){router.push("/dashboard/cara/greeting");return;}
  const controller=new AbortController();request.current=controller;setVoice("loading");setVoiceError(null);
  const result=await speakVoicePreview(buildFullVoiceGreeting(greeting.intro,"Cara",greeting.closing),{greetingIntro:greeting.intro,greetingClosing:greeting.closing},{signal:controller.signal,onEnded:()=>setVoice("idle")});
  if(controller.signal.aborted)return;
  if(result.ok)setVoice("playing");else{setVoice("idle");setVoiceError(result.message);}
 }
 const maxCalls=Math.max(1,...s.callTimes.map(bucket=>bucket.value));
 const hasChart=s.callTimes.some(bucket=>bucket.value>0);
 const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("");
 return <div className={styles.overview}>
  <header className={styles.intro}><h1>{s.greeting}</h1><p>Here’s what’s happening with your business today.</p></header>
  {(s.error||refreshError)&&<div><FormFeedback message={s.error||refreshError}/><button onClick={onRetry} className={styles.retry}>Try again</button></div>}
  {!s.error&&<div className={styles.layout}>
   <div className={styles.main}>
    <section className={styles.metrics} aria-label="Call metrics">
     <Link href="/dashboard/calls" className={styles.featuredMetric}><strong>{s.stats[0]?.value??"0"}</strong><span>Calls answered</span><Phone aria-hidden="true"/></Link>
     <div className={styles.otherMetrics}>
      <Link href="/dashboard/calls?filter=follow_up"><strong>{s.openActions}</strong><span>Follow-ups</span></Link>
      <Link href="/dashboard/usage"><strong>{s.callMinutes==null?"—":new Intl.NumberFormat("en-IE",{maximumFractionDigits:1}).format(s.callMinutes)}</strong><span>Minutes used {s.metricPeriod??"today"}</span></Link>
      <Link href="/dashboard/calls"><strong>{s.averageCallSeconds==null?"—":`${Math.floor(s.averageCallSeconds/60)}m ${s.averageCallSeconds%60}s`}</strong><span>Average call length</span></Link>
     </div>
    </section>
    <div className={styles.pair}>
     <Panel title="Follow-ups" count={s.openActions} href="/dashboard/calls?filter=follow_up">
      {s.needsAttention.length?s.needsAttention.slice(0,4).map(row=><Link key={row.id} href={row.href} className={styles.row}><span className={styles.avatar}>{initials(row.title)}</span><span className={styles.rowCopy}><strong>{row.title}</strong><small>{row.description}</small></span><ArrowRight aria-hidden="true"/></Link>):<Empty title="You’re all caught up">Customer follow-ups will appear here.</Empty>}
     </Panel>
     <Panel title="Cara needs an answer" count={s.openTrainingCount} href="/dashboard/cara-knowledge?tab=needs-input">
      {s.caraTraining.length?s.caraTraining.slice(0,4).map(row=><Link key={row.id} href={row.href} className={styles.row}><span className={styles.question}>{row.title}</span><ArrowRight aria-hidden="true"/></Link>):<Empty title="No questions waiting">Cara’s questions will appear here.</Empty>}
     </Panel>
    </div>
    <div className={`${styles.pair} ${styles.bottomPair}`}>
     <Panel title="Recent calls" count={Number(s.stats[0]?.value?.replaceAll(",",""))||0} href="/dashboard/calls">
      {s.activity.length?s.activity.slice(0,5).map(row=><Link key={row.id} href={row.href} className={styles.row}><span className={styles.avatar}>{initials(row.title)}</span><span className={styles.rowCopy}><strong>{row.title}</strong><small>{row.subtitle||row.badge}</small></span><time>{row.time}</time><ArrowRight aria-hidden="true"/></Link>):<Empty title="Your first call will appear here">Call summaries, all in one place.</Empty>}
     </Panel>
     <section className={styles.panel}><header className={styles.panelHeading}><div><h2>Call activity</h2><p>Recent calls by hour · Dublin time</p></div></header><div className={styles.chart}>
      {hasChart?<><div className={styles.bars} role="img" aria-label={s.callTimes.map(b=>`${b.label}: ${b.value} calls`).join(", ")}>{s.callTimes.map((bucket,index)=><div className={styles.barColumn} key={bucket.id}><div className={styles.barTrack}><span className={styles.bar} data-peak={bucket.value===maxCalls} style={{height:`${bucket.value/maxCalls*100}%`}} title={`${bucket.label} · ${bucket.value} calls`}/></div><small>{index%2===0?bucket.label:""}</small></div>)}</div><p className={styles.chartNote}>Based on the latest calls in this period, 08:00–18:59.</p></>:<Empty title="Your call pattern starts here">Calls between 08:00 and 18:59 will build this chart.</Empty>}
     </div></section>
    </div>
   </div>
   <aside className={styles.side} aria-label="Cara and your account">
    <article className={styles.greeting}><div className={styles.greetingArt} aria-hidden="true"/><div className={styles.greetingControls}><h2>Your greeting</h2><button type="button" onClick={()=>void preview()} aria-busy={voice==="loading"}>{voice==="loading"?<Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>:voice==="playing"?<Square aria-hidden="true"/>:<Play aria-hidden="true"/>}{voice==="loading"?"Preparing…":voice==="playing"?"Stop":"Preview"}</button></div></article>
    <CaraStatusCard connected={Boolean(s.caraStatus?.isOnline)}/>
    <nav className={styles.utilities} aria-label="Manage your business">{[{href:"/dashboard/usage",label:"Billing & usage"},{href:"/dashboard/team",label:"Team"},{href:"/dashboard/support",label:"Help"}].map(item=><Link key={item.href} href={item.href}>{item.label}<ArrowRight aria-hidden="true"/></Link>)}</nav>
   </aside>
  </div>}
  {voiceError&&<FormFeedback message={voiceError}/>}
 </div>;
}
