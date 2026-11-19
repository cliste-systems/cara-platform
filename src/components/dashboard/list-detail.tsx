import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";

import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_CARD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

/**
 * Shared master/detail layout used by Calls, Action Inbox and Contacts.
 * List on the left, detail panel on the right; stacks on small screens with a
 * capped list height so the detail pane stays usable on phones.
 */
export function ListDetailLayout({
  list,
  detail,
  className,
  mobileDetailOpen,
  onMobileBack,
  hideDetail = false,
}: {
  hideDetail?: boolean;
  mobileDetailOpen?: boolean;
  onMobileBack?: () => void;
  list: ReactNode;
  detail: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden max-lg:grid-rows-[minmax(0,42vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,420px)] lg:grid-rows-[minmax(0,1fr)] lg:gap-4",
        className,
        mobileDetailOpen !== undefined && "max-lg:grid-rows-[minmax(0,1fr)]",
        hideDetail && "grid-cols-1 grid-rows-1 lg:grid-cols-1 xl:grid-cols-1",
      )}
    >
      <div className={cn("flex min-h-0 flex-col overflow-hidden", mobileDetailOpen && "max-lg:hidden")}>{list}</div>
      {!hideDetail && <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", mobileDetailOpen === false && "max-lg:hidden")}>
        {mobileDetailOpen && onMobileBack && <button type="button" onClick={onMobileBack} className="m-3 inline-flex min-h-11 shrink-0 cursor-pointer items-center self-start rounded-lg border border-[#d9e2dd] bg-white px-4 text-sm font-medium transition-colors hover:bg-[#f0f4f1] lg:hidden">← Back to list</button>}
        {detail}
      </div>}
    </div>
  );
}

/** Surfaced card column for the detail pane. */
export function DetailPanelShell({
  children,
  surface = "default",
  className,
  layout = "flex",
}: {
  children: ReactNode;
  /** `home` — same card chrome as `/dashboard` panels. */
  /** `embedded` — inside a split pane; no outer border or shadow. */
  surface?: "default" | "home" | "embedded";
  className?: string;
  /** `grid` keeps a sticky header/footer with a scrollable middle row. */
  layout?: "flex" | "grid";
}) {
  return (
    <section
      className={cn(
        "h-full min-h-0 overflow-hidden",
        layout === "grid"
          ? "grid grid-rows-[auto_minmax(0,1fr)_auto]"
          : "flex flex-col",
        surface === "embedded" && "bg-[#fbfcfb]",
        surface === "home" && DASHBOARD_HOME_CARD,
        surface === "default" && DASHBOARD_CARD_SURFACE,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DetailPanelHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  badges,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-[#dfe7e2] bg-[#f6faf7] px-5 py-5">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6b7c75] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-[#11181d]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[13px] text-[#5b6b65]">{subtitle}</p>
      ) : null}
      {meta ? <p className="mt-1 text-[12px] text-[#6b7c75]">{meta}</p> : null}
      {badges ? <div className="mt-4 flex flex-wrap gap-2">{badges}</div> : null}
    </div>
  );
}

export function DetailPanelBody({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain bg-[#fbfcfb] px-5 py-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailPanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#dfe7e2] bg-[#f6faf7] px-5 py-4">
      {children}
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-[#6b7c75] uppercase">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Flat section row — label + content with a bottom divider (no nested card). */
export function DetailSectionRow({
  title,
  children,
  className,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("border-b border-[#eef3f0] px-5 py-3.5 last:border-b-0", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
        {title}
      </h3>
      <div className={cn("mt-2", contentClassName)}>{children}</div>
    </section>
  );
}

/** Collapsible section using native details/summary. */
export function DetailCollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className={cn(
        "group border-b border-[#eef3f0] px-5 py-3 last:border-b-0",
        className,
      )}
    >
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <ChevronIcon />
          {title}
        </span>
      </summary>
      <div className={cn("mt-2 pb-1", contentClassName)}>{children}</div>
    </details>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="size-3.5 shrink-0 text-[#94a3b8] transition-transform group-open:rotate-90"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Bordered section card for scan-friendly detail panes (Calls, inbox, etc.). */
export function DetailSectionCard({
  title,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[#dfe7e2] bg-white shadow-[0_1px_0_rgba(17,24,29,0.04)]",
        className,
      )}
    >
      <div className="border-b border-[#eef3f0] bg-[#fbfcfb] px-4 py-2.5">
        <h3 className="text-[12px] font-semibold text-[#11181d]">{title}</h3>
      </div>
      <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Inset surface used inside detail sections (follow-ups, transcripts). */
export function DetailInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#d9e2dd] bg-white p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DetailActionButton({
  children,
  onClick,
  href,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Use "submit" inside a <form action={...}>. */
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = cn(
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#b9c8c1] bg-[#fbfcfb] px-3 text-[13px] font-medium text-[#35443f] transition-colors hover:bg-white",
    disabled && "pointer-events-none opacity-40",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}
