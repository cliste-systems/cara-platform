import "server-only";

import { buildCaraKnowledgeHistoryTimeline } from "@/lib/cara-knowledge-history-build";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  loadCustomerKnowledgeEvents,
  loadCustomerTemporalUpdates,
  loadCustomerTrainingRows,
} from "@/lib/load-customer-knowledge-sources";

export type { CaraKnowledgeHistoryItem } from "@/lib/cara-knowledge-history-build";

export async function loadCaraKnowledgeHistory() {
  const { supabase, organizationId } = await requireDashboardSession();
  const [events, temporalRows, { data: trainingRows, error }] = await Promise.all([
    loadCustomerKnowledgeEvents(supabase, organizationId, 100),
    loadCustomerTemporalUpdates(supabase, organizationId),
    loadCustomerTrainingRows(supabase, organizationId, ["applied", "dismissed"], 100),
  ]);
  if (error) throw new Error(`Could not load training history: ${error.message}`);
  return buildCaraKnowledgeHistoryTimeline({ events, temporalRows, trainingRows: trainingRows ?? [] });
}
