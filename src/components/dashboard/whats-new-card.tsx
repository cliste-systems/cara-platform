"use client";

import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DASHBOARD_SHELL_VERSION, CARA_VERSION } from "@/lib/dashboard-versions";
import shared from "./service-privacy-dialog.module.css";
import styles from "./whats-new-card.module.css";

const updates = [
  { title:"Your calls, together", text:"Search calls, filter outcomes and review summaries, recordings and transcripts in one place." },
  { title:"A clearer follow-up trail", text:"Complete a follow-up with your name and a timestamp, or reopen it when more work is needed." },
  { title:"Knowledge questions at a glance", text:"Find calls linked to Cara’s knowledge questions, with distinct colours for questions, callbacks and completed work." },
  { title:"A calmer mobile workspace", text:"Full-width call pages, readable call details and consistent dialogs across phone and desktop." },
];

export function WhatsNewCard() {
 const [open,setOpen]=useState(false);
 return <>
  <button className={styles.card} onClick={()=>setOpen(true)} aria-haspopup="dialog">
   <span className={styles.art} aria-hidden="true"/>
   <span className={styles.copy}><span className={styles.eyebrow}><Sparkles/>Latest updates</span><strong>What’s new in<br/>HelloCara</strong><span className={styles.version}>Dashboard v{DASHBOARD_SHELL_VERSION}</span></span><ArrowUpRight className={styles.arrow}/>
  </button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent overlayClassName={shared.backdrop} className={`${shared.popup} ${styles.popup}`}>
   <header className={styles.header}><span className={styles.dialogArt} aria-hidden="true"/><DialogTitle>What’s new in HelloCara</DialogTitle><DialogDescription>Product updates and release notes.</DialogDescription></header>
   <div className={styles.body}><div className={styles.release}><span>27/10/26</span><span>Dashboard v{DASHBOARD_SHELL_VERSION}</span><span>Cara v{CARA_VERSION}</span></div><h3>A clearer view of every conversation</h3>{updates.map(update=><article key={update.title}><h4>{update.title}</h4><p>{update.text}</p></article>)}</div>
   <footer className={styles.footer}><button onClick={()=>setOpen(false)}>Close</button></footer>
  </DialogContent></Dialog>
 </>;
}
