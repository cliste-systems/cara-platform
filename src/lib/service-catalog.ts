import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeServicePolicyFlags,
  sanitizeServiceVoiceNote,
} from "@/lib/service-policy-presets";
import { formatAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  resolveQuotePricesOnCalls,
  dedupeCatalogDrafts,
  findCatalogNameConflict,
  type ServiceCatalogDraft,
  type ServiceCatalogItem,
  type ServiceCatalogSource,
  MAX_SERVICE_CATALOG_ITEMS,
  MAX_SERVICE_CATEGORY,
  MAX_SERVICE_DESCRIPTION,
  MAX_SERVICE_NAME,
} from "@/lib/service-catalog-format";

export type { ServiceCatalogDraft, ServiceCatalogItem, ServiceCatalogSource };
export {
  catalogHasExtractedPrices,
  formatServiceCatalogLine,
  formatServiceDuration,
  formatServicePriceEur,
  MAX_SERVICE_CATALOG_ITEMS,
  serviceDurationIsSet,
  servicePriceIsSet,
} from "@/lib/service-catalog-format";

type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  price: number | string;
  duration_minutes: number;
  description: string | null;
  ai_voice_notes: string | null;
  policy_flags?: unknown;
  source: ServiceCatalogSource | null;
  details?: ServiceCatalogItem["details"];
  updated_at?: string;
};

const SERVICE_SELECT_WITH_POLICY_FLAGS =
  "id, name, category, price, duration_minutes, description, ai_voice_notes, policy_flags, source, details, updated_at";
const SERVICE_SELECT_LEGACY =
  "id, name, category, price, duration_minutes, description, ai_voice_notes, source";

/** Cached after first list/upsert against this process — avoids repeated failed selects. */
let policyFlagsColumnAvailable: boolean | null = null;

function isMissingPolicyFlagsColumnError(message: string | undefined): boolean {
  return Boolean(message?.includes("policy_flags"));
}

function serviceSelectColumns(): string {
  return policyFlagsColumnAvailable === false
    ? SERVICE_SELECT_LEGACY
    : SERVICE_SELECT_WITH_POLICY_FLAGS;
}

function attachPolicyFlagsToRow(
  row: Record<string, unknown>,
  policyFlags: ServiceCatalogItem["policyFlags"],
): void {
  if (policyFlagsColumnAvailable !== false) {
    row.policy_flags = policyFlags;
  }
}

async function queryServicesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const runQuery = (select: string) =>
    supabase
      .from("services")
      .select(select)
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

  if (policyFlagsColumnAvailable === false) {
    return runQuery(SERVICE_SELECT_LEGACY);
  }

  const result = await runQuery(SERVICE_SELECT_WITH_POLICY_FLAGS);
  if (
    result.error &&
    isMissingPolicyFlagsColumnError(result.error.message)
  ) {
    policyFlagsColumnAvailable = false;
    return runQuery(SERVICE_SELECT_LEGACY);
  }

  if (!result.error) {
    policyFlagsColumnAvailable = true;
  }

  return result;
}

export function syncServiceNamesToBoundary(
  services: Pick<ServiceCatalogItem, "name" | "details">[],
): string {
  const names = services
    .filter(s=>s.details?.status!=="archived")
    .map((s) => s.name.trim())
    .filter(Boolean);
  return formatAgentKnowledgeList(names);
}

export function rowToServiceCatalogItem(row: ServiceRow): ServiceCatalogItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.trim() || null,
    price: Number(row.price) || 0,
    durationMinutes: row.duration_minutes ?? 0,
    description: row.description?.trim() || null,
    aiVoiceNotes: row.ai_voice_notes?.trim() || null,
    policyFlags: normalizeServicePolicyFlags(row.policy_flags),
    source: row.source ?? "manual",
    details: row.details,
    updatedAt: row.updated_at,
  };
}

export async function listServicesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ServiceCatalogItem[]> {
  const { data, error } = await queryServicesForOrg(supabase, organizationId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ServiceRow[]).map(rowToServiceCatalogItem);
}

function normalizeDraft(
  draft: ServiceCatalogDraft,
): Omit<ServiceCatalogItem, "id"> {
  return {
    name: String(draft.name ?? "").trim().slice(0, MAX_SERVICE_NAME),
    category: draft.category?.trim().slice(0, MAX_SERVICE_CATEGORY) || null,
    price: Math.max(0, Number(draft.price) || 0),
    durationMinutes: Math.max(0, Math.round(Number(draft.durationMinutes) || 0)),
    description:
      draft.description?.trim().slice(0, MAX_SERVICE_DESCRIPTION) || null,
    aiVoiceNotes: sanitizeServiceVoiceNote(draft.aiVoiceNotes),
    policyFlags: normalizeServicePolicyFlags(draft.policyFlags),
    source: draft.source ?? "manual",
    ...(draft.details ? { details: draft.details } : {}),
  };
}

export async function upsertServiceForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  draft: ServiceCatalogDraft,
  options?: { importedAt?: string },
): Promise<ServiceCatalogItem> {
  const normalized = normalizeDraft(draft);
  if (!normalized.name) {
    throw new Error("Service name is required.");
  }

  const existing = await listServicesForOrg(supabase, organizationId);
  const conflict = findCatalogNameConflict(
    normalized.name,
    existing,
    draft.id,
    {
      price: normalized.price,
      durationMinutes: normalized.durationMinutes,
    },
  );
  if (conflict) {
    throw new Error(
      `"${normalized.name}" is too similar to "${conflict}". Keep one name in your menu.`,
    );
  }

  const row: Record<string, unknown> = {
    organization_id: organizationId,
    name: normalized.name,
    category: normalized.category,
    price: normalized.price,
    duration_minutes: normalized.durationMinutes,
    description: normalized.description,
    ai_voice_notes: normalized.aiVoiceNotes,
    source: normalized.source,
    ...(normalized.details ? { details: normalized.details } : {}),
    updated_at: new Date().toISOString(),
  };
  attachPolicyFlagsToRow(row, normalized.policyFlags);

  if (options?.importedAt) {
    row.imported_at = options.importedAt;
  }

  const selectColumns = serviceSelectColumns();

  if (draft.id) {
    let { data, error } = await supabase
      .from("services")
      .update(row)
      .eq("id", draft.id)
      .eq("organization_id", organizationId)
      .select(selectColumns)
      .maybeSingle();

    if (
      error &&
      isMissingPolicyFlagsColumnError(error.message) &&
      policyFlagsColumnAvailable !== false
    ) {
      policyFlagsColumnAvailable = false;
      delete row.policy_flags;
      ({ data, error } = await supabase
        .from("services")
        .update(row)
        .eq("id", draft.id)
        .eq("organization_id", organizationId)
        .select(SERVICE_SELECT_LEGACY)
        .maybeSingle());
    }

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Service not found.");
    return rowToServiceCatalogItem(data as unknown as ServiceRow);
  }

  let insertResult = await supabase
    .from("services")
    .insert(row)
    .select(selectColumns)
    .single();

  if (
    insertResult.error &&
    isMissingPolicyFlagsColumnError(insertResult.error.message) &&
    policyFlagsColumnAvailable !== false
  ) {
    policyFlagsColumnAvailable = false;
    delete row.policy_flags;
    insertResult = await supabase
      .from("services")
      .insert(row)
      .select(SERVICE_SELECT_LEGACY)
      .single();
  }

  if (insertResult.error) throw new Error(insertResult.error.message);
  return rowToServiceCatalogItem(insertResult.data as unknown as ServiceRow);
}

export async function replaceServiceCatalogForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  drafts: ServiceCatalogDraft[],
  options?: {
    source?: ServiceCatalogSource;
    importedAt?: string;
    replaceExisting?: boolean;
  },
): Promise<ServiceCatalogItem[]> {
  const capped = drafts.slice(0, MAX_SERVICE_CATALOG_ITEMS);
  const normalized = dedupeCatalogDrafts(
    capped
      .map((d) => normalizeDraft({ ...d, source: options?.source ?? d.source }))
      .filter((d) => d.name),
  );

  if (options?.replaceExisting) {
    const { error: deleteError } = await supabase
      .from("services")
      .delete()
      .eq("organization_id", organizationId);
    if (deleteError) throw new Error(deleteError.message);
  }

  const importedAt = options?.importedAt ?? new Date().toISOString();
  const saved: ServiceCatalogItem[] = [];

  for (const draft of normalized) {
    const item = await upsertServiceForOrg(
      supabase,
      organizationId,
      { ...draft, source: options?.source ?? draft.source ?? "manual" },
      options?.source && options.source !== "manual"
        ? { importedAt }
        : undefined,
    );
    saved.push(item);
  }

  const boundary = syncServiceNamesToBoundary(saved);
  const { error: orgError } = await supabase
    .from("organizations")
    .update({
      agent_services_departments: boundary || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (orgError) throw new Error(orgError.message);
  return saved;
}

export async function deleteServiceForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  serviceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

export async function syncCatalogBoundaryForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const services = await listServicesForOrg(supabase, organizationId);
  const boundary = syncServiceNamesToBoundary(services);
  const { data: org } = await supabase
    .from("organizations")
    .select("quote_prices_on_calls")
    .eq("id", organizationId)
    .maybeSingle();
  const { error } = await supabase
    .from("organizations")
    .update({
      agent_services_departments: boundary || null,
      quote_prices_on_calls: resolveQuotePricesOnCalls(
        services,
        org?.quote_prices_on_calls,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) throw new Error(error.message);
}
