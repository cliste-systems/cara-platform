"use client";
import { useState, type ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { adminTableClass } from "./admin-table";
type Row = { id: string; search: string; content: ReactNode; mobileContent?: ReactNode; test?: boolean };
export function AdminDirectoryTable({ header, rows, columns, label = "records" }: { header: ReactNode; rows: Row[]; columns: number; label?: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [includeTests, setIncludeTests] = useState(false);
  const size = 10;
  const filtered = rows.filter(row => (includeTests || !row.test) && row.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const last = Math.max(0, Math.ceil(filtered.length / size) - 1);
  const current = Math.min(page, last);
  const visible = filtered.slice(current * size, (current + 1) * size);
  const mobile = rows.some(row => row.mobileContent);
  return <div className="flex min-h-0 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-slate-500"><Search className="size-4 shrink-0" aria-hidden /><input aria-label={`Search ${label}`} type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder={`Search ${label}`} className="h-9 w-full min-w-0 max-w-sm rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" /></label>
      {rows.some(row=>row.test) && <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={includeTests} onChange={e=>{setIncludeTests(e.target.checked);setPage(0);}} />Show test records</label>}
    </div>
    {mobile && <div className="divide-y divide-slate-200 md:hidden">{visible.length ? visible.map(row=><div key={row.id} className="p-4">{row.mobileContent}</div>) : <p className="p-8 text-center text-sm text-slate-500">No {label} match this view.</p>}</div>}
    <div className={mobile ? "hidden overflow-x-auto md:block" : "overflow-x-auto"}><table className={adminTableClass}>{header}<tbody className="divide-y divide-slate-200">{visible.length ? visible.map(row => row.content) : <tr><td colSpan={columns} className="p-8 text-center text-sm text-slate-500">No {label} match this view.</td></tr>}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>{filtered.length ? `${current * size + 1}–${Math.min((current + 1) * size, filtered.length)} of ${filtered.length} ${label}` : `0 ${label}`}</span>{last>0 && <div className="flex items-center gap-3"><button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded p-2 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="size-4" /></button><span>Page {current + 1} of {last + 1}</span><button type="button" aria-label="Next page" disabled={current === last} onClick={() => setPage(current + 1)} className="rounded p-2 hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="size-4" /></button></div>}</div>
  </div>;
}
