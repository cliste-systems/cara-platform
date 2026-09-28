import { cn } from "@/lib/utils";

/** Pointer on interactive admin controls; not-allowed when disabled. */
export const adminInteractiveDisabledClass =
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Text links in admin tables and copy. */
export const adminTextLinkClass =
  "cursor-pointer font-medium underline-offset-2 hover:underline";

/** Muted navigation links (back links, breadcrumbs). */
export const adminMutedLinkClass =
  "cursor-pointer inline-flex items-center gap-1 text-sm font-medium text-[#6b7c75] hover:text-[#11181d]";

/** Sidebar and shell navigation links. */
export const adminNavLinkBaseClass =
  "cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40";

/** Segmented tab buttons (in-page toggles, not route links). */
export const adminSegmentedTabButtonClass =
  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

/** Primary filled action button used across admin pages. */
export const adminPrimaryButtonClass = cn(
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#353d42] bg-[#353d42] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#11181d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42] focus-visible:ring-offset-2",
  adminInteractiveDisabledClass,
);

/** Secondary outline action button used across admin pages. */
export const adminSecondaryButtonClass = cn(
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#cfd9d4] bg-[#fbfcfb] px-3.5 py-2 text-sm font-semibold text-[#35443f] shadow-sm transition-colors hover:border-[#a9b9b1] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42] focus-visible:ring-offset-2",
  adminInteractiveDisabledClass,
);

/** Destructive outline action button. */
export const adminDestructiveButtonClass = cn(
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2",
  adminInteractiveDisabledClass,
);

/** Icon-only menu trigger (e.g. row actions). */
export const adminIconButtonClass =
  "inline-flex cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0b1220]";

/** Clickable table row (whole row is the hit target). */
export const adminClickableTableRowClass =
  "cursor-pointer transition-colors hover:bg-gray-100/70";
