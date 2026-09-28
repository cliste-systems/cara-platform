"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CreditCard } from "lucide-react";

import { DashboardSidebarNavExpand } from "@/components/dashboard/dashboard-sidebar-nav-expand";
import {
  adminNavLinkBaseClass,
} from "@/components/admin/admin-interactive";
import {
  adminPaymentsPlatformIncomePath,
  adminPaymentsPlatformSpendPath,
  isAdminPaymentsPath,
} from "@/lib/admin-route-paths";
import { cn } from "@/lib/utils";

const PAYMENTS_CHILDREN = [
  {
    href: adminPaymentsPlatformIncomePath(),
    label: "Platform income",
  },
  {
    href: adminPaymentsPlatformSpendPath(),
    label: "Platform spend",
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminPaymentsNavGroup() {
  const pathname = usePathname() ?? "";
  const onPaymentsRoute = isAdminPaymentsPath(pathname);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [routeCollapsed, setRouteCollapsed] = useState(false);

  const childActive = PAYMENTS_CHILDREN.some((item) =>
    isActive(pathname, item.href, true),
  );
  const sectionActive = onPaymentsRoute && childActive;
  const expanded = onPaymentsRoute ? !routeCollapsed : manuallyExpanded;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => {
          if (onPaymentsRoute) {
            setRouteCollapsed((open) => !open);
            return;
          }
          setManuallyExpanded((open) => !open);
        }}
        className={cn(
          adminNavLinkBaseClass,
          "group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]",
          sectionActive
            ? "bg-[#353d42] font-semibold text-white"
            : "font-medium text-[#5f6f68] hover:bg-[#eef2ef] hover:text-[#11181d]",
        )}
        aria-expanded={expanded}
      >
        <CreditCard
          className={cn(
            "size-4 shrink-0 transition-colors",
            sectionActive
              ? "text-white"
              : "text-[#8b9c94] group-hover:text-[#353d42]",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left">Payments</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#8b9c94] transition-transform duration-200 ease-out",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>

      <DashboardSidebarNavExpand expanded={expanded}>
        {PAYMENTS_CHILDREN.map((item) => {
          const active = isActive(pathname, item.href, true);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                adminNavLinkBaseClass,
                "ml-6 flex min-h-9 items-center rounded-lg px-3 py-2 text-[13px]",
                active
                  ? "bg-[#e8eeea] font-semibold text-[#11181d]"
                  : "font-medium text-[#6b7c75] hover:bg-[#eef2ef] hover:text-[#11181d]",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </DashboardSidebarNavExpand>
    </div>
  );
}
