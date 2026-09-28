/** Shared admin data-table styling (matches Customers page). */

import { cn } from "@/lib/utils";

/** Natural column sizing — content stays readable; card scrolls on very narrow viewports. */
export const adminTableClass = "w-full min-w-[900px] table-auto border-collapse text-left text-sm text-[#35443f]";

export const adminTableHeadClass =
  "sticky top-0 z-10 border-b border-[#d9e2dd] bg-[#f6faf7]";

export const adminTableThClass =
  "whitespace-nowrap px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7c75]";

export const adminTableThDateClass = cn(
  adminTableThClass,
  "w-0",
);

export const adminTableThActionsClass = cn(
  adminTableThClass,
  "text-right",
);

export const adminTableBodyClass =
  "[&_tr]:border-b [&_tr]:border-[#e9efeb] [&_tr:last-child]:border-0";

export const adminTableTdClass = "px-5 py-3.5 align-middle";

/** Optional helper for long free-text cells (e.g. message previews). */
export const adminTableTdTruncateClass = cn(
  adminTableTdClass,
  "max-w-md truncate",
);

export const adminTableTdDateClass = cn(
  adminTableTdClass,
  "w-0 whitespace-nowrap text-sm tabular-nums text-gray-500",
);

export const adminTableRowClass =
  "transition-colors hover:bg-[#f3f6f4]";

export const adminTableEmptyClass =
  "px-4 py-16 text-center text-sm text-gray-500";

export function cellOrBlank(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function adminTableThWidth(width: string): string {
  return cn(adminTableThClass, width);
}

export function adminTableThWidthRight(width: string): string {
  return cn(adminTableThClass, width, "text-right");
}
