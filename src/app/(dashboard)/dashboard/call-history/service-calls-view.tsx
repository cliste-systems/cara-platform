"use client";

import { formatServiceCallDate, formatServiceCallTime } from "@/lib/service-call-format";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, CornerUpLeft, MessageCircleQuestion, Phone, Search } from "lucide-react";
import { SERVICE_CALL_PAGE_SIZE, isServiceFollowUp, serviceCallRowPurpose, serviceCallTone, serviceCallStatus, serviceCallsHref, type ServiceCall } from "@/lib/service-calls";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { useCallsLiveUpdates } from "./use-calls-live-updates";
import { CallsOutcomeSelect } from "./calls-outcome-select";
import { CallsDatePicker } from "./calls-date-picker";
import { ServiceCallDetail } from "./service-call-detail";
import styles from "./service-calls.module.css";

type Props = {
  initialTranscript: { id: string; text: string; error: boolean } | null;
  calls: ServiceCall[]; selectedCall: ServiceCall | null; initialSelectedId: string | null;
  organizationId: string; canManage: boolean; blockedNumbers: string[];
  followUps: boolean; completed: boolean; date: string; today: string;
  query: string; outcome: string; page: number; total: number; totalPages: number;
  allCallsCount: number | null; followUpCount: number | null; error: boolean;
};

export function ServiceCallsView(props: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedId = useRef<string | null>(props.initialSelectedId);
  const detailPanelRef = useRef<HTMLElement>(null);
  const listPanelRef = useRef<HTMLElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const previousPage = useRef(props.page);
  const previousMobileOpen = useRef(Boolean(props.initialSelectedId));
  // URL selection also responds to browser Back and links from Home/history.
  const urlId = params.get("call") || params.get("followUp") || params.get("ticket");
  const selectedId = urlId;
  const mobileOpen = Boolean(urlId);
  const selected = props.calls.find(call => call.id === selectedId) ??
    (props.selectedCall?.id === selectedId ? props.selectedCall : null);
  useEffect(() => {
    if (previousMobileOpen.current !== mobileOpen && window.matchMedia("(max-width: 850px)").matches) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (mobileOpen) {
        detailPanelRef.current?.focus({ preventScroll: true });
        detailPanelRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
      } else {
        if (lastSelectedId.current) rowRefs.current.get(lastSelectedId.current)?.focus({ preventScroll: true });
        listPanelRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
      }
    }
    previousMobileOpen.current = mobileOpen;
  }, [mobileOpen]);
  useEffect(() => {
    if (previousPage.current !== props.page) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
      if (window.matchMedia("(max-width: 850px)").matches) rowsRef.current?.scrollIntoView({ behavior, block: "start" });
      else rowsRef.current?.scrollTo({ top: 0, behavior });
    }
    previousPage.current = props.page;
  }, [props.page]);
  const incoming = useCallsLiveUpdates({
    organizationId: props.organizationId,
    calls: props.calls.map(call => ({ id: call.id, createdAt: call.created_at })),
    viewingToday: props.followUps || props.date === props.today, page: props.page,
  });
  const href = (changes: Record<string, string | null>) => serviceCallsHref(new URLSearchParams(params), changes);
  function navigate(changes: Record<string, string | null>) {
    startTransition(() => router.push(href({ page: null, call: null, followUp: null, ticket: null, ...changes }), { scroll: false }));
  }
  function select(call: ServiceCall) {
    lastSelectedId.current = call.id;
    startTransition(() => router.push(href({ call: call.id, followUp: null, ticket: null }), { scroll: false }));
  }
  function back() {
    startTransition(() => router.push(href({ call: null, followUp: null, ticket: null }), { scroll: false }));
  }
  const clearSelection = { page: null, call: null, followUp: null, ticket: null, q: null, outcome: null, status: null };
  return <div className={styles.board} data-dashboard-calls data-mobile-detail={mobileOpen} aria-busy={pending}>
    <section ref={listPanelRef} className={`${styles.panel} ${styles.listPanel}`} aria-label="Calls">
      <div className={styles.listHeader}>
        <div className={styles.callsHero}>
          <div className={styles.heroCopy}><h1>Calls</h1><p>Your conversations with Cara</p></div>
          <div className={styles.conversationArt} aria-hidden="true">
            <picture><source media="(max-width: 850px)" srcSet="/cara-calls-candid-mobile-v3.webp"/><Image src="/cara-calls-candid-desktop-v3.webp" alt="" width={1600} height={533} sizes="(max-width: 850px) 100vw, 55vw" preload/></picture>
          </div>
        </div>
        <div className={styles.viewControls}>
          <nav className={styles.tabs} aria-label="Call views">
            <Link href={href({ ...clearSelection, filter: null })} scroll={false} aria-current={!props.followUps ? "page" : undefined}>All calls{props.allCallsCount != null && <span>{props.allCallsCount}</span>}</Link>
            <Link href={href({ ...clearSelection, filter: "follow_up", date: null })} scroll={false} aria-current={props.followUps ? "page" : undefined}>Follow-ups{props.followUpCount != null && <span>{props.followUpCount}</span>}</Link>
          </nav>
        </div>
        {props.followUps && <nav className={styles.statusTabs} aria-label="Follow-up status">
          <Link href={href({ page: null, call: null, followUp: null, ticket: null, status: null })} scroll={false} aria-current={!props.completed ? "page" : undefined}>To do</Link>
          <Link href={href({ page: null, call: null, followUp: null, ticket: null, status: "resolved" })} scroll={false} aria-current={props.completed ? "page" : undefined}>Completed</Link>
        </nav>}
        <div className={styles.filters}>
          <form key={props.query} className={styles.search} onSubmit={event => { event.preventDefault(); navigate({ q: String(new FormData(event.currentTarget).get("calls-search") ?? "").trim() || null }); }}>
            <Search aria-hidden="true"/><input name="calls-search" autoComplete="off" spellCheck={false} type="search" defaultValue={props.query} maxLength={120} placeholder="Search name or number" aria-label="Search name or number" onChange={event => { if (!event.target.value && props.query) navigate({ q: null }); }}/><button type="submit" aria-label="Search calls"><ArrowUpRight aria-hidden="true"/></button>
          </form>
          {!props.followUps && <CallsOutcomeSelect value={props.outcome} onChange={outcome => navigate({ outcome: outcome || null })}/>}
          {!props.followUps && <CallsDatePicker value={props.date} today={props.today} onChange={date => navigate({ date })}/>}
        </div>
        {props.query && <p className={styles.searchScope}>Matches for “{props.query}” {props.followUps ? "across follow-ups" : "on the selected day"} <button onClick={() => navigate({ q: null })}>Clear</button></p>}
      </div>
      <div ref={rowsRef} key={`${props.page}-${props.date}-${props.query}-${props.outcome}-${props.followUps}-${props.completed}`} className={styles.rows}>
        {props.error ? <div className={styles.empty} role="alert"><Phone/><h2>Calls couldn’t load</h2><p>Your call history hasn’t changed.</p><button onClick={() => router.refresh()}>Try again</button></div> : <>
          {incoming && !props.followUps && !props.query && !props.outcome && <div className={styles.incoming} role="status"><Phone/><span>A call is being processed. Its details will appear shortly.</span></div>}
          {props.calls.length === 0 ? <div className={styles.empty}><Check/><h2>{props.query || props.outcome ? "No matching calls" : props.followUps ? props.completed ? "No completed follow-ups" : "You’re up to date" : "No calls on this day"}</h2><p>{props.query || props.outcome ? "Try another search or filter." : props.followUps ? "Calls requiring a response appear here." : "Choose another date or check back after Cara answers a call."}</p>{(props.query || props.outcome) && <button onClick={() => navigate({ q: null, outcome: null })}>Clear filters</button>}</div> :
          <ul className={styles.callList}>{props.calls.map(call => {
            const followUp = isServiceFollowUp(call) && !call.follow_up_completed_at;
            const tone = serviceCallTone(call);
            const Icon = tone === "complete" ? Check : tone === "knowledge" ? MessageCircleQuestion : followUp ? CornerUpLeft : Phone;
            const name = call.caller_data_erased_at ? "Caller data erased" : call.caller_name?.trim() || formatE164ForDisplay(call.caller_number) || "Unknown caller";
            return <li key={call.id}><button ref={node => { if (node) rowRefs.current.set(call.id, node); else rowRefs.current.delete(call.id); }} className={styles.callRow} data-selected={selected?.id === call.id} aria-label={`${name}, ${serviceCallStatus(call)}`} aria-pressed={selected?.id === call.id} onClick={() => select(call)}>
              <span className={styles.rowIcon} data-attention={followUp} data-tone={tone}><Icon aria-hidden="true"/></span><span className={styles.rowCopy}><strong>{name}</strong><small data-tone={tone}>{serviceCallRowPurpose(call)}</small></span>
              <span className={styles.rowMeta}><span data-attention={followUp} data-tone={tone}>{serviceCallStatus(call)}</span><span className={styles.timeAction}><time dateTime={call.created_at}>{props.followUps && <span className={styles.rowDate}>{formatServiceCallDate(call.created_at)}</span>}<span>{formatServiceCallTime(call.created_at)}</span></time><ArrowUpRight className={styles.rowArrow} aria-hidden="true"/></span></span>
            </button></li>;
          })}</ul>}
        </>}
      </div>
      <footer className={styles.pagination}><span aria-live="polite">{props.total ? `${(props.page - 1) * SERVICE_CALL_PAGE_SIZE + 1}–${Math.min(props.page * SERVICE_CALL_PAGE_SIZE, props.total)} of ${props.total}` : "0 calls"}</span><div><button aria-label="Previous page" disabled={props.page <= 1 || pending} onClick={() => navigate({ page: props.page > 2 ? String(props.page - 1) : null })}><ChevronLeft/></button><button aria-label="Next page" disabled={props.page >= props.totalPages || pending} onClick={() => navigate({ page: String(props.page + 1) })}><ChevronRight/></button></div></footer>
    </section>
    <section ref={detailPanelRef} tabIndex={-1} className={`${styles.panel} ${styles.detailPanel}`} aria-label="Selected call">
      {props.error ? <div className={styles.empty}><p>Select a call after refreshing the list.</p></div> : selected ? <ServiceCallDetail onBack={back} initialTranscript={props.initialTranscript?.id === selected.id ? props.initialTranscript : null} key={selected.id} call={selected} canManage={props.canManage} blockedNumbers={props.blockedNumbers}/> : <div className={styles.empty}><Phone/><h2>Select a call</h2><p>Review the summary, recording and conversation here.</p></div>}
    </section>
  </div>;
}
