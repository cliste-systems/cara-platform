import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminStaffContext } from "@/lib/admin-session";
import { getAdminSessionId, listAdminStaffSessions } from "@/lib/admin-sessions";
import { createClient } from "@/utils/supabase/server";

import { AdminSecuritySettings } from "./security-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Security — HelloCara Admin" };

export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  const { user } = await requireAdminStaffContext();
  const supabase = await createClient();
  const currentSessionId = await getAdminSessionId(user, supabase);
  const { access } = await searchParams;
  let sessions: Awaited<ReturnType<typeof listAdminStaffSessions>> = [];
  let loadError: string | null = null;
  try {
    sessions = await listAdminStaffSessions(user.id, currentSessionId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "We couldn’t load your sessions.";
  }
  return (
    <AdminPageShell icon={ShieldCheck} title="Your security" description="Manage your password and the devices signed in to your admin account.">
      {access === "denied" && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">Your account does not have access to that area. Ask an owner to update your permissions.</div>}
      {loadError ? <AdminErrorCard message={loadError} /> : null}
      <AdminSecuritySettings email={user.email ?? ""} sessions={sessions} sessionsAvailable={!loadError} />
    </AdminPageShell>
  );
}
