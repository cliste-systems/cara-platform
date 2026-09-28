/** Shared legal document metadata (safe for client + server). */

export type LegalDocumentType = "terms" | "privacy" | "dpa";

/** ISO date aligned with `LEGAL_LAST_UPDATED` in legal-pages.ts — bump when documents change. */
export const LEGAL_DOCUMENT_VERSIONS: Record<LegalDocumentType, string> = {
  terms: "2026-09-28",
  privacy: "2026-09-28",
  dpa: "2026-09-28",
};

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  terms: "Terms of service",
  privacy: "Privacy notice",
  dpa: "Data Processing Agreement (DPA)",
};

export const LEGAL_DOCUMENT_PATHS: Record<LegalDocumentType, string> = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  dpa: "/legal/dpa",
};

export const DASHBOARD_LEGAL_ACCEPT_PATH = "/dashboard/legal-accept";

/** Onboarding users accept terms + privacy here before other setup steps. */
export const ONBOARDING_LEGAL_ACCEPT_PATH = "/onboarding/legal";

/** Paths reachable while contractual acceptances are still outstanding. */
export const LEGAL_ACCEPTANCE_BYPASS_PREFIXES = [
  DASHBOARD_LEGAL_ACCEPT_PATH,
  ONBOARDING_LEGAL_ACCEPT_PATH,
  "/dashboard/set-password",
] as const;

export function requiredLegalDocuments(needsDpa: boolean): LegalDocumentType[] {
  // Dashboard access can expose caller data before the store goes live.
  void needsDpa;
  return ["terms", "privacy", "dpa"];
}

export function orgNeedsDpaAcceptance(org: {
  status?: string | null;
  platform_subscription_id?: string | null;
  onboarding_step?: number | null;
}): boolean {
  if (org.status === "active") return true;
  if (String(org.platform_subscription_id ?? "").trim()) return true;
  return (org.onboarding_step ?? 0) >= 7;
}

export function isLegalAcceptanceBypassPath(pathname: string): boolean {
  return LEGAL_ACCEPTANCE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
