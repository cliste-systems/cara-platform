"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  subMonths,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import {
  callsPageCalendarDays,
  formatCallsPageDateParam,
  isCallsPageToday,
  parseCallsPageDateParam,
} from "@/lib/calls-page-date";
import { cn } from "@/lib/utils";

const DUBLIN = "Europe/Dublin";
const POPOVER_WIDTH = 300;
const VIEWPORT_PADDING = 16;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatPickerLabel(date: Date, isToday: boolean): string {
  if (isToday) return "Today";

  return new Intl.DateTimeFormat("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: DUBLIN,
  }).format(date);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IE", {
    month: "long",
    year: "numeric",
    timeZone: DUBLIN,
  }).format(date);
}

type PopoverPosition = {
  top: number;
  left: number;
  placement: "below" | "above";
  caretLeft: number;
};

const POPOVER_ESTIMATED_HEIGHT = 360;

function computePopoverPosition(anchor: HTMLElement, caretAnchor: HTMLElement): PopoverPosition {
  const rect = anchor.getBoundingClientRect();
  const caretRect = caretAnchor.getBoundingClientRect();
  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(rect.right - POPOVER_WIDTH, maxLeft),
  );
  const caretCenter = caretRect.left + caretRect.width / 2;
  const caretLeft = Math.max(18, Math.min(caretCenter - left - 7, POPOVER_WIDTH - 32));

  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
  const spaceAbove = rect.top - VIEWPORT_PADDING;
  const openBelow =
    spaceBelow >= POPOVER_ESTIMATED_HEIGHT || spaceBelow >= spaceAbove;

  if (openBelow) {
    return {
      top: rect.bottom + 10,
      left,
      placement: "below",
      caretLeft,
    };
  }

  return {
    top: Math.max(VIEWPORT_PADDING, rect.top - POPOVER_ESTIMATED_HEIGHT - 10),
    left,
    placement: "above",
    caretLeft,
  };
}

export function DashboardDatePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLDivElement>(null);
  const caretAnchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<PopoverPosition | null>(null);

  const now = useMemo(() => new Date(), [searchParams]);
  const selectedDate = parseCallsPageDateParam(
    searchParams.get("date") ?? undefined,
    now,
  );
  const isToday = isCallsPageToday(selectedDate, now);
  const selectedParam = formatCallsPageDateParam(selectedDate, now);
  const todayParam = formatCallsPageDateParam(now, now);

  const [viewMonth, setViewMonth] = useState(selectedDate);


  const [previousSelection, setPreviousSelection] = useState(selectedParam);
  if (previousSelection !== selectedParam) {
    setPreviousSelection(selectedParam);
    setViewMonth(selectedDate);
  }

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current || !caretAnchorRef.current) return;
    setPopoverStyle(
      computePopoverPosition(triggerRef.current, caretAnchorRef.current),
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function navigateToDate(date: Date) {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("range");
    q.delete("page");

    const param = formatCallsPageDateParam(date, now);
    const currentParam = formatCallsPageDateParam(selectedDate, now);

    // A deep-linked call only exists on its own day — clear it when browsing elsewhere.
    if (param !== currentParam) {
      q.delete("call");
    }

    if (param === todayParam) {
      q.delete("date");
    } else {
      q.set("date", param);
    }

    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    setOpen(false);
  }

  function shiftDay(delta: number) {
    navigateToDate(addDays(selectedDate, delta));
  }

  const calendarDays = callsPageCalendarDays(viewMonth);
  const viewMonthZoned = toZonedTime(viewMonth, DUBLIN);

  const popover =
    open && popoverStyle
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Choose a date"
            style={{
              position: "fixed",
              top: popoverStyle.top,
              left: popoverStyle.left,
              width: POPOVER_WIDTH,
              zIndex: 1000,
            }}
            className="relative rounded-xl border border-[#d9e2dd] bg-[#fbfcfb] shadow-[0_18px_44px_-24px_rgba(17,24,29,0.34)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute z-10 size-3.5 rotate-45 border border-[#d9e2dd] bg-[#fbfcfb]"
              style={{
                left: popoverStyle.caretLeft,
                ...(popoverStyle.placement === "below"
                  ? { top: -7 }
                  : { bottom: -7 }),
              }}
            />
            <div className="overflow-hidden rounded-xl">
            <div className="border-b border-[#e3e9e5] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#d9e2dd] text-[#64748b] transition-colors hover:bg-white hover:text-[#0b1220]"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <p className="text-[13px] font-semibold text-[#11181d]">
                  {formatMonthLabel(viewMonth)}
                </p>
                <button
                  type="button"
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  disabled={isSameMonth(viewMonthZoned, toZonedTime(now, DUBLIN))}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#d9e2dd] text-[#64748b] transition-colors hover:bg-white hover:text-[#0b1220] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next month"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="px-3 py-3">
              <div className="mb-2 grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dayParam = formatCallsPageDateParam(day, now);
                  const selected = dayParam === selectedParam;
                  const inMonth = isSameMonth(
                    toZonedTime(day, DUBLIN),
                    viewMonthZoned,
                  );
                  const isFuture = dayParam > todayParam;

                  return (
                    <button
                      key={dayParam}
                      type="button"
                      disabled={isFuture}
                      onClick={() => navigateToDate(day)}
                      className={cn(
                        "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg text-[13px] font-medium tabular-nums transition-colors",
                        selected
                          ? "bg-[#0b1220] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                          : inMonth
                            ? "text-[#11181d] hover:bg-[#eef3ef]"
                            : "text-[#cbd5e1] hover:bg-[#f8fafc]",
                        isFuture &&
                          "cursor-not-allowed opacity-35 hover:bg-transparent",
                      )}
                    >
                      {format(toZonedTime(day, DUBLIN), "d")}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isToday ? (
              <div className="border-t border-[#e3e9e5] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => navigateToDate(now)}
                  className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border border-[#d9e2dd] bg-white text-[13px] font-medium text-[#0b1220] transition-colors hover:bg-[#f6faf7]"
                >
                  Jump to today
                </button>
              </div>
            ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={triggerRef} className="inline-flex max-w-full">
        <div
          className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-[#e5eaf2] bg-white/80 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm"
          role="group"
          aria-label="Date"
        >
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0b1220]"
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>

          <button
            ref={caretAnchorRef}
            type="button"
            onClick={() => {
              updatePopoverPosition();
              setOpen((value) => !value);
            }}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors sm:px-4",
              open || !isToday
                ? "bg-[#0b1220] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(15,23,42,0.12)]"
                : "text-[#0b1220] hover:bg-[#f1f5f9]",
            )}
          >
            <Calendar className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">
              {formatPickerLabel(selectedDate, isToday)}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 opacity-70 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          <button
            type="button"
            onClick={() => shiftDay(1)}
            disabled={isToday}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0b1220] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {popover}
    </>
  );
}

/** @deprecated Use DashboardDatePicker */
export const CallsDatePicker = DashboardDatePicker;
