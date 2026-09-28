import { LEGAL_DOCUMENT_VERSIONS, type LegalDocumentType } from "@/lib/legal-documents";

export function validateLegalAgreementInput(formData: FormData, missing: LegalDocumentType[]): string | null {
  if (formData.get("authority") !== "on") return "Please confirm you are authorised to agree on behalf of your organisation.";
  const name = String(formData.get("signatory_name") ?? "").trim();
  const role = String(formData.get("signatory_role") ?? "").trim();
  if (name.length < 2 || name.length > 160 || !role || role.length > 160) return "Enter your full name and role in the organisation.";
  for (const doc of missing) {
    if (formData.get(`version_${doc}`) !== LEGAL_DOCUMENT_VERSIONS[doc]) return "These documents have changed. Refresh this page and review the latest versions.";
    if (formData.get(`accept_${doc}`) !== "on") return "Please review and tick each required agreement and acknowledgment.";
  }
  return null;
}
