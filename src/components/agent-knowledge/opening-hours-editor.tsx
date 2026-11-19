"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  DAY_KEYS,
  DAY_LABELS_SHORT,
  defaultBankHolidayConfig,
  open24_7WeekSchedule,
  type BankHolidayConfig,
  type DayKey,
  type WeekSchedule,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";
import { BankHolidaysEditor } from "@/components/agent-knowledge/bank-holidays-editor";
import {
  HoursPanelReveal,
  HoursTimeReveal,
} from "@/components/agent-knowledge/hours-time-reveal";
import { cn } from "@/lib/utils";

type Variant = "onboarding" | "dashboard";

type Props = {
  value: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
  open24_7?: boolean;
  onOpen24_7Change?: (next: boolean) => void;
  bankHolidays?: BankHolidayConfig;
  onBankHolidaysChange?: (next: BankHolidayConfig) => void;
  hoursNeverConfigured?: boolean;
  variant?: Variant;
  embedded?: boolean;
  compact?: boolean;
  className?: string;
};

const timeClass =
  "h-11 min-w-0 w-0 flex-1 rounded-lg border border-slate-200/90 bg-white px-2 text-[13px] text-[#0b1220] shadow-sm outline-none focus-visible:border-[#0b1220]/30 focus-visible:ring-2 focus-visible:ring-[#0b1220]/10";

const NOTICE_ATTENTION =
  "rounded-lg border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-[12.5px] leading-relaxed text-[#0b1220]/90";

export function OpeningHoursEditor({
  value,
  onChange,
  open24_7 = false,
  onOpen24_7Change,
  bankHolidays = defaultBankHolidayConfig(),
  onBankHolidaysChange,
  hoursNeverConfigured = false,
  variant = "onboarding",
  embedded = false,
  compact = false,
  className,
}: Props) {
  void variant;
  const [selectedDay, setSelectedDay] = useState<DayKey>("monday");
  const [bankHolidaysOpen, setBankHolidaysOpen] = useState(false);
  const selected = value[selectedDay];
  const noOpenDays = !open24_7 && !weekScheduleHasOpenDay(value);

  function updateDay(day: DayKey, patch: Partial<WeekSchedule[DayKey]>) {
    onChange({
      ...value,
      [day]: { ...value[day], ...patch },
    });
  }

  function toggle24_7(checked: boolean) {
    onOpen24_7Change?.(checked);
    if (checked) {
      onChange(open24_7WeekSchedule());
    }
  }

  const hoursNotice =
    hoursNeverConfigured && noOpenDays
      ? "No opening days set yet — pick a day below and mark it open."
      : !open24_7 && noOpenDays && !hoursNeverConfigured
        ? "No opening days set — Cara will tell callers you're closed all week."
        : null;

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3", className)}>
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700">
          <input
            type="checkbox"
            checked={open24_7}
            onChange={(event) => toggle24_7(event.target.checked)}
            className="size-4 cursor-pointer rounded border-slate-300 accent-[#0b1220] text-[#0b1220]"
          />
          Open 24 hours, 7 days
        </label>
      </div>

      <HoursPanelReveal show={Boolean(hoursNotice)} maxHeightClass="max-h-24">
        <p className={NOTICE_ATTENTION}>{hoursNotice}</p>
      </HoursPanelReveal>

      <HoursPanelReveal show={!open24_7} maxHeightClass="max-h-64">
        <div className="space-y-2 pb-0.5 pt-0.5">
          <div
            className="grid grid-cols-7 gap-1"
            role="tablist"
            aria-label="Days of the week"
          >
            {DAY_KEYS.map((day) => {
              const active = selectedDay === day;
              const open = value[day].open;
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-lg px-1 py-1.5 text-center text-[11px] font-medium transition-colors duration-200 sm:text-[12px]",
                    active
                      ? "bg-[#0b1220] text-white"
                      : open
                        ? "border border-slate-200 bg-white text-[#0b1220]"
                        : "border border-slate-200/70 bg-slate-50 text-slate-500",
                  )}
                >
                  {DAY_LABELS_SHORT[day]}
                </button>
              );
            })}
          </div>

          <div
            className={cn(
              "mt-2 rounded-xl px-3 py-3",
              embedded
                ? "bg-slate-50/90"
                : "border border-slate-200/90 bg-white shadow-sm",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[13px] font-medium text-[#0b1220]">
                <input
                  type="checkbox"
                  checked={selected.open}
                  onChange={(event) =>
                    updateDay(selectedDay, { open: event.target.checked })
                  }
                  className="size-4 cursor-pointer rounded border-slate-300 accent-[#0b1220] text-[#0b1220]"
                />
                Open on {DAY_LABELS_SHORT[selectedDay]}
              </label>
              <HoursTimeReveal open={selected.open} className="sm:flex-1">
                <input
                  type="time"
                  value={selected.start}
                  onChange={(event) =>
                    updateDay(selectedDay, { start: event.target.value })
                  }
                  className={timeClass}
                  aria-label={`${DAY_LABELS_SHORT[selectedDay]} opens`}
                />
                <span className="shrink-0 text-[12px] text-slate-400">–</span>
                <input
                  type="time"
                  value={selected.end}
                  onChange={(event) =>
                    updateDay(selectedDay, { end: event.target.value })
                  }
                  className={timeClass}
                  aria-label={`${DAY_LABELS_SHORT[selectedDay]} closes`}
                />
              </HoursTimeReveal>
            </div>
          </div>
        </div>
      </HoursPanelReveal>

      {onBankHolidaysChange ? (
        compact ? (
          <div className="rounded-lg bg-slate-50/80">
            <button
              type="button"
              onClick={() => setBankHolidaysOpen((open) => !open)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-[12.5px] font-medium text-slate-700"
            >
              <span>
                Bank &amp; public holidays
                <span className="ml-1 font-normal text-slate-500">(optional)</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-slate-400 transition-transform duration-200",
                  bankHolidaysOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <HoursPanelReveal show={bankHolidaysOpen} maxHeightClass="max-h-48">
              <div className="px-3 pb-3">
                <BankHolidaysEditor
                  value={bankHolidays}
                  onChange={onBankHolidaysChange}
                  embedded
                  hideHeading
                />
              </div>
            </HoursPanelReveal>
          </div>
        ) : (
          <BankHolidaysEditor
            value={bankHolidays}
            onChange={onBankHolidaysChange}
            embedded={embedded}
          />
        )
      ) : null}
    </div>
  );
}
