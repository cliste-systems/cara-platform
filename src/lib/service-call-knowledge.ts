import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOMER_TRAINING_JOINS, customerTrainingFilters } from "./dashboard-customer-data";

export type ServiceCallKnowledge = { question: string; needsInput: boolean };
/** Only persisted, customer-visible knowledge questions linked to a real call. */
export async function loadServiceCallKnowledge(supabase: SupabaseClient, organizationId: string, callId?: string) {
  const questions = new Map<string, ServiceCallKnowledge>();
  for (let offset = 0; ; offset += 1000) {
    const query = customerTrainingFilters(supabase.from("cara_training_items").select(`call_log_id,cara_question,status,${CUSTOMER_TRAINING_JOINS}`))
      .eq("organization_id", organizationId).eq("source", "call_gap").not("call_log_id", "is", null);
    if (callId) query.eq("call_log_id", callId);
    const response = await query.order("updated_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (response.error) return { questions, error: true };
    const rows = (response.data ?? []) as unknown as { call_log_id: string; cara_question: string; status: string }[];
    for (const row of rows) {
      const open = ["awaiting_answer", "draft_ready"].includes(row.status);
      const existing = questions.get(row.call_log_id);
      if (!existing || (open && !existing.needsInput)) questions.set(row.call_log_id, { question: row.cara_question, needsInput: open });
    }
    if (rows.length < 1000) break;
  }
  return { questions, error: false };
}
