"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Building2,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Phone,
  Settings,
  Share2,
  Shield,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountSidebarNav } from "@/components/dashboard/account-sidebar-nav";
import { LocationSwitcher } from "@/components/dashboard/location-switcher";
import { DashboardProfileMenu } from "@/components/dashboard/dashboard-profile-menu";
import type { AccountLocationRow } from "@/lib/account-locations";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import {
  dashboardSidebarBadgeClassName,
  dashboardSidebarRowClassName,
} from "@/components/dashboard/dashboard-sidebar-nav-shared";
import { isDashboardNavItemActive } from "@/lib/dashboard-nav-active";
import { cn } from "@/lib/utils";

import type { DashboardAccountSummary } from "@/lib/dashboard-account-summary";

import { DashboardSignOutButton } from "./dashboard-sign-out-button";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/activity": Activity,
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

export type DashboardSidebarNavItem = {
  href: string;
  label: string;
  badge?: number;
  /** Highlight when pathname starts with this prefix (e.g. all Cara routes). */
  activePrefix?: string;
  /** Also highlight when pathname matches these paths (exact or nested). */
  activeAliases?: string[];
};

export { isDashboardNavItemActive } from "@/lib/dashboard-nav-active";

type DashboardSidebarProps = {
  coreNav: DashboardSidebarNavItem[];
  accountNav: DashboardSidebarNavItem[];
  account: DashboardAccountSummary;
  locations: AccountLocationRow[];
  activeOrganizationId: string;
  viewAllLocations: boolean;
  locationLabel: string;
  accountName: string;
};

function sidebarLabel(item: DashboardSidebarNavItem): string {
  if (item.href === "/dashboard") return "Overview";
  return item.label;
}

function NavRow({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  const Icon = NAV_ICONS[href] ?? LayoutDashboard;
  const showBadge = typeof badge === "number" && badge > 0;
  return (
    <Link
      href={href}
      className={dashboardSidebarRowClassName(active)}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Icon
          className={cn(
            "size-4 shrink-0 transition-colors",
            active
              ? "text-[#0f172a]"
              : "text-[#64748b] group-hover:text-[#0f172a]",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      {showBadge ? (
        <span
          className={dashboardSidebarBadgeClassName(active)}
          aria-label={`${formatNavBadgeCount(badge)} pending`}
        >
          {formatNavBadgeCount(badge)}
        </span>
      ) : null}
    </Link>
  );
}

function NavSection({
  label,
  items,
}: {
  label: string;
  items: DashboardSidebarNavItem[];
}) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <section className="space-y-1.5" aria-label={label}>
      <p className="px-3 text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavRow
              href={item.href}
              label={sidebarLabel(item)}
              badge={item.badge}
              active={isDashboardNavItemActive(pathname, item)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardSidebar({
  coreNav,
  accountNav,
  account,
  locations,
  activeOrganizationId,
  viewAllLocations,
  locationLabel,
  accountName,
}: DashboardSidebarProps) {
  return (
    <aside className="relative z-10 hidden h-dvh w-[260px] shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-[#fafbfc] lg:flex">
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-7">
        <div className="mb-6 flex min-w-0 shrink-0 items-center gap-3.5 px-0.5">
          <Image
            src="/m8x4p2n7.png"
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 object-contain mix-blend-multiply"
            priority
          />
          <div className="min-w-0 leading-none">
            <p className="text-[15px] font-semibold tracking-[0.12em] text-[#0f172a]">
              HELLO
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-[0.14em] text-[#64748b]">
              CARA
            </p>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-0.5">
          <NavSection label="Workspace" items={coreNav} />
          {accountNav.length > 0 ? (
            <>
              <div className="mx-0.5 h-px shrink-0 bg-[#e2e8f0]/90" />
              <section className="space-y-1.5" aria-label="Account">
                <p className="px-3 text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                  Account
                </p>
                <AccountSidebarNav items={accountNav} />
              </section>
            </>
          ) : null}
        </nav>

        <div className="mt-auto shrink-0 space-y-2 border-t border-[#e8ecf0] pt-4">
          <LocationSwitcher
            locations={locations}
            activeOrganizationId={activeOrganizationId}
            viewAllLocations={viewAllLocations}
            locationLabel={locationLabel}
            accountName={accountName}
          />
          <DashboardProfileMenu account={account} />
          <DashboardSignOutButton />
        </div>
      </div>
    </aside>
  );
}
