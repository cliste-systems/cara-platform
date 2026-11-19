"use server";
import { revalidatePath } from "next/cache";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";

export async function updateFollowUp(id: string, status: "open" | "resolved") {
  const s = await requireDashboardAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["open", "resolved"].includes(status))
    return {
      ok: false as const,
      message: "This follow-up could not be updated.",
    };
  const { data, error } = await s.supabase.rpc("set_call_follow_up", {
    p_organization_id: s.organizationId,
    p_call_id: id,
    p_completed: status === "resolved",
  });
  if (error || !data)
    return {
      ok: false as const,
      message: "We couldn’t update this follow-up. Please try again.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calls");
  return { ok: true as const };
}
