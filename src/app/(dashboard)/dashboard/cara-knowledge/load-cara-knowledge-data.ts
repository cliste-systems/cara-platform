import "server-only";

import { rowToTrainingItem } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import type { CaraTrainingListItem } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import {
  buildCaraKnowledgeIndex,
  mergeTemporalUpdatesIntoKnowledgeIndex,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import {
  loadCustomerTemporalUpdates,
  loadCustomerTrainingRows,
  loadCustomerKnowledgeCallLinks,
  loadCustomerKnowledgeCallFacts,
  type CustomerKnowledgeCallLink,
} from "@/lib/load-customer-knowledge-sources";
import {
  resolveBusinessTimezone,
  resolveTemporalLifecycle,
  type TemporalUpdateRecord,
} from "@/lib/cara-knowledge-temporal";
import { autoApplySuggestedKnowledgeClassifications } from "@/lib/cara-knowledge-auto-classify";
import { buildKnowledgeFolders, parseServiceDepartmentNames } from "@/lib/cara-knowledge-folders";
import type { CaraKnowledgeFolderPageData } from "@/lib/load-cara-knowledge-folders";
import { buildCaraKnowledgeFolderViewModel } from "@/lib/load-cara-knowledge-folders";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { canManageDashboardConfig } from "@/lib/team-roles";
import { CARA_TRAINING_OPEN_STATUSES } from "@/lib/cara-training";
import { mergeDevelopmentTrainingDemos } from "@/lib/cara-training-demo-items";
import { enrichTrainingItemsWithCallFacts, enrichTrainingItemsWithCallLinks } from "@/lib/cara-training-call-link";
import { isOpenTrainingStatus } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import { parseCaraTrainingPatch, type CaraTrainingItemRow } from "@/lib/cara-training-types";
import { loadCaraKnowledgeHistory, type CaraKnowledgeHistoryItem } from "./load-cara-knowledge-history";

export type CaraKnowledgePageData = {
  index: CaraKnowledgeIndex;
  folders: CaraKnowledgeFolderPageData;
  openInputCount: number;
  businessName: string;
  businessTimezone: string;
  businessHours: unknown;
  openingHoursText: string | null;
  trainingItems: CaraTrainingListItem[];
  historyItems: CaraKnowledgeHistoryItem[];
  temporalUpdates: TemporalUpdateRecord[];
  activeTemporalCount: number;
  canManage: boolean;
  loadError: string | null;
};

function rowToTrainingItemRow(row: Record<string, unknown>): CaraTrainingItemRow {
  const item = rowToTrainingItem(row);
  return {
    ...item,
    applied_patch: parseCaraTrainingPatch(row.applied_patch),
    proposed_patch: parseCaraTrainingPatch(row.proposed_patch),
  };
}

export async function loadCaraKnowledgePageData(): Promise<CaraKnowledgePageData> {
  const { supabase, organizationId, profile } = await requireDashboardSession();
  const [
    { data: org, error: orgError },
    { data: rows, error: trainingError },
    historyItems,
    temporalUpdates,
    { data: storeDepartments },
  ] = await Promise.all([
    supabase.from("organizations").select(
      "name, niche, updated_at, business_hours, agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, business_knowledge_summary, raw_business_description, agent_opening_hours, agent_service_area, agent_base_town",
    ).eq("id", organizationId).maybeSingle(),
    loadCustomerTrainingRows(supabase, organizationId),
    loadCaraKnowledgeHistory(),
    loadCustomerTemporalUpdates(supabase, organizationId),
    supabase.from("store_departments").select("name, active")
      .eq("organization_id", organizationId).order("sort_order", { ascending: true }),
  ]);
  if (trainingError) console.error("[cara-knowledge] load training items", trainingError.message);
  if (orgError) console.error("[cara-knowledge] load organization", orgError.message);

  const items = (rows ?? []).map(rowToTrainingItemRow);
  const openItems = items.filter((item) => CARA_TRAINING_OPEN_STATUSES.includes(item.status));
  const appliedItems = items.filter((item) => item.status === "applied");
  const openItemsMissingCallLink = openItems.filter((item) => !item.call_log_id && item.source === "call_gap");
  let recentCallsForTrainingLink: CustomerKnowledgeCallLink[] = [];
  if (openItemsMissingCallLink.length > 0) {
    const earliestLastSeen = openItemsMissingCallLink.reduce((min, item) => {
      const ts = new Date(item.last_seen_at || item.created_at).getTime();
      return Number.isFinite(ts) ? Math.min(min, ts) : min;
    }, Date.now());
    recentCallsForTrainingLink = await loadCustomerKnowledgeCallLinks(
      supabase, organizationId, new Date(earliestLastSeen - 2 * 60 * 60 * 1000).toISOString(),
    );
  }
  const linkedOpenItems = enrichTrainingItemsWithCallLinks(openItems, recentCallsForTrainingLink);
  const linkedOpenById = new Map(linkedOpenItems.map((item) => [item.id, item]));
  const openTrainingItems = items.filter((item) => isOpenTrainingStatus(item.status))
    .map((item) => linkedOpenById.get(item.id) ?? item);
  const callLogIds = [...new Set(openTrainingItems.map((item) => item.call_log_id?.trim())
    .filter((id): id is string => Boolean(id)))];
  const callLogsForFacts = await loadCustomerKnowledgeCallFacts(supabase, organizationId, callLogIds);
  const trainingItems = mergeDevelopmentTrainingDemos(
    enrichTrainingItemsWithCallFacts(openTrainingItems, callLogsForFacts),
  );
  const index = mergeTemporalUpdatesIntoKnowledgeIndex(buildCaraKnowledgeIndex({
    faqs: org?.agent_faqs,
    servicesOffered: org?.agent_services_departments,
    servicesNotOffered: org?.agent_services_not_offered,
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
    businessKnowledgeSummary: org?.business_knowledge_summary,
    rawBusinessDescription: org?.raw_business_description,
    openingHours: org?.agent_opening_hours,
    serviceArea: org?.agent_service_area,
    agentBaseTown: org?.agent_base_town,
    appliedTrainingItems: appliedItems,
    openTrainingItems: openItems,
    orgUpdatedAt: org?.updated_at ? String(org.updated_at) : null,
  }), temporalUpdates, null);
  const businessTimezone = resolveBusinessTimezone(null);
  const activeTemporalCount = temporalUpdates.filter((row) => {
    const lifecycle = resolveTemporalLifecycle(row);
    return lifecycle === "active" || lifecycle === "scheduled";
  }).length;
  const canManage = canManageDashboardConfig(profile?.role);
  if (canManage) {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const admin = createAdminClient();
    const autoClassifyFolders = buildKnowledgeFolders({
      storeDepartmentNames: (storeDepartments ?? []).filter((row) => row.active).map((row) => String(row.name)),
      serviceDepartmentNames: parseServiceDepartmentNames(org?.agent_services_departments),
    });
    await autoApplySuggestedKnowledgeClassifications(admin, {
      organizationId, entries: index.entries, folders: autoClassifyFolders,
    });
  }
  const folders = await buildCaraKnowledgeFolderViewModel({
    supabase,
    organizationId,
    index,
    servicesOffered: org?.agent_services_departments,
    storeDepartments: (storeDepartments ?? []) as { name: string; active: boolean }[],
  });
  return {
    index,
    folders,
    openInputCount: trainingItems.length,
    businessName: String(org?.name ?? "").trim() || "your business",
    businessTimezone,
    businessHours: org?.business_hours ?? null,
    openingHoursText: org?.agent_opening_hours ? String(org.agent_opening_hours) : null,
    trainingItems,
    historyItems,
    temporalUpdates,
    activeTemporalCount,
    canManage,
    loadError: orgError?.message ?? trainingError?.message ?? null,
  };
}
