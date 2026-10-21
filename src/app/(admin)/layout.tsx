import Link from "next/link";
import { DashboardViewportLock } from "@/app/(dashboard)/dashboard/dashboard-viewport-lock";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { requireAdminStaffContext } from "@/lib/admin-session";
import { allowAdminDevWithoutSupabase } from "@/lib/supabase-env";
import { AdminNav } from "./admin-nav";
import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminWorkspaceBar } from "./admin-workspace-bar";
import styles from "./admin-design.module.css";

export default async function AdminShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireAdminStaffContext();
  const loggedInAs = staff.user.email?.trim().toLowerCase() || process.env.CLISTE_ADMIN_DISPLAY_NAME?.trim() || "admin";
  const displayName = staff.display_name?.trim() || loggedInAs.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  const access = { role: staff.role, permissions: staff.permissions, status: staff.status };
  return <><DashboardViewportLock /><div className={`fixed inset-0 z-10 flex flex-col overflow-hidden antialiased ${styles.shell}`}>
    {allowAdminDevWithoutSupabase() ? <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950" role="status">Local development · Admin data is unavailable until the database is configured.</div> : null}
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className={`relative z-20 hidden h-full shrink-0 flex-col md:flex ${styles.sidebar}`}>
        <div className="shrink-0 px-5 pb-3 pt-5">
          <Link href="/admin" className="flex items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-slate-400">
            <ClisteLogoMark size={38} priority className="shrink-0 brightness-0 invert" />
            <div><span className="block text-[21px] font-semibold leading-tight tracking-tight">HelloCara</span><span className="mt-1 block text-xs text-[#a5b7c9]">Admin workspace</span></div>
          </Link>

        </div>
        <AdminNav loggedInAs={loggedInAs} displayName={displayName} access={access} />
      </aside>
      <main className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden [&>[data-admin-fill]]:min-h-0 [&>[data-admin-fill]]:flex-1 [&>[data-admin-fill]]:w-full ${styles.canvas}`}>
        <AdminMobileNav loggedInAs={loggedInAs} displayName={displayName} access={access} />
        <AdminWorkspaceBar displayName={displayName} access={access} />
        {children}
      </main>
    </div>
  </div></>;
}
