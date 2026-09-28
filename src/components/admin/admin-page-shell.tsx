import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { adminMutedLinkClass } from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type AdminPageShellMaxWidth = "full" | "6xl" | "3xl";

const MAX_WIDTH_CLASS: Record<AdminPageShellMaxWidth, string> = {
  full: "max-w-[1600px]",
  "6xl": "max-w-[1600px]",
  "3xl": "max-w-[1600px]",
};

/** Shared horizontal padding for all admin pages. */
export const ADMIN_PAGE_X_PADDING = "px-4 sm:px-6 xl:px-8";

type AdminPageShellProps = {
  icon: IconType;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  maxWidth?: AdminPageShellMaxWidth;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  className?: string;
  /** Lock page to viewport height (pairs with AdminListCard). */
  fillViewport?: boolean;
  compact?: boolean;
};

export function AdminPageShell({
  icon: Icon,
  title,
  description,
  actions,
  maxWidth = "full",
  backHref,
  backLabel,
  children,
  className,
  fillViewport = false,
  compact = false,
}: AdminPageShellProps) {
  return (
    <div
      {...(fillViewport ? { "data-admin-fill": true } : {})}
      className={cn(
        "mx-auto w-full min-w-0",
        ADMIN_PAGE_X_PADDING,
        fillViewport
          ? "flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden py-5 sm:py-6 lg:overflow-hidden"
          : "space-y-5 overflow-x-hidden py-5 sm:py-6",
        MAX_WIDTH_CLASS[maxWidth],
        compact && "gap-3 py-3 sm:py-4",
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className={cn(adminMutedLinkClass, "shrink-0")}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel ?? "Back"}
        </Link>
      ) : null}

      <header
        className={cn("relative flex shrink-0 flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-[#d9e2dd] bg-[#e7ede9] px-5 py-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.26)] sm:px-6 sm:py-6", compact && "py-3 sm:py-3")}
      >
        <div className="relative min-w-0">
          <h1 className="flex items-center gap-3 text-[24px] font-semibold leading-tight tracking-tight text-[#11181d] sm:text-[28px]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#cfd9d4] bg-white/80 text-[#353d42]"><Icon className="size-[18px]" aria-hidden /></span>
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-[#5f6f68]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="relative flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      {fillViewport ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

export function AdminPageEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-[#cfd9d4] bg-[#f6faf7] px-5 py-10 text-center text-sm text-[#6b7c75]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminErrorCard({
  message,
  hint,
}: {
  message: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-red-200/80 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-red-700">{message}</p>
      {hint ? <div className="mt-2 text-sm text-red-600/90">{hint}</div> : null}
    </div>
  );
}
