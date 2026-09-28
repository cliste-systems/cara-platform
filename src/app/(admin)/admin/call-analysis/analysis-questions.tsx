"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, X, XIcon } from "lucide-react";
import { CALL_ANALYSIS_QUESTIONS, isNegativeAnswer, type CallAnalysisCheck, type CallAnalysisCheckId } from "@/lib/call-analysis-simple";

export function AnalysisQuestions({ checks, only }: { checks: CallAnalysisCheck[]; only?: CallAnalysisCheckId[] }) {
  const [selected, setSelected] = useState<CallAnalysisCheck | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => { dialog?.close(); triggerRef.current?.focus(); };
  }, [selected]);
  const byId = new Map(checks.map(check => [check.id, check]));
  return <>
    <div className="divide-y divide-gray-100">
      {CALL_ANALYSIS_QUESTIONS.filter(question => !only || only.includes(question.id)).map((question) => {
        const check = byId.get(question.id);
        const negative = check ? isNegativeAnswer(check) : false;
        const unknown = !check || check.answer === "unverified";
        const Icon = unknown ? CircleHelp : negative ? X : Check;
        return <button key={question.id} type="button" disabled={!check}
          onClick={(event) => { triggerRef.current = event.currentTarget; setSelected(check ?? null); }}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white"
          aria-label={`${question.label} ${check?.answer === "unverified" ? "Unable to verify" : check?.answer?.toUpperCase() ?? "Awaiting analysis"}. View why.`}>
          <span className="flex min-w-0 items-start gap-3"><span className="text-[13px] font-medium leading-5 text-[#11181d]">{question.label}</span></span>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${unknown ? "bg-amber-50 text-amber-700" : negative ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            <Icon className="size-4" aria-hidden />{unknown ? "Unverified" : check!.answer.toUpperCase()}
          </span>
        </button>;
      })}
    </div>
    {selected ? <dialog ref={dialogRef} aria-labelledby="analysis-answer-title" onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }} className="fixed inset-0 z-50 m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/50">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Call analysis</p><h2 id="analysis-answer-title" className="mt-1 text-lg font-semibold text-gray-900">{CALL_ANALYSIS_QUESTIONS.find(q => q.id === selected.id)?.label}</h2></div>
          <button ref={closeRef} type="button" onClick={() => setSelected(null)} aria-label="Close explanation" className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><XIcon className="size-5" /></button></div>
        <p className="mt-4 text-sm font-semibold text-gray-900">{selected.answer === "unverified" ? "Unable to verify" : selected.answer.toUpperCase()}</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{selected.reason}</p>
        {selected.evidence.length ? <div className="mt-5 space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Evidence</p>{selected.evidence.map((item, index) =>
          <blockquote key={index} className="border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700"><span className="mb-1 block font-semibold capitalize text-gray-500">{item.source}</span>{item.quote}</blockquote>)}</div> : null}
    </dialog> : null}
  </>;
}
