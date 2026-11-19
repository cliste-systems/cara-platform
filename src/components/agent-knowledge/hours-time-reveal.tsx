"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const REVEAL_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const REVEAL_MS = "duration-200";

type HoursTimeRevealProps = {
  open: boolean;
  children: ReactNode;
  closedLabel?: string;
  className?: string;
};

/**
 * Crossfade between closed label and time inputs inside a fixed-height slot
 * so the parent row does not jump or glitch while toggling.
 */
export function HoursTimeReveal({
  open,
  children,
  closedLabel = "Closed",
  className,
}: HoursTimeRevealProps) {
  return (
    <div className={cn("relative h-11 min-h-11 min-w-0 flex-none sm:flex-1", className)}>
      <div
        className={cn(
          "absolute inset-0 flex min-w-0 items-center gap-1.5 motion-reduce:transition-none",
          REVEAL_MS,
          "transition-opacity ease-out",
          open
            ? "z-10 opacity-100"
            : "pointer-events-none z-0 opacity-0",
        )}
        aria-hidden={!open}
        inert={!open}
      >
        {children}
      </div>
      <div
        className={cn(
          "absolute inset-0 flex items-center motion-reduce:transition-none",
          REVEAL_MS,
          "transition-opacity ease-out",
          open
            ? "pointer-events-none z-0 opacity-0"
            : "z-10 opacity-100",
        )}
        aria-hidden={open}
      >
        <span className="text-[13px] text-slate-400">{closedLabel}</span>
      </div>
    </div>
  );
}

type HoursPanelRevealProps = {
  show: boolean;
  children: ReactNode;
  className?: string;
  /** Must exceed the panel content height to avoid clipping. */
  maxHeightClass?: string;
};

/** Smooth reveal for single-line panels below a tab row. */
export function HoursPanelReveal({
  show,
  children,
  className,
  maxHeightClass: _maxHeightClass,
}: HoursPanelRevealProps) {
  return (
    <div
      className={cn(
        "grid motion-reduce:transition-none",
        REVEAL_MS,
        "transition-[grid-template-rows,opacity]",
        show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 !m-0",
        className,
      )}
      style={{ transitionTimingFunction: REVEAL_EASE }}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
