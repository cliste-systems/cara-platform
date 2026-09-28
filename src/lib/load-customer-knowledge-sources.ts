import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaraKnowledgeEventRow } from "@/lib/cara-knowledge-events";
import { rowToTemporalUpdate, type TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  customerTrainingFilters, CUSTOMER_TRAINING_JOINS,
  customerKnowledgeEventFilters, CUSTOMER_KNOWLEDGE_EVENT_JOINS,
  customerTemporalFilters, CUSTOMER_TEMPORAL_JOINS,
} from "@/lib/dashboard-customer-data";

/** Explicit data types stop Supabase's recursive embed inference at the DB boundary. */
export async function loadCustomerTrainingRows(
  supabase: SupabaseClient, organizationId: string, statuses?: string[], limit = 200,
) {
  let query = customerTrainingFilters(supabase.from("cara_training_items")
    .select(`*,${CUSTOMER_TRAINING_JOINS}`)
    .overrideTypes<Record<string, unknown>[], { merge: false }>())
    .eq("organization_id", organizationId);
  if (statuses) query = query.in("status", statuses);
  return await query.order("updated_at", { ascending: false }).limit(limit);
}

export async function loadCustomerKnowledgeEvents(
  supabase: SupabaseClient, organizationId: string, limit = 100,
): Promise<CaraKnowledgeEventRow[]> {
  const { data, error } = await customerKnowledgeEventFilters(supabase.from("cara_knowledge_events")
    .select(`*,${CUSTOMER_KNOWLEDGE_EVENT_JOINS}`)
    .overrideTypes<CaraKnowledgeEventRow[], { merge: false }>())
    .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not load knowledge history: ${error.message}`);
  return data ?? [];
}

export async function loadCustomerTemporalUpdates(
  supabase: SupabaseClient, organizationId: string,
): Promise<TemporalUpdateRecord[]> {
  const { data, error } = await customerTemporalFilters(supabase.from("cara_knowledge_temporal_updates")
    .select(`*,${CUSTOMER_TEMPORAL_JOINS}`)
    .overrideTypes<Record<string, unknown>[], { merge: false }>())
    .eq("organization_id", organizationId).order("effective_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not load temporary updates: ${error.message}`);
  return (data ?? []).map(rowToTemporalUpdate);
}
