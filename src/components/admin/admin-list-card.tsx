import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AdminSectionCard } from "./admin-section-card";

type AdminListCardProps = {
  countLabel: ReactNode;
  toolbar?: ReactNode;
  stats?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Grow to fill remaining viewport below the page header. Default false. */
  fillRemaining?: boolean;
};

export function AdminListCard({
  countLabel,
  toolbar,
  stats,
  banner,
  children,
  className,
  fillRemaining = false,
}: AdminListCardProps) {
  return (
    <AdminSectionCard
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        fillRemaining && "flex-1",
        className,
      )}
      contentClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <header className="flex min-w-0 shrink-0 flex-col gap-3 border-b border-[#e3e9e5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="shrink-0 text-sm font-semibold text-[#35443f]">{countLabel}</p>
        {toolbar ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            {toolbar}
          </div>
        ) : null}
      </header>
      {stats ? (
        <div className="shrink-0 border-b border-[#e3e9e5] px-5 py-4">
          {stats}
        </div>
      ) : null}
      {banner ? (
        <div className="shrink-0 border-b border-[#e3e9e5] px-5 py-4">
          {banner}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {children}
      </div>
    </AdminSectionCard>
  );
}
