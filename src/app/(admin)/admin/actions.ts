"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { DEFAULT_APP_SITE_URL } from "@/lib/company-details";
import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { buildRetailRoutePack } from "@/lib/retail-route-pack";
import { isPlanTier, type PlanTier } from "@/lib/cliste-plans";
import {
  purchasePhoneNumbers,
  searchAvailableUsPhoneNumbers,
} from "@/lib/livekit-phone-numbers";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import {
  createSupportDashboardCookieValue,
  SUPPORT_DASHBOARD_COOKIE,
  supportDashboardCookieOptions,
} from "@/lib/support-dashboard-cookie";
import { LOCAL_DEV_APP_ORIGIN } from "@/lib/booking-site-origin";
import { geocodeIrelandLocation } from "@/lib/geocode-ireland";
import { livekitUsNumbersEnabled } from "@/lib/livekit-us-numbers-flag";
import { loadOrganizationProvisioning } from "@/lib/load-provisioning-pipeline";
import { TENANT_PROVISIONING_STEP_ORDER } from "@/lib/tenant-provisioning-status";
import {
  type OrganizationNiche,
  isOrganizationNiche,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import { userNeedsPassword } from "@/lib/invite-onboarding";
import { userHasCurrentLegalAcceptances } from "@/lib/legal-acceptance-status";
import { clientSlug, supportsInvoiceClientSetup, type ClientAccountOption, type ClientAccountSelection } from "@/lib/admin-client-account";
import { deliverClientInvitation, findClientAuthUser, validateClientAccountUser } from "@/lib/admin-client-invitation";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { requireAdminSessionUser } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function assertAdminOperator(): Promise<User> {
  return requireAdminSessionUser();
}

/**
 * Best-effort wrapper around `logSecurityEvent` for admin actions. Always
 * resolves; never throws — audit-log gaps are noisy in dev but should not
 * cascade-fail the admin action that produced them.
 */
async function recordAdminEvent(
  actor: User,
  payload: {
    eventType: string;
    outcome: "success" | "failure";
    targetUserId?: string | null;
    targetEmail?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const ctx = buildSecurityEventContext(await headers());
    await logSecurityEvent(ctx, {
      eventType: payload.eventType,
      outcome: payload.outcome,
      actorUserId: actor.id,
      actorEmail: actor.email ?? null,
      targetUserId: payload.targetUserId ?? null,
      targetEmail: payload.targetEmail ?? null,
      metadata: payload.metadata ?? {},
    });
  } catch (err) {
    console.warn("[admin] failed to record security event", payload.eventType, err);
  }
}

function parseRefererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
  } catch {
    /* ignore */
  }
  return null;
}

function headerDerivedOrigin(headerList: Headers): string | null {
  const forwardedHost = headerList.get("x-forwarded-host")?.split(",")[0]?.trim();
  const rawHost = forwardedHost ?? headerList.get("host");
  if (!rawHost) return null;
  const rawProto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  const proto = rawProto.toLowerCase() === "https" ? "https" : "http";
  return `${proto}://${rawHost}`;
}

function normalizeClientOrigin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function normalizeConfiguredOrigin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().replace(/\/$/, "");
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // Allow host-only env values (e.g. my-app.vercel.app).
    if (/^[a-z0-9.-]+$/i.test(value)) {
      return `https://${value}`;
    }
  }
  return null;
}

function isDevLocalOrLanHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname === "[::1]" || hostname === "::1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/**
 * Origin embedded in magic-link `redirect_to`. Must match how the browser
 * actually reaches this app, or Supabase redirects to a dead host
 * (ERR_CONNECTION_REFUSED).
 *
 * `clientOrigin` comes from `window.location.origin` so LAN / 127.0.0.1 /
 * hostname variants match even when Referer is missing (e.g. some Server
 * Action requests). It is only trusted when it matches Referer or Host, or
 * in development when it is a local/LAN URL.
 */
async function getAppOriginForRedirect(
  clientOrigin?: string | null
): Promise<string> {
  const h = await headers();
  const refererOrigin = parseRefererOrigin(h.get("referer"));
  const headerOrigin = headerDerivedOrigin(h);
  const hint = normalizeClientOrigin(clientOrigin);

  /**
   * In development, `NEXT_PUBLIC_APP_URL` is often copied from production.
   * For Server Actions that pass `window.location.origin` (e.g. admin “Open
   * dashboard”), prefer the **actual request host** over that env value so
   * Supabase `redirect_to` stays on localhost. Requires `hint === headerOrigin`
   * so the browser cannot spoof a foreign origin.
   */
  if (process.env.NODE_ENV === "development" && hint && headerOrigin && hint === headerOrigin) {
    try {
      const { hostname } = new URL(hint);
      if (isDevLocalOrLanHostname(hostname)) {
        return hint;
      }
    } catch {
      /* ignore */
    }
  }

  const explicit = normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit;

  const vercelProduction = normalizeConfiguredOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  );
  if (vercelProduction) return vercelProduction;

  const vercelPreview = normalizeConfiguredOrigin(process.env.VERCEL_URL);
  if (vercelPreview) return vercelPreview;

  if (hint) {
    if (refererOrigin && hint === refererOrigin) return hint;
    if (headerOrigin && hint === headerOrigin) return hint;
    if (process.env.NODE_ENV === "development") {
      try {
        const { hostname } = new URL(hint);
        if (isDevLocalOrLanHostname(hostname)) return hint;
      } catch {
        /* ignore */
      }
    }
  }

  // In production, refuse to derive the magic-link origin from request
  // headers. `referer`, `host`, and `x-forwarded-host` are all attacker-
  // controllable, and a forged value would land in the Supabase-sent invite
  // email — a phishing primitive. If env-derived origins were not set, we
  // fall back to the canonical production host instead.
  if (process.env.NODE_ENV !== "production") {
    if (refererOrigin) return refererOrigin;
    if (headerOrigin) return headerOrigin;
    return LOCAL_DEV_APP_ORIGIN;
  }
  return DEFAULT_APP_SITE_URL;
}

export type CreateOrganizationResult =
  | { ok: true; organizationId: string; accountId: string; inviteSent: boolean; warning?: string }
  | { ok: false; message: string };

function formatAuthError(message: string): string {
  if (/rate limit|too many emails/i.test(message)) {
    return "The email service is temporarily limiting invitations. Wait a few minutes and retry the invitation.";
  }
  return message;
}

export async function listClientAccounts(): Promise<
  { ok: true; accounts: ClientAccountOption[] } | { ok: false; message: string }
> {
  await assertAdminOperator();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("accounts")
      .select("id, name, billing_email, billing_contact_name, billing_address, billing_vat_number, billing_method, platform_subscription_id, organizations(id, niche)")
      .eq("status", "active")
      .or("billing_method.eq.manual_invoice,billing_method.is.null")
      .order("name");
    if (error) throw new Error(error.message);
    return { ok: true, accounts: (data ?? []).filter((account) => supportsInvoiceClientSetup({ billingMethod: account.billing_method, subscriptionId: account.platform_subscription_id, storeNiches: account.organizations.map((store) => store.niche) })).map((account) => ({
      id: account.id,
      name: account.name,
      billing_email: account.billing_email,
      billing_contact_name: account.billing_contact_name,
      billing_address: account.billing_address,
      billing_vat_number: account.billing_vat_number,
      billing_method: account.billing_method,
      storeCount: account.organizations?.length ?? 0,
    })) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not load organisations." };
  }
}

export async function createOrganization(payload: {
  name: string;
  slug: string;
  tier: "connect" | "native";
  planTier?: PlanTier;
  ownerEmail: string;
  ownerName: string;
  ownerMobile?: string | null;
  assignPhoneNumber?: boolean;
  niche?: OrganizationNiche;
  account: ClientAccountSelection;
  address?: string | null;
  storefrontEircode?: string | null;
  clientOrigin?: string | null;
}): Promise<CreateOrganizationResult> {
  const operator = await assertAdminOperator();
  const name = payload.name.trim();
  const slug = payload.slug.trim().toLowerCase();
  const ownerEmail = payload.ownerEmail.trim().toLowerCase();
  const ownerName = payload.ownerName.trim();
  const address = payload.address?.trim() || null;
  const storefrontEircode = payload.storefrontEircode?.trim().toUpperCase() || null;
  const assignPhoneNumber = payload.assignPhoneNumber !== false;
  const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || name.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    return { ok: false, message: "Enter a store name and a valid store identifier (letters, numbers and hyphens)." };
  }
  if (!ownerName || !validEmail(ownerEmail)) return { ok: false, message: "Enter the client's name and a valid invitation email." };
  if (payload.niche && payload.niche !== "retail") return { ok: false, message: "New clients must be retail stores." };
  const selection = payload.account;
  if (!selection || !["new", "existing"].includes(selection.mode)) return { ok: false, message: "Create or select the legal organisation that owns this store." };
  if (selection.mode === "existing" && !UUID_RE.test(selection.id)) return { ok: false, message: "Select a valid organisation." };
  if (selection.mode === "new" && (!selection.name.trim() || !validEmail(selection.billingEmail.trim()) || !selection.billingAddress.trim())) {
    return { ok: false, message: "The legal organisation name, invoice email and billing address are required." };
  }

  let organizationId: string | null = null;
  let accountId: string | null = null;
  let inviteSent = false;
  try {
    const admin = createAdminClient();
    const existingUser = await findClientAuthUser(admin, ownerEmail);
    await validateClientAccountUser(admin, existingUser, selection.mode === "existing" ? selection.id : null);
    let accountName: string;
    let planTier: PlanTier = "pro";
    let isPrimaryLocation = true;
    let existingBillingUpdate: Record<string, string> | null = null;
    if (selection.mode === "existing") {
      const { data: account, error } = await admin.from("accounts")
        .select("id, name, status, plan_tier, billing_method, billing_email, billing_address, platform_subscription_id, organizations(niche)")
        .eq("id", selection.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!account || account.status !== "active" || !supportsInvoiceClientSetup({ billingMethod: account.billing_method, subscriptionId: account.platform_subscription_id, storeNiches: account.organizations.map((store) => store.niche) })) {
        return { ok: false, message: "Select an active organisation with invoice billing. Refresh the organisation list and try again." };
      }
      const invoiceEmail = account.billing_email?.trim() || selection.billingEmail?.trim().toLowerCase();
      const invoiceAddress = account.billing_address?.trim() || selection.billingAddress?.trim();
      if (!invoiceEmail || !validEmail(invoiceEmail) || !invoiceAddress) return { ok: false, message: "Add the organisation’s invoice email and billing address before continuing." };
      existingBillingUpdate = { billing_method: "manual_invoice" };
      if (!account.billing_email?.trim()) existingBillingUpdate.billing_email = invoiceEmail;
      if (!account.billing_address?.trim()) existingBillingUpdate.billing_address = invoiceAddress;
      accountId = account.id;
      accountName = account.name;
      planTier = isPlanTier(account.plan_tier) ? account.plan_tier : "pro";
      const { count, error: countError } = await admin.from("organizations").select("id", { count: "exact", head: true }).eq("account_id", account.id);
      if (countError) throw new Error(countError.message);
      isPrimaryLocation = count === 0;
    } else {
      accountName = selection.name.trim();
      const { data: account, error } = await admin.from("accounts").insert({
        name: accountName,
        slug: `${clientSlug(accountName) || "organisation"}-${crypto.randomUUID().slice(0, 8)}`,
        status: "active",
        launch_status: "not_started",
        plan_tier: planTier,
        billing_method: "manual_invoice",
        billing_email: selection.billingEmail.trim().toLowerCase(),
        billing_contact_name: selection.billingContactName?.trim() || null,
        billing_address: selection.billingAddress.trim(),
        billing_vat_number: selection.billingVatNumber?.trim() || null,
      }).select("id").single();
      if (error || !account) throw new Error(error?.message ?? "Could not create the organisation.");
      accountId = account.id;
    }
    if (existingBillingUpdate) {
      const { error: billingError } = await admin.from("accounts").update(existingBillingUpdate).eq("id", accountId);
      if (billingError) throw new Error(`Invoice billing could not be updated: ${billingError.message}`);
    }
    const geoQuery = [address, storefrontEircode].filter(Boolean).join(", ");
    const coordinates = geoQuery ? await geocodeIrelandLocation(geoQuery) : null;
    const { data: store, error: storeError } = await admin.from("organizations").insert({
      account_id: accountId,
      is_primary_location: isPrimaryLocation,
      name,
      slug,
      tier: "native",
      plan_tier: planTier,
      niche: "retail",
      status: "active",
      onboarding_step: 7,
      is_active: false,
      notification_phone: payload.ownerMobile?.trim() || null,
      address,
      storefront_eircode: storefrontEircode,
      storefront_map_lat: coordinates?.lat ?? null,
      storefront_map_lng: coordinates?.lng ?? null,
      agent_location_address: address,
      agent_location_eircode: storefrontEircode,
      retail_banner: "supervalu",
      routing_links: buildRetailRoutePack({}),
    }).select("id").single();
    if (storeError || !store) {
      // Only this request's unused parent may be removed. Existing organisations and users are never deleted.
      if (selection.mode === "new") await admin.from("accounts").delete().eq("id", accountId);
      throw new Error(storeError?.message ?? "Could not save the store.");
    }
    organizationId = store.id;
    const { data: invite, error: inviteError } = await admin.from("admin_invites").insert({
      organization_id: organizationId,
      email: ownerEmail,
      recipient_name: ownerName,
      invited_by: UUID_RE.test(operator.id) ? operator.id : null,
      user_id: existingUser?.id ?? null,
      sent_at: null,
      delivery_status: "pending",
    }).select("id").single();
    if (inviteError || !invite) throw new Error(`The store was saved, but the invitation record could not be saved: ${inviteError?.message ?? "unknown error"}`);

    const appOrigin = await getAppOriginForRedirect(payload.clientOrigin);
    const invitation = await deliverClientInvitation({
      admin, inviteId: invite.id, organizationId: store.id, accountId: accountId!,
      email: ownerEmail, recipientName: ownerName, businessName: name, organizationName: accountName,
      redirectTo: `${appOrigin}/auth/callback`,
    });
    inviteSent = invitation.ok;
    const warnings: string[] = [];
    if (!invitation.ok) warnings.push(`The store is saved. The invitation was not sent: ${formatAuthError(invitation.message)} Retry the invitation below; do not create the store again.`);
    else if (invitation.warning) warnings.push(invitation.warning);
    if (assignPhoneNumber) {
      try {
        const phone = await provisionOrganizationPhoneNumber(store.id);
        if (!phone.ok) warnings.push(`Phone assignment needs attention: ${phone.message}`);
      } catch {
        warnings.push("The store is saved, but a phone number could not be assigned. Assign it from the store setup page.");
      }
    }
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    await recordAdminEvent(operator, {
      eventType: "admin_organization_created", outcome: "success",
      targetUserId: invitation.ok ? invitation.userId : existingUser?.id,
      targetEmail: ownerEmail,
      metadata: { organization_id: store.id, account_id: accountId, slug, niche: "retail", billing_method: "manual_invoice", invite_sent: inviteSent },
    });
    return { ok: true, organizationId: store.id, accountId: accountId!, inviteSent, warning: warnings.join(" ") || undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Client setup could not be completed.";
    await recordAdminEvent(operator, { eventType: "admin_organization_create_failed", outcome: "failure", targetEmail: ownerEmail, metadata: { organization_id: organizationId, account_id: accountId, reason: message } });
    if (organizationId && accountId) {
      revalidatePath("/admin/customers");
      return { ok: true, organizationId, accountId, inviteSent, warning: `${message} Your store has been kept. Open the store to finish setup; do not create it again.` };
    }
    return { ok: false, message };
  }
}

export type ResendOrganizationInviteResult =
  | { ok: true; warning?: string }
  | { ok: false; message: string };

export async function resendOrganizationInvite(
  organizationId: string,
  savedContact?: { email: string; name: string },
): Promise<ResendOrganizationInviteResult> {
  const operator = await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Invalid store id." };
  try {
    const admin = createAdminClient();
    const { data: org, error: orgError } = await admin.from("organizations")
      .select("id, name, account_id, accounts(name)").eq("id", id).maybeSingle();
    if (orgError || !org?.account_id) return { ok: false, message: orgError?.message ?? "Store not found." };
    const { data: existingInvite, error: inviteError } = await admin.from("admin_invites")
      .select("id, email, recipient_name, accepted_at").eq("organization_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (inviteError) return { ok: false, message: inviteError.message };
    let invite = existingInvite;
    if (!invite && savedContact) {
      const email = savedContact.email.trim().toLowerCase();
      const name = savedContact.name.trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "A valid client contact is required to retry setup." };
      const user = await findClientAuthUser(admin, email);
      await validateClientAccountUser(admin, user, org.account_id);
      const { data: saved, error } = await admin.from("admin_invites").insert({
        organization_id: id, email, recipient_name: name, user_id: user?.id ?? null,
        invited_by: UUID_RE.test(operator.id) ? operator.id : null, sent_at: null, delivery_status: "pending",
      }).select("id, email, recipient_name, accepted_at").single();
      if (error) return { ok: false, message: `The store is saved, but its invitation could not be recorded: ${error.message}` };
      invite = saved;
    }
    if (!invite?.email) return { ok: false, message: "No invitation is on file for this store. Its contact must be added before an invitation can be sent." };
    if (invite.accepted_at) {
      const invitedUser = await findClientAuthUser(admin, invite.email);
      if (invitedUser && !userNeedsPassword(invitedUser) && await userHasCurrentLegalAcceptances(invitedUser.id, id)) {
        return { ok: false, message: "This client has already completed account setup. They can sign in with their existing password." };
      }
    }
    const appOrigin = await getAppOriginForRedirect(null);
    const account = Array.isArray(org.accounts) ? org.accounts[0] : org.accounts;
    const sent = await deliverClientInvitation({
      admin, inviteId: invite.id, organizationId: id, accountId: org.account_id,
      email: invite.email, recipientName: invite.recipient_name ?? "", businessName: org.name,
      organizationName: account?.name ?? org.name, redirectTo: `${appOrigin}/auth/callback`,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath(`/admin/organizations/${id}`);
    if (!sent.ok) return { ok: false, message: formatAuthError(sent.message) };
    await recordAdminEvent(operator, { eventType: "admin_invite_resent", outcome: "success", targetUserId: sent.userId, targetEmail: invite.email, metadata: { organization_id: id, account_id: org.account_id } });
    return { ok: true, warning: sent.warning };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The invitation could not be sent." };
  }
}

export type UpdateOrganizationNicheResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateOrganizationNiche(
  organizationId: string,
  niche: string,
): Promise<UpdateOrganizationNicheResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }
  if (!isOrganizationNiche(niche)) {
    return { ok: false, message: "Invalid niche." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin
    .from("organizations")
    .update({
      niche,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export type DeleteOrganizationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Remove a store without deleting logins that belong to the wider organisation. */
export async function deleteOrganization(organizationId: string): Promise<DeleteOrganizationResult> {
  const operator = await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Invalid store id." };
  try {
    const admin = createAdminClient();
    const { data: store, error: storeError } = await admin.from("organizations")
      .select("id, account_id, is_primary_location").eq("id", id).maybeSingle();
    if (storeError || !store) return { ok: false, message: storeError?.message ?? "Store not found." };
    let replacementId: string | null = null;
    if (store.account_id) {
      const { data: remaining, error: remainingError } = await admin.from("organizations")
        .select("id").eq("account_id", store.account_id).neq("id", id)
        .order("is_primary_location", { ascending: false }).order("created_at", { ascending: true }).limit(1);
      if (remainingError) throw new Error(remainingError.message);
      replacementId = remaining?.[0]?.id ?? null;
      if (replacementId) {
        // Move both legacy and active references before the deleted store's FK cascade runs.
        const { error: profileError } = await admin.from("profiles").update({
          organization_id: replacementId, active_organization_id: replacementId,
          updated_at: new Date().toISOString(),
        }).eq("account_id", store.account_id).or(`organization_id.eq.${id},active_organization_id.eq.${id}`);
        if (profileError) throw new Error(profileError.message);
        if (store.is_primary_location) {
          const { error: oldPrimaryError } = await admin.from("organizations").update({ is_primary_location: false }).eq("id", id);
          if (oldPrimaryError) throw new Error(oldPrimaryError.message);
          const { error: primaryError } = await admin.from("organizations").update({ is_primary_location: true }).eq("id", replacementId).eq("account_id", store.account_id);
          if (primaryError) throw new Error(primaryError.message);
        }
      }
    }
    const { error: deleteError } = await admin.from("organizations").delete().eq("id", id);
    if (deleteError) throw new Error(deleteError.message);
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    revalidatePath("/dashboard", "layout");
    await recordAdminEvent(operator, { eventType: "admin_organization_deleted", outcome: "success", metadata: { organization_id: id, account_id: store.account_id, replacement_organization_id: replacementId, deleted_user_count: 0 } });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the store.";
    await recordAdminEvent(operator, { eventType: "admin_organization_delete_failed", outcome: "failure", metadata: { organization_id: id, reason: message } });
    return { ok: false, message };
  }
}

export type SupportDashboardLinkResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/** Generates a sign-in link so support can open the client dashboard as a member. */
export async function createSupportDashboardLink(
  organizationId: string,
  clientOrigin?: string | null
): Promise<SupportDashboardLinkResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: store, error: storeError } = await admin.from("organizations")
    .select("account_id").eq("id", id).maybeSingle();
  if (storeError || !store?.account_id) return { ok: false, message: storeError?.message ?? "Store not found." };
  const { data: rows, error: listError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("account_id", store.account_id);

  if (listError) {
    return { ok: false, message: listError.message };
  }
  if (!rows?.length) {
    return {
      ok: false,
      message: "This organization has no members to sign in as.",
    };
  }

  const target =
    rows.find((r) => r.role === "admin") ??
    rows.find((r) => r.role === "member") ??
    rows[0];

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(target.id);

  if (userError || !userData.user) {
    return {
      ok: false,
      message: userError?.message ?? "Could not load that user from Auth.",
    };
  }

  const email = userData.user.email?.trim();
  if (!email) {
    return {
      ok: false,
      message:
        "This account has no email (e.g. phone-only). Sign-in links require an email identity.",
    };
  }

  const origin = await getAppOriginForRedirect(clientOrigin);
  const redirectTo = `${origin}/auth/callback`;

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return {
      ok: false,
      message: linkError?.message
        ? formatAuthError(linkError.message)
        : "Could not generate a sign-in link. Check Supabase Auth settings and redirect URL allowlist.",
    };
  }

  const supportCookieValue = await createSupportDashboardCookieValue({ userId: target.id, accountId: store.account_id, organizationId: id });
  if (!supportCookieValue) return { ok: false, message: "Secure support access is not configured. Set the support dashboard signing secret before opening a client dashboard." };
  if (supportCookieValue) {
    (await cookies()).set(
      SUPPORT_DASHBOARD_COOKIE,
      supportCookieValue,
      supportDashboardCookieOptions()
    );
  }

  return { ok: true, url: linkData.properties.action_link };
}

export type AdminCloseSupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function adminCloseSupportTicket(
  ticketId: string
): Promise<AdminCloseSupportTicketResult> {
  await assertAdminOperator();
  const id = ticketId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid ticket id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin
    .from("support_tickets")
    .update({
      status: "closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard/support");
  return { ok: true };
}

const MAX_SUPPORT_REPLY = 8000;

export type AdminReplySupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function adminReplyToSupportTicket(
  ticketId: string,
  body: string
): Promise<AdminReplySupportTicketResult> {
  await assertAdminOperator();
  const id = ticketId.trim();
  const text = body.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid ticket id." };
  }
  if (!text) {
    return { ok: false, message: "Please enter a reply." };
  }
  if (text.length > MAX_SUPPORT_REPLY) {
    return {
      ok: false,
      message: `Reply must be at most ${MAX_SUPPORT_REPLY} characters.`,
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: ticket, error: loadErr } = await admin
    .from("support_tickets")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !ticket) {
    return { ok: false, message: loadErr?.message ?? "Ticket not found." };
  }

  const { error } = await admin.from("support_ticket_messages").insert({
    ticket_id: id,
    author_kind: "admin",
    body: text,
    created_by: null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await admin
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard/support");
  return { ok: true };
}

export type AssignLivekitUsPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; message: string };

/**
 * Search LiveKit US inventory, purchase the first available number, save E.164
 * to `organizations.phone_number` for the voice agent / routing.
 *
 * Env: LIVEKIT_URL (wss or https), LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
 * Optional: LIVEKIT_SIP_DISPATCH_RULE_ID — links the number to your inbound SIP rule in Cloud.
 */
export async function assignLivekitUsPhoneToOrganization(
  organizationId: string
): Promise<AssignLivekitUsPhoneResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, phone_number, niche")
    .eq("id", id)
    .maybeSingle();

  if (orgErr || !org) {
    return { ok: false, message: orgErr?.message ?? "Organization not found." };
  }
  if (!livekitUsNumbersEnabled()) {
    return {
      ok: false,
      message:
        "LiveKit US numbers are disabled. Set CLISTE_ENABLE_LIVEKIT_US_NUMBERS=1 to enable.",
    };
  }
  if (parseOrganizationNiche(org.niche) === "retail") {
    return {
      ok: false,
      message: "Retail stores use the Irish Twilio pool — not LiveKit US numbers.",
    };
  }
  if (org.phone_number?.trim()) {
    return {
      ok: false,
      message:
        "This organization already has a phone number. Remove or change it in Supabase before assigning another LiveKit number (release the old number in LiveKit Cloud if it is no longer needed).",
    };
  }

  let available: string[];
  try {
    available = await searchAvailableUsPhoneNumbers(25);
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `LiveKit search failed: ${e.message}`
          : "LiveKit search failed. Check LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env.local.",
    };
  }

  if (available.length === 0) {
    return {
      ok: false,
      message:
        "No US numbers available from LiveKit right now. Check telephony is enabled and quotas in LiveKit Cloud.",
    };
  }

  const pick = available[0]!;
  const dispatchId = process.env.LIVEKIT_SIP_DISPATCH_RULE_ID?.trim() || null;

  let purchased: string[];
  try {
    purchased = await purchasePhoneNumbers([pick], dispatchId);
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `LiveKit purchase failed: ${e.message}`
          : "LiveKit purchase failed.",
    };
  }

  const e164 = purchased[0] ?? pick;

  const { error: upErr } = await admin
    .from("organizations")
    .update({
      phone_number: e164,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) {
    return {
      ok: false,
      message: `Number ${e164} was purchased but could not be saved: ${upErr.message}`,
    };
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  return { ok: true, e164 };
}

export type AssignPoolPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; message: string };

/**
 * Give a tenant its Cliste number from the Irish Twilio pool (buying one when
 * the pool is empty). Idempotent — returns the existing number if assigned.
 */
export async function assignPoolPhoneToOrganization(
  organizationId: string,
): Promise<AssignPoolPhoneResult> {
  const operator = await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  const result = await provisionOrganizationPhoneNumber(id);
  if (!result.ok) {
    await recordAdminEvent(operator, {
      eventType: "admin_phone_assign_failed",
      outcome: "failure",
      metadata: { organization_id: id, reason: result.message },
    });
    return { ok: false, message: result.message };
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/phone-pool");
  await recordAdminEvent(operator, {
    eventType: "admin_phone_assigned",
    outcome: "success",
    metadata: { organization_id: id, e164: result.e164 },
  });
  return { ok: true, e164: result.e164 };
}

export type ReleasePoolPhoneResult =
  | { ok: true }
  | { ok: false; message: string };

export async function releasePoolPhoneFromOrganization(
  organizationId: string,
): Promise<ReleasePoolPhoneResult> {
  const operator = await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  const { releaseOrganizationPhoneNumber } = await import("@/lib/phone-pool");
  const result = await releaseOrganizationPhoneNumber(id);
  if (!result.ok) {
    return result;
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/phone-pool");
  revalidatePath("/admin/customers");
  await recordAdminEvent(operator, {
    eventType: "admin_phone_released",
    outcome: "success",
    metadata: { organization_id: id },
  });
  return { ok: true };
}

export type SendDivertCodesResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendDivertCodesToOwner(
  organizationId: string,
): Promise<SendDivertCodesResult> {
  const operator = await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, phone_number, niche")
    .eq("id", id)
    .maybeSingle();

  if (!org?.phone_number?.trim()) {
    return {
      ok: false,
      message: "Assign a Cliste number before sending divert codes.",
    };
  }

  const { data: invite } = await admin
    .from("admin_invites")
    .select("email, recipient_name")
    .eq("organization_id", id)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  let recipientEmail = invite?.email?.trim() ?? "";
  if (!recipientEmail && ownerProfile?.id) {
    const { data: userData } = await admin.auth.admin.getUserById(
      ownerProfile.id as string,
    );
    recipientEmail = userData.user?.email?.trim() ?? "";
  }

  if (!recipientEmail) {
    return { ok: false, message: "No owner email on file for this store." };
  }

  const { sendDivertCodesEmail } = await import("@/lib/divert-codes-email");
  const sent = await sendDivertCodesEmail({
    organizationId: id,
    recipientEmail,
    recipientName: String(invite?.recipient_name ?? ""),
    businessName: String(org.name ?? ""),
    clisteNumber: String(org.phone_number),
  });

  if (!sent.ok) return sent;

  revalidatePath(`/admin/organizations/${id}`);
  await recordAdminEvent(operator, {
    eventType: "admin_divert_codes_sent",
    outcome: "success",
    targetEmail: recipientEmail,
    metadata: { organization_id: id },
  });
  return { ok: true };
}

export async function retryTwilioIe1MessagingRegion(
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("phone_number")
    .eq("id", id)
    .maybeSingle();

  const e164 = org?.phone_number?.trim();
  if (!e164) {
    return { ok: false, message: "No Cliste number assigned." };
  }

  const { ensureTwilioIe1MessagingRegion } = await import(
    "@/lib/twilio-ie-messaging"
  );
  const result = await ensureTwilioIe1MessagingRegion(e164);
  if (!result.ok) return result;

  revalidatePath(`/admin/organizations/${id}`);
  return { ok: true };
}

export type UpdateCallRoutingResult =
  | { ok: true }
  | { ok: false; message: string };

const MAX_TRANSFER_PHONE = 32;

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function phonesWouldLoop(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  return da === db;
}

/** Sets how the store's own number reaches Cara plus the human transfer target. */
export async function updateOrganizationCallRouting(
  organizationId: string,
  payload: {
    callRoutingMode: CallRoutingMode;
    transferNumber: string;
    storePublicNumber?: string;
    divertCarrier?: string;
  },
): Promise<UpdateCallRoutingResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  const callRoutingMode = parseCallRoutingMode(payload?.callRoutingMode);
  const transferNumber = callRoutingAllowsHumanTransfer(callRoutingMode)
    ? String(payload?.transferNumber ?? "").trim()
    : "";
  const storePublicNumber = String(payload?.storePublicNumber ?? "").trim();
  const divertCarrier = String(payload?.divertCarrier ?? "").trim();

  if (transferNumber.length > MAX_TRANSFER_PHONE) {
    return { ok: false, message: "Transfer number looks too long." };
  }

  if (
    callRoutingAllowsHumanTransfer(callRoutingMode) &&
    storePublicNumber &&
    transferNumber &&
    phonesWouldLoop(storePublicNumber, transferNumber)
  ) {
    return {
      ok: false,
      message:
        "Transfer number must not be the same as the store's public/diverted line — use a manager mobile or a desk extension that is not forwarded to Cara.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data, error } = await admin
    .from("organizations")
    .update({
      call_routing_mode: callRoutingMode,
      fallback_number: transferNumber || null,
      ...(payload.storePublicNumber !== undefined
        ? { store_public_number: storePublicNumber || null }
        : {}),
      ...(payload.divertCarrier !== undefined
        ? { divert_carrier: divertCarrier || null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.length) {
    return { ok: false, message: "Organization not found." };
  }

  // Routing mode / transfer number feed Cara's call-handling prompt.
  await regenerateCaraCustomPrompt(admin, id);

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export type SetOrganizationLiveResult =
  | { ok: true }
  | { ok: false; message: string };

const GO_LIVE_STEP_IDS = ["phone_assigned", "legal_acceptance"] as const;

export async function setOrganizationLive(
  organizationId: string,
  live: boolean,
): Promise<SetOrganizationLiveResult> {
  const operator = await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  if (live) {
    const provisioning = await loadOrganizationProvisioning(id);
    if (!provisioning) {
      return { ok: false, message: "Organization not found." };
    }
    for (const stepId of GO_LIVE_STEP_IDS) {
      const step = provisioning.steps.find((s) => s.id === stepId);
      if (!step?.complete) {
        const label =
          TENANT_PROVISIONING_STEP_ORDER.find((s) => s.id === stepId)?.label ??
          stepId;
        return {
          ok: false,
          message: `Cannot go live — complete “${label}” first.`,
        };
      }
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin
    .from("organizations")
    .update({
      is_active: live,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin/customers");
  await recordAdminEvent(operator, {
    eventType: live ? "admin_store_went_live" : "admin_store_taken_offline",
    outcome: "success",
    metadata: { organization_id: id, is_active: live },
  });
  return { ok: true };
}

export type UpdateAccountPlanTierResult =
  | { ok: true }
  | { ok: false; message: string };

/** Manual plan assignment — pilot clients are invoiced outside Stripe. */
export async function updateAccountPlanTier(
  accountId: string,
  planTier: string,
): Promise<UpdateAccountPlanTierResult> {
  const operator = await assertAdminOperator();
  const id = accountId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid account id." };
  }
  if (!isPlanTier(planTier)) {
    return { ok: false, message: "Invalid plan tier." };
  }
  const tier: PlanTier = planTier;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data, error } = await admin
    .from("accounts")
    .update({ plan_tier: tier, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.length) {
    return { ok: false, message: "Account not found." };
  }

  revalidatePath("/admin");
  await recordAdminEvent(operator, {
    eventType: "admin_account_plan_updated",
    outcome: "success",
    metadata: { account_id: id, plan_tier: tier },
  });
  return { ok: true };
}

