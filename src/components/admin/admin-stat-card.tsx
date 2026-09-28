import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  muted?: boolean;
  tone?: "neutral" | "danger" | "warning" | "success";
  icon?: LucideIcon;
  href?: string;
  className?: string;
};

export function AdminStatCard({
  label,
  value,
  muted,
  tone = "neutral",
  icon: Icon,
  href,
  className,
}: AdminStatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.11em] text-[#6b7c75] uppercase">
          {label}
        </p>
        {Icon ? <Icon className="size-4 shrink-0 text-[#8b9c94]" strokeWidth={1.6} aria-hidden /> : null}
      </div>
      <p
        className={cn(
          "mt-3 break-words text-[25px] font-semibold leading-tight tracking-tight tabular-nums",
          muted && "text-gray-500",
          !muted && tone === "neutral" && "text-gray-900",
          !muted && tone === "danger" && "text-red-700",
          !muted && tone === "warning" && "text-amber-700",
          !muted && tone === "success" && "text-emerald-700",
        )}
      >
        {value}
      </p>
    </>
  );

  const surfaceClass = cn(
    "min-w-0 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-4 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.28)] sm:p-5",
    href && "cursor-pointer transition-colors hover:border-[#a9b9b1] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]",
    className,
  );

  return href ? <Link href={href} className={surfaceClass}>{content}</Link> : <div className={surfaceClass}>{content}</div>;
}
