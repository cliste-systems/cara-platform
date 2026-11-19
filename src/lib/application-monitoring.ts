import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

/** Deliberately accepts no messages, request bodies, headers or payment payloads. */
export async function recordApplicationEvent(input: {
  kind: "error" | "slow"; operation: string; code: string;
  organizationId?: string; durationMs?: number;
}): Promise<void> {
  try {
    const { error } = await createAdminClient().from("application_events").insert({
      kind: input.kind,
      operation: input.operation.replace(/[^a-zA-Z0-9_/.:[\]-]/g, "_").slice(0, 160) || "unknown",
      code: input.code.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100) || "unknown",
      organization_id: /^[0-9a-f-]{36}$/i.test(input.organizationId ?? "") ? input.organizationId : null,
      duration_ms: input.durationMs === undefined ? null : Math.min(3600000, Math.max(0, Math.round(input.durationMs))),
      environment: process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development",
    }).abortSignal(AbortSignal.timeout(1500));
    if (error) console.warn("[monitoring] Event could not be stored.");
  } catch { console.warn("[monitoring] Event storage unavailable."); }
}
