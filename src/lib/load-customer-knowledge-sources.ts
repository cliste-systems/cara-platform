import "server-only";
import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import type { CaraKnowledgeEventRow } from "@/lib/cara-knowledge-events";
import { rowToTemporalUpdate, type TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  customerCallFilters,
  customerTrainingFilters, CUSTOMER_TRAINING_JOINS,
  customerKnowledgeEventFilters, CUSTOMER_KNOWLEDGE_EVENT_JOINS,
  customerTemporalFilters, CUSTOMER_TEMPORAL_JOINS,
} from "@/lib/dashboard-customer-data";

/** Keep recursive embed inference inside this boundary; decode raw training fields in the caller. */
export async function loadCustomerTrainingRows(
  supabase: SupabaseClient, organizationId: string, statuses?: string[], limit = 200,
): Promise<PostgrestSingleResponse<Record<string, unknown>[]>> {
  const columns: string = `*,${CUSTOMER_TRAINING_JOINS}`;
  let query = customerTrainingFilters(supabase.from("cara_training_items").select(columns))
    .eq("organization_id", organizationId);
  if (statuses) query = query.in("status", statuses);
  return await query.order("updated_at", { ascending: false }).limit(limit)
    .overrideTypes<Record<string, unknown>[], { merge: false }>();
}

export async function loadCustomerKnowledgeEvents(
  supabase: SupabaseClient, organizationId: string, limit = 100,
): Promise<CaraKnowledgeEventRow[]> {
  const columns: string = `*,${CUSTOMER_KNOWLEDGE_EVENT_JOINS}`;
  const { data, error } = await customerKnowledgeEventFilters(supabase.from("cara_knowledge_events").select(columns))
    .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(limit)
    .overrideTypes<CaraKnowledgeEventRow[], { merge: false }>();
  if (error) throw new Error(`Could not load knowledge history: ${error.message}`);
  return data ?? [];
}

export async function loadCustomerTemporalUpdates(
  supabase: SupabaseClient, organizationId: string,
): Promise<TemporalUpdateRecord[]> {
  const columns: string = `*,${CUSTOMER_TEMPORAL_JOINS}`;
  const { data, error } = await customerTemporalFilters(supabase.from("cara_knowledge_temporal_updates").select(columns))
    .eq("organization_id", organizationId).order("effective_at", { ascending: false }).limit(200)
    .overrideTypes<Record<string, unknown>[], { merge: false }>();
  if (error) throw new Error(`Could not load temporary updates: ${error.message}`);
  return (data ?? []).map(rowToTemporalUpdate);
}

export type CustomerKnowledgeCallLink = { id: string; ai_summary: string | null; created_at: string };
export type CustomerKnowledgeCallFact = { id: string; created_at: string; duration_seconds: number; caller_number: string };

export async function loadCustomerKnowledgeCallLinks(
  supabase: SupabaseClient, organizationId: string, since: string,
): Promise<CustomerKnowledgeCallLink[]> {
  const columns: string = "id, ai_summary, created_at";
  const { data, error } = await customerCallFilters(supabase.from("call_logs").select(columns))
    .eq("organization_id", organizationId).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(100)
    .overrideTypes<CustomerKnowledgeCallLink[], { merge: false }>();
  if (error) throw new Error(`Could not load training call links: ${error.message}`);
  return data ?? [];
}

export async function loadCustomerKnowledgeCallFacts(
  supabase: SupabaseClient, organizationId: string, ids: string[],
): Promise<CustomerKnowledgeCallFact[]> {
  if (ids.length === 0) return [];
  const columns: string = "id, created_at, duration_seconds, caller_number";
  const { data, error } = await customerCallFilters(supabase.from("call_logs").select(columns))
    .eq("organization_id", organizationId).in("id", ids)
    .overrideTypes<CustomerKnowledgeCallFact[], { merge: false }>();
  if (error) throw new Error(`Could not load training call details: ${error.message}`);
  return data ?? [];
}
