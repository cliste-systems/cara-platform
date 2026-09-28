import "server-only";

import type { createAdminClient } from "@/utils/supabase/admin";

type CallIdentifiers = {
  organization_id: string;
  call_sid?: string | null;
  room_name?: string | null;
};

/** Query only exact call identifiers. No identifiers means no verified coverage. */
export async function loadCallPipelineIncidents(admin: ReturnType<typeof createAdminClient>, call: CallIdentifiers) {
  const query = () => admin.from("voice_pipeline_incidents")
    .select("id,occurred_at,stage,error_message,model_label,retryable,sms_fallback_sent")
    .eq("organization_id", call.organization_id).order("occurred_at").limit(101);
  const results = await Promise.all([
    ...(call.call_sid ? [query().eq("call_sid", call.call_sid)] : []),
    ...(call.room_name ? [query().eq("room_name", call.room_name)] : []),
  ]);
  const error = results.find(result => result.error)?.error ?? null;
  const rows = results.flatMap(result => result.data ?? []);
  return {
    data: [...new Map(rows.map(row => [row.id, row])).values()],
    error,
    complete: results.length > 0 && results.every(result => !result.error && result.data !== null && result.data.length < 101),
  };
}
