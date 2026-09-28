import { findMissingAccountLegalDocuments } from "@/lib/legal-acceptance-query";
import { createAdminClient } from "@/utils/supabase/admin";

export async function userHasCurrentLegalAcceptances(userId: string, organizationId: string): Promise<boolean> {
  return (await findMissingAccountLegalDocuments(createAdminClient(), userId, organizationId)).length === 0;
}
