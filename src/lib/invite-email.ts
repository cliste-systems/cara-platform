import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { buildInviteEmailBodies } from "@/lib/invite-email-bodies";
import { prepareInviteAuthentication } from "@/lib/invite-auth-preparation";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { isResendConfigured, sendTransactionalEmail } from "@/lib/resend-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export { buildInviteEmailBodies } from "@/lib/invite-email-bodies";

export function inviteEmailRedirectOrigin(): string {
  return resolveAppSiteOrigin().origin;
}

export function inviteEmailLogoUrl(): string {
  return `${inviteEmailRedirectOrigin()}${PUBLIC_ASSETS.logo}`;
}

export type SendInviteEmailInput = {
  email: string;
  recipientName?: string;
  businessName: string;
  productName: string;
  organizationName?: string;
  billingMethod?: "invoice" | "manual_invoice" | "card";
  managedOnboarding?: boolean;
  /** Only pass after confirming this existing user belongs to the invited account. */
  existingUserId?: string;
  /** Recovery for an unlinked, never-signed-in invitation only. */
  initializePendingSetup?: boolean;
  redirectTo?: string;
  admin?: SupabaseClient;
};

export type PreparedInviteEmail = Omit<SendInviteEmailInput, "admin" | "existingUserId" | "redirectTo"> & {
  userId: string;
  actionLink: string;
  requiresPassword: boolean;
};

export type SendInviteEmailResult =
  | { ok: true; userId: string }
  | { ok: false; message: string };

export type PrepareInviteEmailResult =
  | { ok: true; userId: string; prepared: PreparedInviteEmail }
  | { ok: false; message: string };

/** Prepare first, persist profile/membership/invite, then dispatch. Never deletes auth users. */
export async function prepareInviteEmail(input: SendInviteEmailInput): Promise<PrepareInviteEmailResult> {
  if (!isResendConfigured()) return { ok: false, message: "Email is not configured yet. Please try again later." };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address." };
  const redirectTo = input.redirectTo?.trim() || `${inviteEmailRedirectOrigin()}/auth/callback`;
  const recipientName = input.recipientName?.trim() || undefined;
  try {
    const admin = input.admin ?? createAdminClient();
    const auth = await prepareInviteAuthentication(admin, { ...input, email, redirectTo, recipientName });
    if (!auth.ok) return auth;
    const { userId, actionLink, requiresPassword } = auth;
    return {
      ok: true,
      userId,
      prepared: {
        email, recipientName, userId,
        businessName: input.businessName,
        productName: input.productName,
        organizationName: input.organizationName,
        billingMethod: input.billingMethod,
        managedOnboarding: input.managedOnboarding,
        actionLink,
        requiresPassword,
      },
    };
  } catch (error) {
    console.error("[invite] preparation failed", error instanceof Error ? error.message : "Unknown error");
    return { ok: false, message: "Could not prepare the invitation. Please try again." };
  }
}

export async function sendPreparedInviteEmail(prepared: PreparedInviteEmail): Promise<SendInviteEmailResult> {
  const bodies = buildInviteEmailBodies({ ...prepared, logoUrl: "cid:hellocara-logo" });
  try {
    const logo = await readFile(path.join(process.cwd(), "public", PUBLIC_ASSETS.logo.slice(1)));
    const sent = await sendTransactionalEmail({
      to: prepared.email, ...bodies,
      attachments: [{ filename: "hellocara.png", content: logo, contentId: "hellocara-logo" }],
      replyTo: { email: "support@hellocara.ie", name: "HelloCara Support" },
    });
    return sent.ok ? { ok: true, userId: prepared.userId } : sent;
  } catch {
    return { ok: false, message: "The invitation could not be sent. The account is saved; you can resend the invitation." };
  }
}

export async function sendInviteEmail(input: SendInviteEmailInput): Promise<SendInviteEmailResult> {
  const result = await prepareInviteEmail(input);
  if (!result.ok) return result;
  return sendPreparedInviteEmail(result.prepared);
}
