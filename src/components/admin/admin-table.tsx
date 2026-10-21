/** Shared admin data-table styling (matches Customers page). */

import { cn } from "@/lib/utils";

/** Natural column sizing — content stays readable; card scrolls on very narrow viewports. */
export const adminTableClass = "w-full min-w-[900px] table-auto border-collapse text-left text-sm text-[#353d42]";

export const adminTableHeadClass =
  "sticky top-0 z-10 border-b border-[#e0e3e6] bg-[#f7f8f9]";

export const adminTableThClass =
  "whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-[#697078]";

export const adminTableThDateClass = cn(
  adminTableThClass,
  "w-0",
);

export const adminTableThActionsClass = cn(
  adminTableThClass,
  "text-right",
);

export const adminTableBodyClass =
  "[&_tr]:border-b [&_tr]:border-[#e5e7eb] [&_tr:last-child]:border-0";

export const adminTableTdClass = "px-4 py-3 align-middle";

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
  "transition-colors hover:bg-[#f5f6f7]";

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
