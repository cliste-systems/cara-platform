"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";

export type ReviewItem = { id: string; label: string; value: string; status: "pass" | "fail" | "unknown"; detail: string; expected?: string };
export const reviewStatusClass = (status: ReviewItem["status"]) => status === "pass" ? "bg-emerald-50 text-emerald-700" : status === "fail" ? "bg-red-50 text-red-700" : "bg-[#edf0ee] text-[#63766b]";
export function ReviewStatus({ status, value }: Pick<ReviewItem, "status" | "value">) {
  const Icon = status === "pass" ? Check : status === "fail" ? X : CircleHelp;
  return <span className={`inline-flex min-w-20 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${reviewStatusClass(status)}`}><Icon className="size-3.5" aria-hidden />{value}</span>;
}
export function ReviewDialog({ item, close }: { item: ReviewItem | null; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!item) return; const node = ref.current; node?.showModal(); return () => node?.close(); }, [item]);
  return item ? <dialog ref={ref} aria-labelledby="review-evidence-title" onClose={close} onClick={event => { if (event.target === event.currentTarget) close(); }} className="m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-xl border border-[#d9e2dd] bg-[#fbfcfb] p-5 text-[#11181d] shadow-xl backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-4"><h2 id="review-evidence-title" className="text-base font-semibold">{item.label}</h2><button autoFocus onClick={close} aria-label="Close details" className="rounded p-1 hover:bg-[#e7ede9]"><X className="size-4" /></button></div>
    <div className="mt-4"><ReviewStatus status={item.status} value={item.value} /></div>
    {item.expected ? <p className="mt-3 text-xs text-[#63766b]">Target: {item.expected}</p> : null}
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#52675e]">{item.detail}</p>
  </dialog> : null;
}
export function ReviewPanel({ title, items, improvement, note }: { title: string; items: ReviewItem[]; improvement?: string; note?: string }) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / 5));
  const activePage = Math.min(page, pageCount - 1);
  const visible = items.slice(activePage * 5, activePage * 5 + 5);
  const failed = items.filter(item => item.status === "fail").length;
  const passed = items.filter(item => item.status === "pass").length;
  const unknown = items.length - passed - failed;
  return <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d9e2dd] bg-[#fbfcfb]">
    <header className="shrink-0 border-b border-[#e3e9e5] px-5 py-3"><h2 className="text-sm font-semibold text-[#11181d]">{title}</h2><p className="mt-1 text-[11px] text-[#6b7c75]">{passed} passed · {failed} {failed === 1 ? "issue" : "issues"} · {unknown} unverified</p></header>
    <div className="grid min-h-0 flex-1 grid-rows-5 divide-y divide-[#e3e9e5]">
      {Array.from({ length: 5 }, (_, index) => { const item = visible[index]; return item ? <button key={item.id} onClick={() => setSelected(item)} className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-2 text-left hover:bg-[#f2f5f3] focus-visible:outline-2 focus-visible:outline-[#63766b] lg:min-h-0">
        <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-[18px] text-[#11181d]">{item.label}</span>{item.expected ? <span className="mt-0.5 block truncate text-[10px] text-[#6b7c75]">{item.expected}</span> : null}</span><ReviewStatus status={item.status} value={item.value} />
      </button> : <div key={`empty-${index}`} className="min-h-[52px] lg:min-h-0" />; })}
    </div>
    <footer className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-[#e3e9e5] bg-[#f5f8f6] px-5 text-[11px] text-[#63766b]">
      {improvement ? <button className="font-medium underline decoration-[#b9c6bf] underline-offset-4" onClick={() => setSelected({ id: "improvements", label: "Improvements", value: "Review", status: "unknown", detail: improvement })}>Improvements</button> : <span className="truncate" title={note}>{note ?? `${items.length} checks`}</span>}
      <div className="flex shrink-0 items-center gap-2"><span>{activePage * 5 + (items.length ? 1 : 0)}–{Math.min((activePage + 1) * 5, items.length)} of {items.length}</span>{pageCount > 1 ? <><button className="rounded p-1 hover:bg-[#e7ede9] disabled:opacity-30" disabled={activePage === 0} onClick={() => setPage(activePage - 1)} aria-label={`Previous ${title} checks`}><ChevronLeft className="size-4" /></button><button className="rounded p-1 hover:bg-[#e7ede9] disabled:opacity-30" disabled={activePage >= pageCount - 1} onClick={() => setPage(activePage + 1)} aria-label={`Next ${title} checks`}><ChevronRight className="size-4" /></button></> : null}</div>
    </footer>
    <ReviewDialog item={selected} close={() => setSelected(null)} />
  </section>;
}
export function ReviewOutcome({ item, summary }: { item: ReviewItem; summary: string }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-5 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] px-5 py-4 text-left hover:border-[#b7c6bd]">
    <span className="min-w-0"><span className="block text-sm font-semibold text-[#11181d]">Did Cara sort out what the caller rang for?</span><span className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#63766b]">{summary}</span></span><ReviewStatus status={item.status} value={item.value} />
  </button><ReviewDialog item={open ? item : null} close={() => setOpen(false)} /></>;
}
