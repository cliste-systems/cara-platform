"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownLeft, ClipboardCheck, LayoutGrid, LifeBuoy, Mail, Users, ShieldCheck } from "lucide-react";
import { hasAdminPermission, type AdminStaffAccess } from "@/lib/admin-permissions";
import { AdminSignOutButton } from "./admin-sign-out-button";

const groups = [
  { label: "Workspace", items: [
    { href: "/admin", label: "Overview", icon: LayoutGrid, permission: "team", exact: true },
    { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers", exact: false },
    { href: "/admin/call-analysis", label: "Calls", icon: ClipboardCheck, permission: "calls", exact: false },
    { href: "/admin/support", label: "Support", icon: LifeBuoy, permission: "support", exact: false },
    { href: "/admin/inbox", label: "Email inbox", icon: Mail, permission: "inbox", exact: false },
    { href: "/admin/payments/platform-income", label: "Billing", icon: ArrowDownLeft, permission: "billing", exact: false },
  ] },
  { label: "Administration", items: [
    { href: "/admin/settings", label: "Settings & tools", icon: ShieldCheck, permission: null, exact: false },
  ] },
] as const;

export function AdminNav({ loggedInAs, displayName, access }: { loggedInAs: string; displayName?: string; access: AdminStaffAccess }) {
  const pathname = usePathname() ?? "";
  const name = displayName || loggedInAs;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2" aria-label="Admin">
      {groups.map(group => {
        const items = group.items.filter(item => (item.permission === null || hasAdminPermission(access, item.permission)) && !(item.href === "/admin/inbox" && hasAdminPermission(access, "support")));
        if (!items.length) return null;
        return <div key={group.label} className="border-t border-[#354553] py-2 first:border-t-0 first:pt-1">
          <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#91a8be]">{group.label}</p>
          <div className="space-y-0.5">{items.map(({ href, label, icon: Icon, exact }) => {
            const active = href === "/admin/settings" ? ["/admin/settings", "/admin/team", "/admin/security", "/admin/phone-pool", "/admin/demo-calls"].some(path => pathname === path || pathname.startsWith(`${path}/`)) : href === "/admin/customers" ? pathname.startsWith("/admin/customers") || pathname.startsWith("/admin/organisations") : href === "/admin/payments/platform-income" ? pathname.startsWith("/admin/payments") : href === "/admin/support" ? pathname.startsWith("/admin/support") || pathname.startsWith("/admin/inbox") : exact ? pathname === href || pathname === `${href}/` : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-8 items-center gap-3 rounded-md px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#9db3c8] ${active ? "bg-white/10 font-semibold text-white" : "font-medium text-[#d5e0eb] hover:bg-white/[0.07] hover:text-white"}`}><Icon size={17} strokeWidth={1.6} aria-hidden />{label}</Link>;
          })}</div>
        </div>;
      })}
    </nav>
    <div className="shrink-0 border-t border-[#354553] px-4 py-3">
      <div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">{name.trim()[0]?.toUpperCase() || "A"}</span><div className="min-w-0"><p className="truncate text-[13px] font-medium text-[#f0f4f8]" title={loggedInAs}>{name}</p><p className="mt-1 text-[11px] text-[#9eb2c6]">{access.role === "owner" ? "Workspace owner" : "Team member"}</p></div></div>
      <div className="mt-2"><AdminSignOutButton /></div>
    </div>
  </div>;
}
