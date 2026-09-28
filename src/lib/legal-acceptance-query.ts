import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL_DOCUMENT_VERSIONS, requiredLegalDocuments, type LegalDocumentType } from "@/lib/legal-documents";

/** Use the store only to resolve the legal organisation; agreements cover its stores. */
export async function findMissingAccountLegalDocuments(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<LegalDocumentType[]> {
  const required = requiredLegalDocuments(true);
  const { data: org, error: orgError } = await admin.from("organizations")
    .select("account_id").eq("id", organizationId).maybeSingle();
  if (orgError || !org?.account_id) return required;
  const { data, error } = await admin.from("legal_acceptances")
    .select("document_type, document_version")
    .eq("user_id", userId).eq("account_id", org.account_id)
    .eq("authority_confirmed", true).in("document_type", required);
  if (error) return required;
  return missingCurrentLegalDocuments(data ?? [], required);
}

export function missingCurrentLegalDocuments(
  rows: { document_type: string; document_version: string }[],
  required: LegalDocumentType[] = requiredLegalDocuments(true),
): LegalDocumentType[] {
  return required.filter((doc) => !rows.some((row) =>
    row.document_type === doc && row.document_version === LEGAL_DOCUMENT_VERSIONS[doc]));
}
