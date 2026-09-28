"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AdminGlobalMetricPeriod } from "@/lib/admin-metric-range";
import { adminSegmentedTabButtonClass } from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AdminGlobalMetricPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export function AdminMetricRangeToggle({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("period");
  const current: AdminGlobalMetricPeriod =
    raw === "week" || raw === "month" ? raw : "day";
  const isDark = variant === "dark";

  function setPeriod(next: AdminGlobalMetricPeriod) {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "day") {
      q.delete("period");
    } else {
      q.set("period", next);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg p-1",
        isDark
          ? "border border-white/15 bg-white/10"
          : "border border-[#d9e2dd] bg-white/80 shadow-sm",
      )}
      role="group"
      aria-label="Global metrics time range"
    >
      {OPTIONS.map(({ value, label }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={cn(
              adminSegmentedTabButtonClass,
              "rounded-md px-3.5 py-1.5 text-xs",
              isDark
                ? active
                  ? "bg-white text-[#0b1220] shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
                : active
                  ? "bg-[#353d42] text-white shadow-sm"
                  : "text-[#5f6f68] hover:bg-[#f3f6f4] hover:text-[#11181d]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
