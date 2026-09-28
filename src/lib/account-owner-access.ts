import type { SupabaseClient } from "@supabase/supabase-js";
import { canManageDashboardConfig } from "./team-roles";

/** A protected profile alone is insufficient after its account membership is revoked. */
export async function hasAccountOwnerAccess(
  supabase: SupabaseClient,
  input: { userId: string; accountId: string; profileRole: string | null },
): Promise<boolean> {
  if (!input.accountId || !canManageDashboardConfig(input.profileRole)) return false;
  const { data, error } = await supabase
    .from("account_memberships")
    .select("role")
    .eq("user_id", input.userId)
    .eq("account_id", input.accountId)
    .maybeSingle();
  return !error && canManageDashboardConfig(data?.role);
}
