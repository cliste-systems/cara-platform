"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ClipboardCheck,
  Headphones,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Phone,
  Users,
} from "lucide-react";

import {
  adminCallAnalysisPath,
  adminCustomersPath,
  adminDemoCallsPath,
  adminInboxPath,
  adminOverviewPath,
  adminPhonePoolPath,
  adminSupportPath,
  adminTextRehearsalPath,
} from "@/lib/admin-route-paths";
import { adminNavLinkBaseClass } from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

import { AdminSignOutButton } from "./admin-sign-out-button";
import { AdminPaymentsNavGroup } from "./admin-payments-nav";

const baseNav = [
  { href: adminOverviewPath(), label: "Overview", icon: LayoutGrid, exact: true },
  {
    href: adminCustomersPath(),
    label: "Customers",
    icon: Users,
    exact: false,
  },
  {
    href: adminPhonePoolPath(),
    label: "Phone pool",
    icon: Phone,
    exact: false,
  },
  {
    href: adminDemoCallsPath(),
    label: "Demo calls",
    icon: Headphones,
    exact: true,
  },
  {
    href: adminCallAnalysisPath(),
    label: "Call analysis",
    icon: ClipboardCheck,
    exact: false,
  },
  {
    href: adminTextRehearsalPath(),
    label: "Text rehearsal",
    icon: MessageSquareText,
    exact: true,
  },
  {
    href: adminInboxPath(),
    label: "Inbox",
    icon: Mail,
    exact: false,
  },
  {
    href: adminSupportPath(),
    label: "Support tickets",
    icon: LifeBuoy,
    exact: false,
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ loggedInAs }: { loggedInAs: string }) {
  const pathname = usePathname() ?? "";
  const initial = loggedInAs.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-5"
        aria-label="Admin"
      >
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91a099]">Workspace</p>
        {baseNav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                adminNavLinkBaseClass,
                "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]",
                active
                  ? "bg-[#353d42] font-semibold text-white"
                  : "font-medium text-[#5f6f68] hover:bg-[#eef2ef] hover:text-[#11181d]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active
                    ? "text-white"
                    : "text-[#8b9c94] group-hover:text-[#353d42]",
                )}
                strokeWidth={1.5}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
        <AdminPaymentsNavGroup />
      </nav>

      <div className="shrink-0 border-t border-[#d9e2dd] bg-[#f7f9f7] p-4">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d9e2dd] bg-white text-xs font-semibold text-[#353d42]">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#11181d]">
              {loggedInAs}
            </p>
            <p className="text-[11px] text-[#8b9c94]">Staff session</p>
          </div>
        </div>
        <AdminSignOutButton />
      </div>
    </div>
  );
}
