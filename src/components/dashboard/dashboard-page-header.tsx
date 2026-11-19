import type { ComponentType, ReactNode } from "react";

import {
  DashboardInlineSummary,
  type InlineSummarySegment,
} from "@/components/dashboard/dashboard-inline-summary";
import {
  DASHBOARD_BODY_CLASS,
  DASHBOARD_EYEBROW_CLASS,
  DASHBOARD_ICON_CHIP_HEADER,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_TITLE_CLASS,
  type AccentTone,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type DashboardPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  descriptionLine2?: string;
  /** Optional icon chip (always neutral slate). */
  icon?: IconType;
  /** @deprecated Ignored — icons use one shared colour. */
  accent?: AccentTone;
  actions?: ReactNode;
  /** One-line stats, aligned under the description copy. */
  summary?: InlineSummarySegment[];
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  descriptionLine2,
  icon: Icon,
  accent: _accent = "slate",
  actions,
  summary,
}: DashboardPageHeaderProps) {
  return (
    <header className="dashboard-page-heading flex shrink-0 flex-col gap-3 border-b border-[#d9e2dd] pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 max-w-2xl items-start gap-3.5">
        {Icon ? (
          <span className={cn(DASHBOARD_ICON_CHIP_HEADER, "hidden")}>
            <Icon className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className={cn(DASHBOARD_EYEBROW_CLASS, "sr-only")}>{eyebrow}</p>
          <h1 className={DASHBOARD_TITLE_CLASS}>{title}</h1>
          <p className={cn("mt-2", DASHBOARD_BODY_CLASS)}>{description}</p>
          {descriptionLine2 ? (
            <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
              {descriptionLine2}
            </p>
          ) : null}
          {summary && summary.length > 0 ? (
            <DashboardInlineSummary className="mt-2" segments={summary} />
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="dashboard-heading-actions flex shrink-0 items-center sm:pt-0.5">{actions}</div>
      ) : null}
    </header>
  );
}
