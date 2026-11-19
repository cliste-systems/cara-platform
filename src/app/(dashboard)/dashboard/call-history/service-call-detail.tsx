"use client";

import { formatServiceCallDate, formatServiceCallTime } from "@/lib/service-call-format";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Check, Copy, CornerUpLeft, History, Loader2, MessageCircleQuestion, RotateCcw, ShieldOff, Trash2 } from "lucide-react";
import { CallerHistoryDialog } from "@/components/dashboard/caller-history-section";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { CallerDataEraseDialog } from "@/components/dashboard/caller-data-erase-dialog";
import { ANONYMOUS_CALLER_E164, normalizeBlockedCallerE164 } from "@/lib/blocked-callers";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { CallMediaDialogs } from "./call-media-dialogs";
import { ArrowLeft } from "lucide-react";
import { isCallMediaRetentionExpired } from "@/lib/call-media-retention";
import { buildCallsPageHref } from "@/lib/calls-page-href";
import { stripToolLinesFromTranscript } from "@/lib/transcript-display";
import { serviceCallSummary } from "@/lib/service-call-summary";
import { isServiceFollowUp, serviceCallPurpose, serviceCallTone, serviceCallStatus, type ServiceCall } from "@/lib/service-calls";
import { addBlockedCaller, removeBlockedCallerByPhone } from "../settings/blocked-numbers-actions";
import { eraseCustomerData } from "../privacy/actions";
import { fetchCallHistoryDetail } from "./actions";
import { updateServiceCallCompletion } from "./service-call-completion-actions";
import styles from "./service-calls.module.css";

export function ServiceCallDetail({ call, canManage, blockedNumbers, initialTranscript, onBack }: { onBack: () => void; initialTranscript: { text: string; error: boolean } | null; call: ServiceCall; canManage: boolean; blockedNumbers: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completedBy, setCompletedBy] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [transcript, setTranscript] = useState<{ text: string; error: boolean } | null>(() => initialTranscript ? { ...initialTranscript, text: stripToolLinesFromTranscript(initialTranscript.text) } : null);
  const [retry, setRetry] = useState(0);
  const erased = Boolean(call.caller_data_erased_at);
  const expired = isCallMediaRetentionExpired(call.created_at);
  const phone = normalizeBlockedCallerE164(call.caller_number);
  const blocked = Boolean(phone && blockedNumbers.includes(phone));
  const canActOnCaller = canManage && phone && phone !== ANONYMOUS_CALLER_E164 && !erased;
  const followUp = isServiceFollowUp(call) || Boolean(call.follow_up_completed_at);
  const tone = serviceCallTone(call);
  const complete = Boolean(call.follow_up_completed_at);
  const name = erased ? "Caller data erased" : call.caller_name?.trim() || formatE164ForDisplay(call.caller_number) || "Unknown caller";
  const duration = Math.max(0, call.duration_seconds || 0);
  const summary = erased ? "Personal data for this call has been removed." : call.ai_summary || (call.post_call_status === "pending" ? "Cara is preparing the call summary." : "No summary available.");
  const summaryDetails = serviceCallSummary(summary, !erased && !expired && call.post_call_status !== "pending" ? transcript?.text : null);

  useEffect(() => {
    if (erased || expired) return;
    let active = true;
    fetchCallHistoryDetail(call.id).then(result => {
      if (active) setTranscript(result ? { text: stripToolLinesFromTranscript(result.transcriptVerbatim), error: false } : { text: "", error: true });
    }).catch(() => { if (active) setTranscript({ text: "", error: true }); });
    return () => { active = false; };
  }, [call.id, call.post_call_status, call.ai_summary, erased, expired, retry, initialTranscript]);

  async function copySummary() {
    try { await navigator.clipboard.writeText(summaryDetails.overview); setCopied(true); setFeedback("Summary copied."); }
    catch { setFeedback("We couldn’t copy the summary. Please try again."); }
  }
  function completeFollowUp() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await updateServiceCallCompletion(call.id, complete ? "open" : "resolved", completedBy);
        if (!result.ok) { setFeedback(result.message); return; }
        setFeedback(null);
        setCompletionOpen(false);
        setCompletedBy("");
        router.refresh();
      } catch { setFeedback("We couldn’t update this follow-up. Please try again."); }
    });
  }
  function blockCaller() {
    if (!phone) return;
    startTransition(async () => {
      try {
        const result = blocked ? await removeBlockedCallerByPhone({ phone }) : await addBlockedCaller({ phone });
        setBlockOpen(false);
        setFeedback(result.ok ? blocked ? "Caller unblocked." : "Caller blocked." : result.message);
        if (result.ok) router.refresh();
      } catch { setFeedback("We couldn’t update this caller. Please try again."); }
    });
  }
  function eraseCaller(input: { reason: string; performedBy: string; confirm: string }) {
    if (!phone) return;
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("phone", phone); data.set("reason", input.reason); data.set("performedBy", input.performedBy); data.set("confirm", input.confirm);
        const result = await eraseCustomerData(data);
        setEraseOpen(false);
        setFeedback(result.ok ? "Caller data erased." : result.message);
        if (result.ok) router.refresh();
      } catch { setFeedback("We couldn’t erase this caller’s data. Please try again."); }
    });
  }
  return <div className={styles.detail}>
    <header className={styles.detailHeader}>
      <h2>{name}</h2>
      <dl className={styles.callerMeta} aria-label="Call details">
        {!erased && call.caller_name && <div className={styles.callerPhone}><dt>Phone number</dt><dd>{formatE164ForDisplay(call.caller_number)}</dd></div>}
        <div><dt>Date</dt><dd><time dateTime={call.created_at}>{formatServiceCallDate(call.created_at)}</time></dd></div>
        <div><dt>Time</dt><dd><time dateTime={call.created_at}>{formatServiceCallTime(call.created_at)}</time></dd></div>
        <div><dt>Duration</dt><dd>{Math.floor(duration / 60)}m {duration % 60}s</dd></div>
      </dl>
      {followUp ? <section className={styles.reviewSection} data-tone={tone} aria-label={call.knowledge_question ? "Knowledge question" : "Call follow-up"}>
        <div className={styles.reviewPurpose}>{complete ? <Check/> : tone === "knowledge" ? <MessageCircleQuestion/> : <CornerUpLeft/>}<span>{serviceCallPurpose(call)}</span></div>
        {complete && <div className={styles.completionAudit}>
          <strong>Marked as complete</strong>
          <p>{call.follow_up_completed_by_label ? `${call.follow_up_completed_by_label} marked this as complete` : "Completed before names were recorded"}</p>
          <time dateTime={call.follow_up_completed_at!}>{`${formatServiceCallDate(call.follow_up_completed_at!)} · ${formatServiceCallTime(call.follow_up_completed_at!)}`}</time>
        </div>}
        <div className={styles.reviewControls}>{canManage && <button disabled={pending} onClick={() => complete ? completeFollowUp() : setCompletionOpen(true)}>{pending ? <Loader2 className={styles.spin}/> : complete ? <RotateCcw/> : <Check/>}{complete ? "Reopen follow-up" : "Mark as complete"}</button>}{call.knowledge_question && call.knowledge_needs_input && <Link href="/dashboard/cara-knowledge?tab=needs-input">Answer in Cara’s knowledge</Link>}</div>
        {call.knowledge_needs_input && <p className={styles.notice}>Completing this follow-up does not publish an answer for Cara. Add the answer in Cara’s knowledge.</p>}
      </section> : <span className={styles.callStatus}><Check/>{serviceCallStatus(call)}</span>}
    </header>
    <div className={styles.detailBody}>
      {canActOnCaller && <section className={`${styles.detailSection} ${styles.callerPrivacy}`} aria-label="Caller privacy">
        <h3>Caller privacy</h3>
        <div className={styles.privacyActions}>
          <button disabled={pending} onClick={() => setBlockOpen(true)}>{blocked ? <ShieldOff/> : <Ban/>}{blocked ? "Unblock caller" : "Block caller"}</button>
          <button className={styles.deleteAction} disabled={pending} onClick={() => setEraseOpen(true)}><Trash2/>Delete caller data</button>
        </div>
      </section>}
      <section className={styles.detailSection}><h3>Summary</h3><p>{summaryDetails.overview}</p>
        {!["pending", "complete"].includes(call.post_call_status ?? "complete") && !erased && <p className={styles.notice}>Some call details are still being reviewed. The recording and transcript may be incomplete.</p>}
        <div className={`${styles.actions} ${styles.summaryActions}`}>{!erased && <button className={styles.quiet} onClick={() => setHistoryOpen(true)}><History/>Caller history</button>}</div>
        {feedback && <p className={styles.notice} role="status">{feedback}</p>}
      </section>
      <CallMediaDialogs call={call} name={name} transcript={transcript} onRetry={() => { setTranscript(null); setRetry(value => value + 1); }}/>
      {erased && <section className={styles.detailSection}><h3>Data removal</h3><p>{call.caller_data_erased_by_label || "Staff member"}{call.caller_data_erased_reason ? ` · ${call.caller_data_erased_reason}` : ""}</p></section>}
    </div>
    <footer className={`${styles.detailFooter} ${styles.callFooter}`}><button className={styles.backAction} onClick={onBack}><ArrowLeft/>Back to calls</button>{!erased && <button className={styles.primary} onClick={() => void copySummary()} disabled={!call.ai_summary}>{copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy summary"}</button>}</footer>
    <ConfirmDialog serviceTheme open={completionOpen} onOpenChange={setCompletionOpen} title="Mark as complete" description="Add your name so your team knows who resolved this follow-up." confirmLabel="Mark as complete" confirmDisabled={!completedBy.trim() || completedBy.trim().length > 80} pending={pending} onConfirm={completeFollowUp}>
      <label htmlFor="completion-name" className={styles.completionLabel}>Your name</label>
      <input id="completion-name" className={styles.completionInput} value={completedBy} onChange={event => setCompletedBy(event.target.value)} maxLength={80} placeholder="Enter your name" autoComplete="name" required/>
      {feedback && <p role="alert">{feedback}</p>}
    </ConfirmDialog>
    <CallerHistoryDialog serviceTheme open={historyOpen} onOpenChange={setHistoryOpen} callerNumber={call.caller_number} currentCallId={call.id} phoneDisplay={formatE164ForDisplay(call.caller_number)} onSelectCall={(id, createdAt) => { setHistoryOpen(false); router.push(buildCallsPageHref({ callLogId: id, callCreatedAt: createdAt })); }}/>
    <ConfirmDialog serviceTheme open={blockOpen} onOpenChange={setBlockOpen} title={blocked ? "Unblock this caller?" : "Block this caller?"} description={blocked ? "They will be able to reach Cara again." : "Future calls from this number will hear a short message and hang up before Cara answers. You can undo this in Settings."} confirmLabel={blocked ? "Unblock caller" : "Block caller"} onConfirm={blockCaller} pending={pending} destructive/>
    <CallerDataEraseDialog serviceTheme open={eraseOpen} onOpenChange={setEraseOpen} phoneDisplay={formatE164ForDisplay(call.caller_number)} callerName={call.caller_name} pending={pending} onConfirm={eraseCaller}/>
  </div>;
}
