"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { hasAdminPermission, type AdminStaffAccess } from "@/lib/admin-permissions";
import styles from "./admin-design.module.css";

const sections: [string, string][] = [
  ["/admin/settings", "Settings & tools"], ["/admin/demo-calls/text-rehearsal", "Text rehearsal"], ["/admin/customers", "Customers"],
  ["/admin/organisations", "Organisations"], ["/admin/phone-pool", "Phone pool"],
  ["/admin/demo-calls", "Demo calls"], ["/admin/call-analysis", "Calls"],
  ["/admin/inbox", "Inbox"], ["/admin/support", "Support tickets"],
  ["/admin/team", "Team"], ["/admin/security", "Security & sessions"],
  ["/admin/payments", "Billing"], ["/admin/mfa", "Account security"],
];

export function AdminWorkspaceBar({ displayName, access }: { displayName: string; access: AdminStaffAccess }) {
  const pathname = usePathname() ?? "/admin";
  const section = sections.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "Overview";
  return <div className={styles.toolbar}>
    <div className={styles.breadcrumb}><span>Admin</span><span aria-hidden>/</span><strong>{section}</strong></div>
    <div className="flex items-center gap-4">
      {hasAdminPermission(access, "support") ? <Link href="/admin/support" className={styles.iconButton} aria-label="Open support tickets"><Bell size={20} strokeWidth={1.6} aria-hidden /></Link> : null}
      <Link href="/admin/security" className={styles.avatar} aria-label={`Account security for ${displayName}`}>{displayName.trim()[0]?.toUpperCase() || "A"}</Link>
    </div>
  </div>;
}
