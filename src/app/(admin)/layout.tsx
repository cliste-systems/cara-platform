import Link from "next/link";

import { DashboardViewportLock } from "@/app/(dashboard)/dashboard/dashboard-viewport-lock";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { requireAdminMfaSessionUser } from "@/lib/admin-session";
import { allowAdminDevWithoutSupabase } from "@/lib/supabase-env";

import { AdminNav } from "./admin-nav";
import { AdminMobileNav } from "./admin-mobile-nav";

function adminSessionLabel(): string {
  const custom = process.env.CLISTE_ADMIN_DISPLAY_NAME?.trim();
  if (custom) return custom;
  return "admin";
}

export default async function AdminShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAdminMfaSessionUser();
  const loggedInAs =
    user.email?.trim().toLowerCase() || adminSessionLabel();
  const supabaseOffline = allowAdminDevWithoutSupabase();

  return (
    <>
      <DashboardViewportLock />
      <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[#f3f6f4] antialiased text-[#11181d]">
        {supabaseOffline ? (
          <div
            className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            Local dev mode — Supabase is not configured. Admin data and actions
            need{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">.env.local</code>.
            Run{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              npm run bootstrap:env
            </code>{" "}
            when ready.
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <aside className="relative z-20 hidden h-full w-[252px] shrink-0 flex-col border-r border-[#d9e2dd] bg-[#fbfcfb] md:flex">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-[#d9e2dd] bg-[#e7ede9] px-5 py-6">
                <Link
                  href="/admin"
                  className="flex cursor-pointer items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-[#353d42]"
                >
                  <ClisteLogoMark size={36} priority className="shrink-0" />
                  <div className="min-w-0 flex-col">
                    <span className="block text-sm font-semibold leading-tight tracking-tight text-[#11181d]">
                      HelloCara
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6b7c75]">
                      Admin workspace
                    </span>
                  </div>
                </Link>
              </div>

              <AdminNav loggedInAs={loggedInAs} />
            </div>
          </aside>

          <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[#f3f6f4] lg:has-[data-admin-fill]:overflow-hidden [&>[data-admin-fill]]:min-h-0 [&>[data-admin-fill]]:flex-1 [&>[data-admin-fill]]:w-full">
            <AdminMobileNav loggedInAs={loggedInAs} />
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
