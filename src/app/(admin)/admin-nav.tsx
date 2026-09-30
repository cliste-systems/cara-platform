"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Building2,
  ClipboardCheck,
  Headphones,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Phone,
  Users,
  ShieldCheck,
  UserCog,
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
import { hasAdminPermission, type AdminStaffAccess } from "@/lib/admin-permissions";

import { AdminSignOutButton } from "./admin-sign-out-button";
import { AdminPaymentsNavGroup } from "./admin-payments-nav";

const baseNav = [
  { href: adminOverviewPath(), label: "Overview", icon: LayoutGrid, exact: true, permission: "team" },
  {
    href: adminCustomersPath(),
    label: "Customers",
    permission: "customers",
    icon: Users,
    exact: false,
  },
  { href: "/admin/organisations", label: "Organisations", permission: "customers", icon: Building2, exact: false },
  {
    href: adminPhonePoolPath(),
    label: "Phone pool",
    permission: "customers",
    icon: Phone,
    exact: false,
  },
  {
    href: adminDemoCallsPath(),
    label: "Demo calls",
    permission: "calls",
    icon: Headphones,
    exact: true,
  },
  {
    href: adminCallAnalysisPath(),
    label: "Call analysis",
    permission: "calls",
    icon: ClipboardCheck,
    exact: false,
  },
  {
    href: adminTextRehearsalPath(),
    label: "Text rehearsal",
    permission: "calls",
    icon: MessageSquareText,
    exact: true,
  },
  {
    href: adminInboxPath(),
    label: "Inbox",
    permission: "inbox",
    icon: Mail,
    exact: false,
  },
  {
    href: adminSupportPath(),
    label: "Support tickets",
    permission: "support",
    icon: LifeBuoy,
    exact: false,
  },
  { href: "/admin/team", label: "Team", icon: UserCog, exact: false, permission: "team" },
  { href: "/admin/security", label: "Security & sessions", icon: ShieldCheck, exact: false, permission: null },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ loggedInAs, access }: { loggedInAs: string; access: AdminStaffAccess }) {
  const pathname = usePathname() ?? "";
  const initial = loggedInAs.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-5"
        aria-label="Admin"
      >
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#929aa1]">Workspace</p>
        {baseNav.filter((item) => item.permission === null || hasAdminPermission(access, item.permission)).map(({ href, label, icon: Icon, exact }) => {
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
                  : "font-medium text-[#667078] hover:bg-[#f1f3f5] hover:text-[#11181d]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active
                    ? "text-white"
                    : "text-[#929aa1] group-hover:text-[#353d42]",
                )}
                strokeWidth={1.5}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
        {hasAdminPermission(access, "billing") ? <AdminPaymentsNavGroup /> : null}
      </nav>

      <div className="shrink-0 border-t border-[#e0e3e6] bg-[#fafafa] p-4">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#e0e3e6] bg-white text-xs font-semibold text-[#353d42]">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#11181d]">
              {loggedInAs}
            </p>
            <p className="text-[11px] text-[#929aa1]">{access.role === "owner" ? "Workspace owner" : "Team member"}</p>
          </div>
        </div>
        <AdminSignOutButton />
      </div>
    </div>
  );
}
