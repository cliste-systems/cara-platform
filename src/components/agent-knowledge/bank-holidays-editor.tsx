"use client";

import {
  defaultBankHolidayConfig,
  type BankHolidayConfig,
} from "@/lib/business-hours";
import { cn } from "@/lib/utils";

type BankHolidayMode = "not_set" | "usual" | "closed" | "open";

type Props = {
  value: BankHolidayConfig;
  onChange: (next: BankHolidayConfig) => void;
  embedded?: boolean;
  hideHeading?: boolean;
  className?: string;
};

const timeClass =
  "h-9 min-w-0 flex-1 rounded-lg border border-slate-200/90 bg-white px-2 text-[13px] text-[#0b1220] shadow-sm outline-none focus-visible:border-[#0b1220]/30 focus-visible:ring-2 focus-visible:ring-[#0b1220]/10";

const MODE_OPTIONS: { id: BankHolidayMode; label: string }[] = [
  { id: "not_set", label: "Not set" },
  { id: "usual", label: "Usual hours" },
  { id: "closed", label: "Closed" },
  { id: "open", label: "Open" },
];

function modeFromConfig(config: BankHolidayConfig): BankHolidayMode {
  if (!config.configured) return "not_set";
  if (config.usualHours) return "usual";
  return config.open ? "open" : "closed";
}

function configFromMode(
  mode: BankHolidayMode,
  current: BankHolidayConfig,
): BankHolidayConfig {
  const defaults = defaultBankHolidayConfig();
  if (mode === "not_set") return defaultBankHolidayConfig();
  if (mode === "usual") return {...current, configured:true, usualHours:true, open:true};
  if (mode === "closed") {
    return {
      configured: true,
      usualHours: false,
      open: false,
      start: current.start || defaults.start,
      end: current.end || defaults.end,
    };
  }
  return {
    configured: true,
    usualHours: false,
    open: true,
    start: current.start || defaults.start,
    end: current.end || defaults.end,
  };
}

export function BankHolidaysEditor({
  value,
  onChange,
  embedded = false,
  hideHeading = false,
  className,
}: Props) {
  const mode = modeFromConfig(value);

  function setMode(next: BankHolidayMode) {
    onChange(configFromMode(next, value));
  }

  function update(patch: Partial<BankHolidayConfig>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {hideHeading ? null : (
        <div>
          <p className="text-[13px] font-medium text-slate-800">
            Bank &amp; public holidays
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
            One rule for all bank and public holidays.
          </p>
        </div>
      )}

      <div
        className={cn(
          "rounded-xl px-3 py-3",
          embedded
            ? "bg-slate-50/90"
            : "border border-slate-200/90 bg-white shadow-sm",
        )}
      >
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Bank and public holiday rule"
        >
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(option.id)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-[#0b1220] text-white"
                    : "border border-slate-200 bg-white text-[#0b1220]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-3 min-h-12">
          {mode === "not_set" ? (
            <p className="animate-in text-[12.5px] text-slate-500 fade-in duration-200 motion-reduce:animate-none">
              Cara won&apos;t mention bank holidays unless callers ask — choose
              Closed or Open to set a rule.
            </p>
          ) : null}

          {mode === "usual" && <p className="text-[12.5px] text-slate-600">Cara will use your usual weekly hours on bank and public holidays.</p>}
          {mode === "closed" ? (
            <p className="animate-in text-[12.5px] text-slate-600 fade-in duration-200 motion-reduce:animate-none">
              Cara will say you&apos;re closed on bank and public holidays.
            </p>
          ) : null}

          {mode === "open" ? (
            <div className="animate-in flex flex-nowrap items-center gap-3 fade-in duration-200 motion-reduce:animate-none">
              <span className="text-[13px] text-[#0b1220]">Open hours</span>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  type="time"
                  value={value.start}
                  onChange={(event) => update({ start: event.target.value })}
                  className={timeClass}
                  aria-label="Bank holiday opening time"
                />
                <span className="shrink-0 text-[12px] text-slate-400">–</span>
                <input
                  type="time"
                  value={value.end}
                  onChange={(event) => update({ end: event.target.value })}
                  className={timeClass}
                  aria-label="Bank holiday closing time"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
