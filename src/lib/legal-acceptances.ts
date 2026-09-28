import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LEGAL_DOCUMENT_VERSIONS,
  type LegalDocumentType,
} from "@/lib/legal-documents";
import { findMissingAccountLegalDocuments } from "@/lib/legal-acceptance-query";
import type { SecurityEventContext } from "@/lib/security-events";

export type { LegalDocumentType } from "@/lib/legal-documents";
export {
  DASHBOARD_LEGAL_ACCEPT_PATH,
  isLegalAcceptanceBypassPath,
  orgNeedsDpaAcceptance,
} from "@/lib/legal-documents";

export { getMissingBaseLegalAcceptances } from "@/lib/onboarding-legal-middleware";

export async function getMissingLegalAcceptances(
  admin: SupabaseClient,
  params: { userId: string; organizationId: string; needsDpa: boolean },
): Promise<LegalDocumentType[]> {
  return findMissingAccountLegalDocuments(admin, params.userId, params.organizationId);
}

export async function recordLegalAcceptances(
  admin: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    documents: LegalDocumentType[];
    context?: SecurityEventContext;
    agreement?: {
      accountId: string;
      organisationName: string;
      signatoryName: string;
      signatoryRole: string;
      authorityConfirmed: boolean;
    };
  },
): Promise<void> {
  const rows = params.documents.map((documentType) => ({
    user_id: params.userId,
    organization_id: params.organizationId,
    document_type: documentType,
    document_version: LEGAL_DOCUMENT_VERSIONS[documentType],
    ip_hash: params.context?.ipHash ?? null,
    user_agent: params.context?.userAgent ?? null,
    account_id: params.agreement?.accountId ?? null,
    organisation_name: params.agreement?.organisationName ?? null,
    signatory_name: params.agreement?.signatoryName ?? null,
    signatory_role: params.agreement?.signatoryRole ?? null,
    authority_confirmed: params.agreement?.authorityConfirmed ?? false,
  }));

  if (rows.length === 0) return;

  const { error } = await admin.from("legal_acceptances").insert(rows);
  if (error) {
    console.warn("[legal] failed_to_record_acceptances", error.message);
    throw new Error("Could not record legal acceptance. Please try again.");
  }
}
