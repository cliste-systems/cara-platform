"use client";
import { createElement } from "react";


import Link from "next/link";
import { ChevronRight, Loader2, Phone, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { dashboardHomeLayoutTransition } from "@/components/dashboard/dashboard-home-resize-motion";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";

import {
  DASHBOARD_HOME_FIRST_ROW_LIST_CHEVRON,
  DASHBOARD_HOME_FIRST_ROW_LIST_HOVER,
  DASHBOARD_HOME_HERO_GREY,
  DASHBOARD_HOME_LIVE_CALL_ROW_CLASS,
  DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS,
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  retailDepartmentHomeIcon,
  RETAIL_DEPARTMENT_HOME_ICON_CHIP,
} from "@/lib/retail-department-home-icon";
import type { RetailDepartmentSlug } from "@/lib/retail-department-pack";
import { cn } from "@/lib/utils";

/** Shared layout tokens for the three first-row home cards. */

export const HOME_FIRST_ROW_HEADER =
  "mb-2.5 flex w-full shrink-0 items-center justify-between gap-2 border-b border-[#e3e9e5] pb-2";

export const HOME_FIRST_ROW_HEADER_EMBEDDED =
  "flex w-full shrink-0 items-center justify-between gap-2 px-4 py-3.5";

export const HOME_FIRST_ROW_BODY_EMBEDDED =
  "flex min-h-0 flex-1 flex-col bg-[#fbfcfb] px-3 py-2.5";

export const HOME_FIRST_ROW_TITLE =
  "text-[15px] font-semibold leading-none tracking-tight text-[#0b1220]";

export const HOME_FIRST_ROW_COUNT_BADGE =
  "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-[#d6dfda] bg-white px-1.5 text-[11px] font-semibold leading-none tabular-nums text-slate-600";

export const HOME_FIRST_ROW_HEADER_META =
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-[#d6dfda] bg-white px-2.5 text-[11px] font-medium leading-none text-slate-600";

export const HOME_FIRST_ROW_LIST_TITLE =
  "block truncate text-[13px] font-semibold leading-snug text-[#0b1220]";

export const HOME_FIRST_ROW_LIST_SUBTITLE =
  "mt-0.5 block truncate text-[11px] leading-snug text-slate-500";

export const HOME_FIRST_ROW_LIST_TIME =
  "shrink-0 text-[11px] leading-none tabular-nums text-slate-400 transition-colors group-hover:text-slate-600";

export const HOME_FIRST_ROW_LIST = "min-h-0";

export const HOME_FIRST_ROW_LIST_EMBEDDED =
  "flex min-h-0 flex-1 flex-col gap-1 overflow-hidden";

const HOME_FIRST_ROW_LIST_ROW_TRANSITION = {
  layout: dashboardHomeLayoutTransition.layout,
  opacity: { duration: 0.34, ease: ONBOARDING_EASE },
  y: { duration: 0.34, ease: ONBOARDING_EASE },
};

const HOME_ROW_AVATAR_PALETTE = [
  "bg-[#fce7eb] text-[#be4d6a]",
  "bg-[#dbeafe] text-[#2563eb]",
  "bg-[#dcfce7] text-[#15803d]",
  "bg-[#fef3c7] text-[#b45309]",
  "bg-[#ede9fe] text-[#6d28d9]",
  "bg-[#ffedd5] text-[#c2410c]",
] as const;

function homeRowAvatarClass(label: string): string {
  let hash = 0;
  for (const char of label) {
    hash = (hash + char.charCodeAt(0)) % HOME_ROW_AVATAR_PALETTE.length;
  }
  return HOME_ROW_AVATAR_PALETTE[hash] ?? HOME_ROW_AVATAR_PALETTE[0];
}

function homeRowAvatarInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export const HOME_FIRST_ROW_FOOTER = "mt-auto shrink-0 pt-1.5";

export const HOME_FIRST_ROW_EMPTY =
  "flex min-h-[7.5rem] flex-1 flex-col items-center justify-center px-2 py-6 text-center";

export const HOME_FIRST_ROW_ACTION_BUTTON = cn(
  DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS,
  "group inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 text-[12px]",
);

export const HOME_PANEL_LINK_CHEVRON_CLASS =
  "size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-1";

export const HOME_PANEL_OUTLINE_LINK_CLASS = cn(
  DASHBOARD_SECONDARY_BUTTON_CLASS,
  "group inline-flex h-8 w-full shrink-0 items-center justify-center gap-1.5 px-3 text-[11px]",
);

function HomePanelLinkChevron() {
  return <ChevronRight className={HOME_PANEL_LINK_CHEVRON_CLASS} aria-hidden />;
}

export function DashboardHomeFirstRowButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={HOME_FIRST_ROW_ACTION_BUTTON}>
      {children}
      <HomePanelLinkChevron />
    </Link>
  );
}

export function DashboardHomePanelOutlineLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={HOME_PANEL_OUTLINE_LINK_CLASS}>
      {children}
      <HomePanelLinkChevron />
    </Link>
  );
}

export type DashboardHomeFirstRowListItem = {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  time?: string | null;
  departmentSlug?: RetailDepartmentSlug;
  liveCall?: boolean;
};

export function DashboardHomeFirstRowHeader({
  title,
  icon: Icon,
  count,
  meta,
  embedded = false,
}: {
  title: string;
  icon: LucideIcon;
  count?: number;
  meta?: ReactNode;
  embedded?: boolean;
}) {
  const header = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("shrink-0", DASHBOARD_ICON_CHIP_MD)} aria-hidden>
          <Icon className={DASHBOARD_ICON_GLYPH_MD} />
        </span>
        <h2 className={HOME_FIRST_ROW_TITLE}>{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta}
        {count !== undefined ? (
          <span className={HOME_FIRST_ROW_COUNT_BADGE}>{count}</span>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className={cn(HOME_FIRST_ROW_HEADER_EMBEDDED, DASHBOARD_HOME_HERO_GREY)}>
        {header}
      </div>
    );
  }

  return <div className={HOME_FIRST_ROW_HEADER}>{header}</div>;
}

export function DashboardHomeFirstRowBody({
  embedded = false,
  children,
}: {
  embedded?: boolean;
  children: ReactNode;
}) {
  if (!embedded) return children;
  return <div className={HOME_FIRST_ROW_BODY_EMBEDDED}>{children}</div>;
}

export function DashboardHomePanelEmptyState({
  icon: Icon,
  title,
  body,
  embedded = false,
  centered = embedded,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  embedded?: boolean;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 px-1",
        centered
          ? "flex-col items-center justify-center gap-2.5 text-center"
          : "items-center gap-3",
        embedded ? "min-h-0" : "min-h-[5.75rem]",
      )}
    >
      <div
        className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9 shrink-0 shadow-none")}
        aria-hidden
      >
        <Icon className="size-4" />
      </div>
      <div className={cn("min-w-0", centered ? "text-center" : "text-left")}>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>{title}</p>
        <p
          className={cn(
            DASHBOARD_HOME_PANEL_EMPTY_BODY,
            "mt-0.5 text-[11.5px]",
            centered ? "max-w-[16rem]" : "max-w-none",
          )}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

function DashboardHomeFirstRowListRow({
  row,
  embedded,
  showAvatars,
  showDepartmentIcons,
  showCallIcons,
}: {
  row: DashboardHomeFirstRowListItem;
  embedded: boolean;
  showAvatars: boolean;
  showDepartmentIcons: boolean;
  showCallIcons: boolean;
}) {
  const DepartmentIcon =
    showDepartmentIcons && row.departmentSlug
      ? retailDepartmentHomeIcon(row.departmentSlug)
      : null;

  return (
    <Link
      href={row.href}
      className={cn(
        "group flex w-full min-w-0 items-center gap-3",
        DASHBOARD_HOME_FIRST_ROW_LIST_HOVER,
        embedded && "h-full",
        row.liveCall && DASHBOARD_HOME_LIVE_CALL_ROW_CLASS,
      )}
    >
      {showCallIcons ? (
        <span className={RETAIL_DEPARTMENT_HOME_ICON_CHIP} aria-hidden>
          <Phone className="size-3.5" />
        </span>
      ) : null}
      {showAvatars ? (
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
            homeRowAvatarClass(row.title),
          )}
          aria-hidden
        >
          {homeRowAvatarInitial(row.title)}
        </span>
      ) : null}
      {DepartmentIcon ? (
        <span className={RETAIL_DEPARTMENT_HOME_ICON_CHIP} aria-hidden>
          {createElement(DepartmentIcon, { className: "size-3.5" })}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={HOME_FIRST_ROW_LIST_TITLE}>{row.title}</span>
        {row.subtitle ? (
          <span className={HOME_FIRST_ROW_LIST_SUBTITLE}>{row.subtitle}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {row.liveCall ? (
          <span className="inline-flex items-center gap-1.5">
            {row.time === "Loading" ? (
              <Loader2 className="size-3 animate-spin text-[#64748b]" aria-hidden />
            ) : (
              <span className="size-1.5 rounded-full bg-[#94a3b8]" aria-hidden />
            )}
            <span className="text-[11px] font-medium leading-none text-slate-500">
              {row.time ?? "Live"}
            </span>
          </span>
        ) : row.time ? (
          <span className={HOME_FIRST_ROW_LIST_TIME}>{row.time}</span>
        ) : null}
        <ChevronRight className={DASHBOARD_HOME_FIRST_ROW_LIST_CHEVRON} aria-hidden />
      </span>
    </Link>
  );
}

export function DashboardHomeFirstRowList({
  rows,
  embedded = false,
  showAvatars = false,
  showDepartmentIcons = false,
  showCallIcons = false,
}: {
  rows: DashboardHomeFirstRowListItem[];
  embedded?: boolean;
  showAvatars?: boolean;
  showDepartmentIcons?: boolean;
  showCallIcons?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <ul
      className={cn(
        HOME_FIRST_ROW_LIST,
        embedded ? HOME_FIRST_ROW_LIST_EMBEDDED : "flex flex-col gap-1",
      )}
      role="list"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((row) => {
          const content = (
            <DashboardHomeFirstRowListRow
              row={row}
              embedded={embedded}
              showAvatars={showAvatars}
              showDepartmentIcons={showDepartmentIcons}
              showCallIcons={showCallIcons}
            />
          );

          if (reduceMotion) {
            return (
              <li key={row.id} className={embedded ? "flex min-h-0 flex-1" : undefined}>
                {content}
              </li>
            );
          }

          return (
            <motion.li
              key={row.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={HOME_FIRST_ROW_LIST_ROW_TRANSITION}
              className={cn(embedded && "flex min-h-0 flex-1", "min-w-0")}
            >
              {content}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
