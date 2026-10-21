import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
export const ADMIN_PAGE_X_PADDING = "px-6";
type Props = { icon: IconType; title: string; description?: ReactNode; actions?: ReactNode; maxWidth?: "full" | "6xl" | "3xl"; backHref?: string; backLabel?: string; children: ReactNode; className?: string; fillViewport?: boolean; compact?: boolean };
export function AdminPageShell({ icon: Icon, title, description, actions, backHref, backLabel, children, className, fillViewport = true, compact = false }: Props) {
  return <div data-admin-fill={fillViewport || undefined} className={cn("admin-page mx-auto flex w-full min-w-0 flex-col gap-4 px-4 py-5 sm:px-6", fillViewport && "min-h-0 flex-1 overflow-hidden", compact && "gap-3 py-4", className)}>
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {backHref ? <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs text-[#697078] hover:text-[#11181d]"><ChevronLeft className="size-3.5" aria-hidden />{backLabel || "Back"}</Link> : null}
        <h1 className="flex items-center gap-2.5 text-[26px] font-semibold leading-tight tracking-tight text-[#11181d]"><Icon className="size-5 shrink-0 text-[#697078]" aria-hidden />{title}</h1>
        {description ? <div className="mt-1.5 text-[13px] leading-5 text-[#697078]">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
    <div className={cn("admin-page-content flex min-h-0 min-w-0 flex-1 flex-col gap-4", fillViewport && "overflow-y-auto")}>{children}</div>
  </div>;
}
export function AdminPageEmptyState({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("rounded-lg border border-[#e0e3e6] bg-white px-5 py-10 text-center text-sm text-[#697078]", className)}>{children}</div>; }
export function AdminErrorCard({ message, hint }: { message: string; hint?: ReactNode }) { return <div role="alert" className="shrink-0 rounded-lg border border-red-200 bg-white p-4"><p className="text-sm font-medium text-red-700">{message}</p>{hint ? <div className="mt-2 text-xs text-[#697078]">{hint}</div> : null}</div>; }
