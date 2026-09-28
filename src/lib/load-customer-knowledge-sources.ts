import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaraKnowledgeEventRow } from "@/lib/cara-knowledge-events";
import { rowToTemporalUpdate, type TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  customerCallFilters,
  customerTrainingFilters, CUSTOMER_TRAINING_JOINS,
  customerKnowledgeEventFilters, CUSTOMER_KNOWLEDGE_EVENT_JOINS,
  customerTemporalFilters, CUSTOMER_TEMPORAL_JOINS,
} from "@/lib/dashboard-customer-data";

/** Validate the database boundary instead of recursively overriding embed types. */
function records(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Invalid knowledge query response.");
  return value.map((row: unknown) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Invalid knowledge query row.");
    }
    return row as Record<string, unknown>;
  });
}
function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function inValues(values: string[]): string {
  return `(${values.map((value) => JSON.stringify(value)).join(",")})`;
}

export async function loadCustomerTrainingRows(
  supabase: SupabaseClient, organizationId: string, statuses?: string[], limit = 200,
): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> {
  const columns: string = `*,${CUSTOMER_TRAINING_JOINS}`;
  const query = customerTrainingFilters(supabase.from("cara_training_items").select(columns));
  query.filter("organization_id", "eq", organizationId);
  if (statuses) query.filter("status", "in", inValues(statuses));
  const response = await query.order("updated_at", { ascending: false }).limit(limit);
  if (response.error) return { data: null, error: { message: response.error.message } };
  return { data: records(response.data), error: null };
}

export async function loadCustomerKnowledgeEvents(
  supabase: SupabaseClient, organizationId: string, limit = 100,
): Promise<CaraKnowledgeEventRow[]> {
  const columns: string = `*,${CUSTOMER_KNOWLEDGE_EVENT_JOINS}`;
  const { data, error } = await customerKnowledgeEventFilters(supabase.from("cara_knowledge_events").select(columns))
    .filter("organization_id", "eq", organizationId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not load knowledge history: ${error.message}`);
  return records(data).map((row) => ({
    id: String(row.id), organization_id: String(row.organization_id),
    event_type: row.event_type as CaraKnowledgeEventRow["event_type"],
    category: nullableText(row.category), title: String(row.title ?? ""),
    payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown> : null,
    source: String(row.source ?? ""), actor_id: nullableText(row.actor_id),
    call_log_id: nullableText(row.call_log_id), training_item_id: nullableText(row.training_item_id),
    created_at: String(row.created_at),
  }));
}

export async function loadCustomerTemporalUpdates(
  supabase: SupabaseClient, organizationId: string,
): Promise<TemporalUpdateRecord[]> {
  const columns: string = `*,${CUSTOMER_TEMPORAL_JOINS}`;
  const { data, error } = await customerTemporalFilters(supabase.from("cara_knowledge_temporal_updates").select(columns))
    .filter("organization_id", "eq", organizationId).order("effective_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not load temporary updates: ${error.message}`);
  return records(data).map(rowToTemporalUpdate);
}

export type CustomerKnowledgeCallLink = { id: string; ai_summary: string | null; created_at: string };
export type CustomerKnowledgeCallFact = { id: string; created_at: string; duration_seconds: number; caller_number: string };

export async function loadCustomerKnowledgeCallLinks(
  supabase: SupabaseClient, organizationId: string, since: string,
): Promise<CustomerKnowledgeCallLink[]> {
  const { data, error } = await customerCallFilters(supabase.from("call_logs")
    .select("id, ai_summary, created_at"))
    .filter("organization_id", "eq", organizationId).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Could not load training call links: ${error.message}`);
  return records(data).map((row) => ({
    id: String(row.id), created_at: String(row.created_at), ai_summary: nullableText(row.ai_summary),
  }));
}

export async function loadCustomerKnowledgeCallFacts(
  supabase: SupabaseClient, organizationId: string, ids: string[],
): Promise<CustomerKnowledgeCallFact[]> {
  if (ids.length === 0) return [];
  const { data, error } = await customerCallFilters(supabase.from("call_logs")
    .select("id, created_at, duration_seconds, caller_number"))
    .filter("organization_id", "eq", organizationId).filter("id", "in", inValues(ids));
  if (error) throw new Error(`Could not load training call details: ${error.message}`);
  return records(data).map((row) => ({
    id: String(row.id), created_at: String(row.created_at),
    duration_seconds: Math.max(0, Number(row.duration_seconds) || 0),
    caller_number: String(row.caller_number ?? ""),
  }));
}
