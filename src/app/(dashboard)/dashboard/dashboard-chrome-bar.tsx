"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DashboardVersionDisplay } from "@/lib/dashboard-versions";
import { dashboardBreadcrumbs } from "@/lib/dashboard-breadcrumbs";
import { DASHBOARD_CONTENT_COLUMN } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

import { DashboardChromeFeedback } from "./dashboard-chrome-feedback";
import { DashboardChromeSystemHealth } from "./dashboard-chrome-system-health";

const CHROME_UTILITY_PILL =
  "inline-flex h-7 max-w-full shrink-0 items-center rounded-md border border-[#d9e2dd] bg-[#fbfcfb]/90 px-2.5 text-[11px] font-medium shadow-[0_1px_0_rgba(17,24,29,0.04)]";

type DashboardChromeBarProps = {
  versionDisplay: DashboardVersionDisplay;
};

export function DashboardChromeBar({ versionDisplay }: DashboardChromeBarProps) {
  const pathname = usePathname();
  const crumbs = dashboardBreadcrumbs(pathname);

  return (
    <header className="hidden lg:block shrink-0 border-b border-[#d9e2dd] bg-[#f3f6f4]">
      <div
        className={cn(
          DASHBOARD_CONTENT_COLUMN,
          "flex h-12 items-center justify-between gap-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-[13px]"
          >
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? (
                    <ChevronRight
                      className="size-3.5 shrink-0 text-slate-300"
                      aria-hidden
                    />
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="truncate text-slate-500 transition-colors hover:text-slate-800"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "truncate",
                        isLast ? "font-medium text-[#0b1220]" : "text-slate-500",
                      )}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <DashboardChromeFeedback />
          <p
            className={cn(
              CHROME_UTILITY_PILL,
              "min-w-0 truncate tracking-wide text-slate-400 tabular-nums",
            )}
            aria-label={`${versionDisplay.experienceLine}. ${versionDisplay.caraLine}`}
          >
            <span>{versionDisplay.experienceLine}</span>
            <span className="mx-1 text-slate-300" aria-hidden>
              ·
            </span>
            <span>{versionDisplay.caraLine}</span>
          </p>
          <DashboardChromeSystemHealth />
        </div>
      </div>
    </header>
  );
}
