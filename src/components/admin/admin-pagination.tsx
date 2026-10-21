import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
export function AdminPagination({ path, filters, page, size, total }: { path: string; filters: Record<string, string>; page: number; size: number; total: number }) {
  const last = Math.max(0, Math.ceil(total / size) - 1);
  const href = (next: number) => { const params = new URLSearchParams(filters); params.set("page", String(next)); return `${path}?${params}`; };
  const button = "inline-flex items-center gap-1 rounded-md border border-[#e0e3e6] px-2.5 py-1.5 text-xs hover:bg-[#f7f8f9]";
  return <nav aria-label="Results pages" className="flex shrink-0 items-center justify-between border-t border-[#e5e7eb] px-4 py-2.5 text-xs text-[#697078]"><span>{total ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total}` : "No records"}</span><div className="flex items-center gap-3">{page > 0 ? <Link href={href(page - 1)} className={button}><ChevronLeft className="size-3" aria-hidden />Previous</Link> : <span aria-disabled="true" className={`${button} opacity-40`}>Previous</span>}<span>Page {page + 1} of {last + 1}</span>{page < last ? <Link href={href(page + 1)} className={button}>Next<ChevronRight className="size-3" aria-hidden /></Link> : <span aria-disabled="true" className={`${button} opacity-40`}>Next</span>}</div></nav>;
}
