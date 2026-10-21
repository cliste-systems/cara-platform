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
  /** Grow to fill remaining viewport below the page header. Default true. */
  fillRemaining?: boolean;
};

export function AdminListCard({
  countLabel,
  toolbar,
  stats,
  banner,
  children,
  className,
  fillRemaining = true,
}: AdminListCardProps) {
  return (
    <AdminSectionCard
      className={cn(
        "admin-list flex min-h-0 min-w-0 flex-col",
        fillRemaining && "flex-1",
        className,
      )}
      contentClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <header className="flex min-w-0 shrink-0 gap-3 border-b border-[#e5e7eb] px-5 py-4 flex-col items-start justify-between sm:flex-row sm:items-center">
        <p className="shrink-0 text-sm font-semibold text-[#353d42]">{countLabel}</p>
        {toolbar ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            {toolbar}
          </div>
        ) : null}
      </header>
      {stats ? (
        <div className="shrink-0 border-b border-[#e5e7eb] px-5 py-4">
          {stats}
        </div>
      ) : null}
      {banner ? (
        <div className="shrink-0 border-b border-[#e5e7eb] px-5 py-4">
          {banner}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {children}
      </div>
    </AdminSectionCard>
  );
}
