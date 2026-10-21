import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type AdminStatCardProps = {
  label: string;
  hint?: ReactNode;
  value: ReactNode;
  muted?: boolean;
  tone?: "neutral" | "danger" | "warning" | "success";
  icon?: LucideIcon;
  href?: string;
  className?: string;
};

export function AdminStatCard({
  label,
  hint,
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
        <p className="text-[13px] font-medium text-[#697078]">
          {label}
        </p>
        {Icon ? <Icon className="size-4 shrink-0 text-[#8a9198]" strokeWidth={1.6} aria-hidden /> : null}
      </div>
      <p
        className={cn(
          "mt-2 break-words text-[28px] font-semibold leading-tight tracking-tight tabular-nums",
          muted && "text-gray-500",
          !muted && tone === "neutral" && "text-gray-900",
          !muted && tone === "danger" && "text-red-700",
          !muted && tone === "warning" && "text-amber-700",
          !muted && tone === "success" && "text-gray-900",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] leading-4 text-[#697078]">{hint}</p> : null}
    </>
  );

  const surfaceClass = cn(
    "min-w-0 rounded-lg border border-[#e0e3e6] bg-[#ffffff] px-4 py-3",
    href && "cursor-pointer transition-colors hover:border-[#aeb5bb] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]",
    className,
  );

  return href ? <Link href={href} className={surfaceClass}>{content}</Link> : <div className={surfaceClass}>{content}</div>;
}
