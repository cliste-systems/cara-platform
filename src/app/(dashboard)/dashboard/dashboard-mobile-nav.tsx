"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Building2,
  Gauge,
  GraduationCap,
  LifeBuoy,
  Menu,
  LayoutDashboard,
  LayoutGrid,
  Phone,
  Settings,
  Share2,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { dashboardFollowUpHubHref } from "@/lib/dashboard-follow-up-hub";
import { dashboardSidebarBadgeClassName } from "@/components/dashboard/dashboard-sidebar-nav-shared";
import { cn } from "@/lib/utils";

import { DashboardSignOutButton } from "./dashboard-sign-out-button";
import type { DashboardSidebarNavItem } from "./dashboard-sidebar";
import { isDashboardNavItemActive } from "@/lib/dashboard-nav-active";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/services": LayoutGrid,
  "/dashboard/business/profile": Building2,
  "/dashboard/calls": Phone,
  "/dashboard/call-history": Phone,
  "/dashboard/routing": Share2,
  "/dashboard/cara-knowledge": BookOpen,
  "/dashboard/cara-training": GraduationCap,
  "/dashboard/departments": LayoutGrid,
  "/dashboard/usage": Gauge,
  "/dashboard/billing": Gauge,
  "/dashboard/support": LifeBuoy,
  "/dashboard/legal/data-requests": Shield,
  "/dashboard/privacy": Shield,
  "/dashboard/locations": Building2,
  "/dashboard/team": Users,
  "/dashboard/settings": Settings,
};

type DashboardMobileNavProps = {
  items: DashboardSidebarNavItem[];
  accountNav: DashboardSidebarNavItem[];
};

function MobileNavLink({
  item,
  onNavigate,
}: {
  item: DashboardSidebarNavItem;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
  const active = isDashboardNavItemActive(pathname, item);
  const label = item.href === "/dashboard" ? "Overview" : item.label;
  const showBadge = typeof item.badge === "number" && item.badge > 0;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]",
        active
          ? "bg-[#eaf0ec] text-[#11181d] ring-1 ring-inset ring-[#d9e2dd]"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-[18px] shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      {showBadge ? (
        <span
          className={dashboardSidebarBadgeClassName(active)}
          aria-label={`${formatNavBadgeCount(item.badge!)} pending`}
        >
          {formatNavBadgeCount(item.badge!)}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardMobileNav(props: DashboardMobileNavProps) {
  const pathname = usePathname();
  return <DashboardMobileNavContents key={pathname} {...props} />;
}

function DashboardMobileNavContents({
  items,
  accountNav,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);
  const { copy } = useDashboardVertical();
  const notificationHref = useMemo(
    () => dashboardFollowUpHubHref(copy.vertical.id),
    [copy.vertical.id],
  );
  const closeMenu = () => setOpen(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/m8x4p2n7.png"
            alt=""
            width={30}
            height={30}
            className="size-7 object-contain mix-blend-multiply"
            priority
          />
          <span className="leading-none">
            <span className="block text-[13px] font-semibold tracking-[0.12em] text-slate-950">
              HELLO
            </span>
            <span className="mt-1 block text-[9px] font-medium tracking-[0.14em] text-slate-500">
              CARA
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={notificationHref}
            className="relative inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            aria-label="Open follow-ups"
          >
            <Bell className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            aria-expanded={open}
            aria-controls="dashboard-mobile-menu"
            aria-label="Toggle dashboard menu"
          >
            {open ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Menu className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dashboard-mobile-drawer [&_[data-slot=dialog-close]]:size-11 left-auto right-0 top-0 flex h-dvh max-h-dvh w-[min(340px,100vw)] max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l border-[#d9e2dd] bg-[#fbfcfb] p-0 sm:max-w-[340px]">
          <div className="shrink-0 border-b border-[#d9e2dd] px-5 py-6 pr-14">
            <DialogTitle className="text-lg font-semibold">Your workspace</DialogTitle>
            <DialogDescription className="mt-1 text-xs">Everything you need to manage Cara.</DialogDescription>
          </div>
        <nav
          id="dashboard-mobile-menu"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-4 pb-[max(16px,env(safe-area-inset-bottom))]"
          aria-label="Dashboard"
        >
          {items.map((item) => (
            <MobileNavLink key={item.href} item={item} onNavigate={closeMenu} />
          ))}
          {accountNav.length > 0 ? (
            <>
              <p className="mt-3 border-t border-[#d9e2dd] px-3 pb-2 pt-5 text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                Account
              </p>
              {accountNav.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  onNavigate={closeMenu}
                />
              ))}
            </>
          ) : null}
        </nav>
        <div className="shrink-0 border-t border-[#d9e2dd] p-4 pb-[max(16px,env(safe-area-inset-bottom))]"><DashboardSignOutButton /></div>
      </DialogContent></Dialog>
    </div>
  );
}
