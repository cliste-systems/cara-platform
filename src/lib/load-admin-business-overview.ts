import "server-only";
import { requireAdminPermission, requireAdminStaffContext } from "@/lib/admin-session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { createAdminClient } from "@/utils/supabase/admin";

/** Business-scoped operations; billing and memberships belong to the parent account. */
export async function loadAdminBusinessOverview(id: string) {
  await requireAdminPermission("customers");
  const staff = await requireAdminStaffContext();
  const admin = createAdminClient();
  const { data: business, error } = await admin.from("organizations").select("id, name, slug, niche, account_id, address, storefront_eircode, store_code, phone_number, store_public_number, fallback_number, call_routing_mode, divert_verified_at, is_active, status, notification_email, notification_phone, block_anonymous_callers, created_at, updated_at, offers_synced_at, catalog_synced_at, prompt_compile_warnings, admin_notes, retail_banner").eq("id", id).maybeSingle();
  if (error) throw new Error("Business details could not be loaded.");
  if (!business) return null;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const errors: string[] = [];
  const canBilling = hasAdminPermission(staff, "billing"), canCalls = hasAdminPermission(staff, "calls"), canSupport = hasAdminPermission(staff, "support");
  const [accountResult, inviteResult, membersResult, legalResult, callsResult, countResult, failedResult, supportResult, invoicesResult, ticketResult] = await Promise.all([
    admin.from("accounts").select("id, name, status, billing_method, billing_email, billing_contact_name, billing_address, billing_vat_number, plan_tier, billing_interval").eq("id", business.account_id).maybeSingle(),
    admin.from("admin_invites").select("id, user_id, email, recipient_name, sent_at, accepted_at, delivery_status, delivery_error").eq("organization_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("account_memberships").select("user_id, role").eq("account_id", business.account_id),
    admin.from("legal_acceptances").select("user_id, document_type, document_version, created_at, signatory_name, signatory_role, authority_confirmed").eq("account_id", business.account_id).order("created_at", { ascending: false }),
    canCalls ? admin.from("call_logs").select("id, created_at, caller_number, caller_name, duration_seconds, outcome, call_resolution, engineer_test_call, is_test_call, post_call_status").eq("organization_id", id).order("created_at", { ascending: false }).limit(6) : null,
    canCalls ? admin.from("call_logs").select("id", { count: "exact", head: true }).eq("organization_id", id).gte("created_at", since).not("engineer_test_call", "is", true).not("is_test_call", "is", true).not("verification_call", "is", true) : null,
    canCalls ? admin.from("call_logs").select("id", { count: "exact", head: true }).eq("organization_id", id).gte("created_at", since).eq("post_call_status", "failed").not("engineer_test_call", "is", true).not("is_test_call", "is", true) : null,
    canSupport ? admin.from("support_tickets").select("id, subject, status, updated_at").eq("organization_id", id).order("updated_at", { ascending: false }).limit(5) : null,
    canBilling ? admin.from("billing_invoices").select("id, number, status, currency, amount_remaining, total, due_date, created_at").eq("account_id", business.account_id).order("created_at", { ascending: false }).limit(5) : null,
    canCalls ? admin.from("action_tickets").select("id", { count: "exact", head: true }).eq("organization_id", id).not("status", "in", "(resolved,closed,completed)").not("engineer_test_call", "is", true) : null,
  ]);
  for (const [label, result] of [["Organisation", accountResult], ["Invitation", inviteResult], ["Account members", membersResult], ["Agreements", legalResult], ["Recent calls", callsResult], ["Call count", countResult], ["Processing failures", failedResult], ["Support tickets", supportResult], ["Invoices", invoicesResult], ["Open follow-ups", ticketResult]] as const) if (result?.error) errors.push(label);
  const ownerId = inviteResult.data?.user_id;
  const authResult = ownerId ? await admin.auth.admin.getUserById(ownerId) : null;
  if (authResult?.error) errors.push("Owner account");
  const owner = authResult?.data?.user;
  const eventScope = [`metadata->>organization_id.eq.${id}`, ...(ownerId ? [`target_user_id.eq.${ownerId}`, `actor_user_id.eq.${ownerId}`] : [])].join(",");
  const securityResult = staff.role === "owner" ? await admin.from("security_auth_events").select("id, created_at, event_type, outcome, ip_masked").or(eventScope).order("created_at", { ascending: false }).limit(6) : null;
  if (securityResult?.error) errors.push("Security activity");
  // Paginate instead of silently truncating a busy business at the API row limit.
  let minutes: number | null = canCalls ? 0 : null;
  if (canCalls) {
    for (let offset = 0; ; offset += 1000) {
      const usage = await admin.from("usage_records").select("id, minutes_billable, sync_skip_reason").eq("organization_id", id).gte("started_at", since).not("ended_at", "is", null).order("id").range(offset, offset + 999);
      if (usage.error) { minutes = null; errors.push("Billable minutes"); break; }
      for (const row of usage.data ?? []) if (!["test_data", "engineer_test_call", "test_call"].includes(row.sync_skip_reason ?? "")) minutes! += Number(row.minutes_billable ?? 0);
      if ((usage.data?.length ?? 0) < 1000) break;
    }
  }
  return { business, account: accountResult.data, invite: inviteResult.data,
    owner: owner ? { email: owner.email, createdAt: owner.created_at, lastSignInAt: owner.last_sign_in_at, emailConfirmedAt: owner.email_confirmed_at, needsPassword: owner.app_metadata?.needs_password === true, mfaEnabled: owner.factors?.some((factor) => factor.status === "verified") ?? false } : null,
    members: membersResult.data, agreements: legalResult.data, calls: callsResult?.data,
    callCount: countResult?.error ? null : countResult?.count, failedCount: failedResult?.error ? null : failedResult?.count,
    openActions: ticketResult?.error ? null : ticketResult?.count, minutes, support: supportResult?.data, invoices: invoicesResult?.data,
    security: securityResult?.data, errors, canBilling, canCalls, canSupport, isOwner: staff.role === "owner",
  };
}
