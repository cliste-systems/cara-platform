"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { customerCallFilters } from "@/lib/dashboard-customer-data";
import { loadServiceCallKnowledge } from "@/lib/service-call-knowledge";
import { isServiceFollowUp, SERVICE_CALL_COLUMNS, type ServiceCall } from "@/lib/service-calls";

export async function updateServiceCallCompletion(id: string, status: "open" | "resolved", performedBy?: string) {
  const session = await requireDashboardAdmin();
  const fail = { ok: false as const, message: "We couldn’t update this call. Please try again." };
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["open", "resolved"].includes(status)) return fail;
  const label = typeof performedBy === "string" ? performedBy.trim() : "";
  if (status === "resolved" && (!label || label.length > 80)) return { ok: false as const, message: "Enter your name (up to 80 characters)." };
  const { supabase, organizationId } = session;
  const [result, knowledge, organization] = await Promise.all([
    customerCallFilters(supabase.from("call_logs").select(`${SERVICE_CALL_COLUMNS},follow_up_completed_by`)).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    loadServiceCallKnowledge(supabase, organizationId, id),
    supabase.from("organizations").select("niche").eq("id", organizationId).maybeSingle(),
  ]);
  if (result.error || knowledge.error || organization.error || !organization.data || organization.data.niche === "retail" || !result.data) return fail;
  const call = result.data as ServiceCall & { follow_up_completed_by: string | null };
  const question = knowledge.questions.get(id);
  if (call.caller_data_erased_at || call.post_call_status === "pending" || !(isServiceFollowUp({ ...call, knowledge_needs_input: question?.needsInput }) || call.follow_up_completed_at)) return fail;
  const completed = status === "resolved";
  const updated = await customerCallFilters(supabase.from("call_logs").update({
    follow_up_completed_at: completed ? call.follow_up_completed_at || new Date().toISOString() : null,
    follow_up_completed_by_label: completed ? call.follow_up_completed_by_label || label : null,
    follow_up_completed_by: completed ? call.follow_up_completed_by || session.user.id : null,
    ...(!completed && question ? { call_resolution: "needs_follow_up" } : {}),
  })).eq("organization_id", organizationId).eq("id", id).is("caller_data_erased_at", null).neq("post_call_status", "pending").select("id").maybeSingle();
  if (updated.error || !updated.data) return fail;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calls");
  revalidatePath("/dashboard/cara-knowledge");
  return { ok: true as const };
}
