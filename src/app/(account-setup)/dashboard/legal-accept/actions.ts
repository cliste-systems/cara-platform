"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMissingLegalAcceptances, recordLegalAcceptances } from "@/lib/legal-acceptances";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { userNeedsPassword } from "@/lib/invite-onboarding";
import { validateLegalAgreementInput } from "@/lib/legal-agreement-input";
import { buildSecurityEventContext, logSecurityEvent } from "@/lib/security-events";
import { createAdminClient } from "@/utils/supabase/admin";

export type AcceptLegalDocumentsResult = { ok: true } | { ok: false; message: string };

export async function acceptLegalDocuments(_: unknown, formData: FormData): Promise<AcceptLegalDocumentsResult> {
  const session = await requireDashboardSession({ allowOnboarding: true });
  if (userNeedsPassword(session.user)) redirect("/dashboard/set-password");
  if (session.isLocalPreview) return { ok: false, message: "Sign in with your invitation to accept agreements." };
  const admin = createAdminClient();
  const { data: account, error } = await admin.from("accounts").select("id, name")
    .eq("id", session.accountId).single();
  if (error || !account) return { ok: false, message: "Your organisation could not be loaded. Please try again." };
  // Prevent accepting against a different account after switching in another tab.
  if (formData.get("account_id") !== account.id || formData.get("organisation_name") !== account.name) {
    return { ok: false, message: "Your organisation details have changed. Refresh this page before continuing." };
  }
  const missing = await getMissingLegalAcceptances(admin, {
    userId: session.user.id, organizationId: session.organizationId, needsDpa: true,
  });
  if (!missing.length) redirect("/dashboard");
  const validationError = validateLegalAgreementInput(formData, missing);
  if (validationError) return { ok: false, message: validationError };
  const ctx = buildSecurityEventContext(await headers());
  try {
    await recordLegalAcceptances(admin, {
      userId: session.user.id, organizationId: session.organizationId, documents: missing, context: ctx,
      agreement: {
        accountId: account.id, organisationName: account.name,
        signatoryName: String(formData.get("signatory_name")).trim(),
        signatoryRole: String(formData.get("signatory_role")).trim(), authorityConfirmed: true,
      },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save your agreement. Please try again." };
  }
  // Acceptance is already durably recorded; an optional audit event must not block access.
  await logSecurityEvent(ctx, {
    eventType: "legal_acceptance", outcome: "success", actorUserId: session.user.id,
    actorEmail: session.user.email, metadata: { documents: missing, accountId: account.id, organizationId: session.organizationId },
  }).catch((err) => console.warn("[legal] audit event unavailable", err));
  redirect("/dashboard");
}
