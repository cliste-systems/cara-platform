import "server-only";
import { redirect } from "next/navigation";
import { getMissingLegalAcceptances, type LegalDocumentType } from "@/lib/legal-acceptances";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { userNeedsPassword } from "@/lib/invite-onboarding";
import { createAdminClient } from "@/utils/supabase/admin";

export type LegalAcceptPageData = {
  missing: LegalDocumentType[];
  organizationName: string;
  accountId: string;
  storeNames: string[];
  signatoryName: string;
  billingEmail: string | null;
  invoiceBilling: boolean;
};

export async function loadLegalAcceptPageData(): Promise<LegalAcceptPageData> {
  const session = await requireDashboardSession({ allowOnboarding: true });
  if (userNeedsPassword(session.user)) redirect("/dashboard/set-password");
  const admin = createAdminClient();
  const [{ data: account, error }, { data: stores, error: storeError }, missing] = await Promise.all([
    admin.from("accounts").select("id, name, billing_email, billing_method").eq("id", session.accountId).single(),
    admin.from("organizations").select("name").eq("account_id", session.accountId).order("name"),
    getMissingLegalAcceptances(admin, { userId: session.user.id, organizationId: session.organizationId, needsDpa: true }),
  ]);
  if (error || !account || storeError) throw new Error("We could not load your organisation. Please refresh and try again.");
  if (missing.length === 0) redirect("/dashboard");
  return {
    missing,
    organizationName: account.name,
    accountId: account.id,
    storeNames: (stores ?? []).map((store) => store.name),
    signatoryName: session.profile.name ?? "",
    billingEmail: account.billing_email,
    invoiceBilling: account.billing_method === "manual_invoice",
  };
}
