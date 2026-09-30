import type { Metadata } from "next";
import { Users } from "lucide-react";
import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminPermission } from "@/lib/admin-session";
import type { StaffMemberRow } from "@/lib/admin-staff-input";
import { createAdminClient } from "@/utils/supabase/admin";
import { TeamManager } from "./team-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "HelloCara Admin — Team & access" };

export default async function AdminTeamPage() {
  const user = await requireAdminPermission("team");
  const admin = createAdminClient();
  const { data, error } = await admin.from("admin_staff").select("user_id,email,display_name,role,permissions,status,invited_at,accepted_at,invitation_sent_at,invitation_error").order("created_at", { ascending: true });
  return <AdminPageShell icon={Users} title="Team & access" description="Give your team the tools they need, with clear access to each part of HelloCara.">{error ? <AdminErrorCard message="Your team could not be loaded. Refresh to try again." /> : <TeamManager members={(data ?? []) as StaffMemberRow[]} currentUserId={user.id} />}</AdminPageShell>;
}
