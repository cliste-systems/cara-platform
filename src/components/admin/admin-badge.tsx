import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Neutral admin pill for status-like values. */
export const adminBadgeClass =
  "inline-flex items-center rounded-md border border-[#d9e2dd] bg-[#f6faf7] px-2.5 py-1 text-xs font-semibold text-[#4d5f58]";

/** Plain label — no pill box, easier to scan in dense tables. */
export const adminTableLabelClass = "text-sm font-medium text-gray-800";

/** Secondary table text (niche, metadata). */
export const adminTableMutedClass = "text-sm text-gray-500";

type AdminBadgeTone = "neutral" | "danger" | "warning" | "success";

const adminBadgeToneClass: Record<AdminBadgeTone, string> = {
  neutral: adminBadgeClass,
  success: "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800",
  warning: "inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800",
  danger: "inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800",
};

type AdminBadgeProps = {
  children: ReactNode;
  className?: string;
  /** plain = text only; badge = outlined pill (default). */
  variant?: "badge" | "plain";
  tone?: AdminBadgeTone;
};

export function AdminBadge({
  children,
  className,
  variant = "badge",
  tone = "neutral",
}: AdminBadgeProps) {
  if (variant === "plain") {
    return (
      <span
        className={cn(
          adminTableLabelClass,
          tone === "danger" && "text-red-800",
          tone === "warning" && "text-amber-800",
          tone === "success" && "text-emerald-800",
          className,
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={cn(adminBadgeToneClass[tone], className)}>{children}</span>
  );
}
