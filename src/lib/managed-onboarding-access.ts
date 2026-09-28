import type { User } from "@supabase/supabase-js";

import { userNeedsPassword } from "@/lib/invite-onboarding";

export type ManagedSetupRequirement = "password" | "agreements";

/** API guard for the managed flow; existing self-serve onboarding is unaffected. */
export async function managedClientSetupRequirement(input: {
  user: Pick<User, "id" | "app_metadata">;
  organizationId: string | null | undefined;
  hasCurrentLegalAcceptances: (userId: string, organizationId: string) => Promise<boolean>;
}): Promise<ManagedSetupRequirement | null> {
  if (input.user.app_metadata?.managed_onboarding !== true) return null;
  if (userNeedsPassword(input.user)) return "password";
  if (!input.organizationId) return "agreements";
  try {
    return await input.hasCurrentLegalAcceptances(input.user.id, input.organizationId)
      ? null
      : "agreements";
  } catch {
    // An unavailable agreement check must not unlock a metered or privileged API.
    return "agreements";
  }
}
