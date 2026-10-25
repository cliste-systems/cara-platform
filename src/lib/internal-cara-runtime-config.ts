import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadPlatformCaraRules } from "@/lib/platform-cara-rules";

/** Check tenant access before using the privileged client; return only to prompt assembly. */
export async function loadInternalCaraRuntimeConfig(
  sessionClient: SupabaseClient,
  organizationId: string,
  privilegedClient: () => SupabaseClient = createAdminClient,
) {
  const access = await sessionClient.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (access.error || access.data?.id !== organizationId) throw new Error("Business access could not be verified.");
  const internal = privilegedClient();
  const notes = await internal.from("organizations").select("admin_notes").eq("id", organizationId).maybeSingle();
  if (notes.error || !notes.data) throw new Error("Internal call configuration is unavailable.");
  return {
    adminNotes: String(notes.data.admin_notes ?? "").trim(),
    platformRules: await loadPlatformCaraRules(internal),
  };
}
