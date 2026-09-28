import "server-only";

import { userHasCurrentLegalAcceptances } from "@/lib/legal-acceptance-status";
import {
  deriveTenantProvisioningStatus,
  type TenantProvisioningInviteRow,
  type TenantProvisioningOrgRow,
  type TenantProvisioningOwnerRow,
  type TenantProvisioningPhoneRow,
} from "@/lib/tenant-provisioning-context";
import type { TenantProvisioningStatus } from "@/lib/tenant-provisioning-status";
import { createAdminClient } from "@/utils/supabase/admin";

export type PipelineOrganization = {
  org: TenantProvisioningOrgRow;
  provisioning: TenantProvisioningStatus;
  inviteEmail: string | null;
};

export async function loadProvisioningPipeline(): Promise<PipelineOrganization[]> {
  const admin = createAdminClient();

  const { data: invites } = await admin
    .from("admin_invites")
    .select("organization_id, user_id, email, sent_at, accepted_at")
    .order("sent_at", { ascending: false });

  const orgIds = [
    ...new Set((invites ?? []).map((i) => i.organization_id as string)),
  ];
  if (orgIds.length === 0) return [];

  const { data: orgs } = await admin
    .from("organizations")
    .select(
      "id, name, greeting, custom_prompt, assistant_display_name, phone_number, call_routing_mode, fallback_number, store_public_number, divert_carrier, business_hours, agent_services_departments, agent_faqs, agent_voice_id, agent_business_type, business_knowledge_summary, agent_services_not_offered, agent_extra_notes, prompt_compile_warnings, cara_online_since, niche",
    )
    .in("id", orgIds);

  const { data: phones } = await admin
    .from("phone_numbers")
    .select("organization_id, e164, status")
    .in("organization_id", orgIds)
    .eq("status", "assigned");

  const { data: profiles } = await admin
    .from("profiles")
    .select("organization_id, id, role")
    .in("organization_id", orgIds)
    .eq("role", "admin");

  const { data: callLogs } = await admin
    .from("call_logs")
    .select("organization_id")
    .in("organization_id", orgIds);

  const orgsWithCalls = new Set(
    (callLogs ?? []).map((c) => c.organization_id as string),
  );

  const phoneByOrg = new Map<string, TenantProvisioningPhoneRow>();
  for (const p of phones ?? []) {
    phoneByOrg.set(p.organization_id as string, {
      e164: String(p.e164),
      status: String(p.status),
    });
  }

  const inviteByOrg = new Map<string, TenantProvisioningInviteRow>();
  for (const inv of invites ?? []) {
    const orgId = inv.organization_id as string;
    if (!inviteByOrg.has(orgId)) {
      inviteByOrg.set(orgId, {
        sent_at: inv.sent_at ? String(inv.sent_at) : null,
        accepted_at: (inv.accepted_at as string | null) ?? null,
        email: String(inv.email),
      });
    }
  }

  const ownerByOrg = new Map<string, TenantProvisioningOwnerRow>();
  await Promise.all((orgs ?? []).map(async (org) => {
    const userId = invites?.find((invite) => invite.organization_id === org.id && invite.user_id)?.user_id
      ?? profiles?.find((profile) => profile.organization_id === org.id)?.id;
    if (!userId) return;
    ownerByOrg.set(org.id, { user_id: userId, hasLegalAcceptances: await userHasCurrentLegalAcceptances(userId, org.id) });
  }));

  const results: PipelineOrganization[] = [];
  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    const provisioning = deriveTenantProvisioningStatus({
      org: org as TenantProvisioningOrgRow,
      poolPhone: phoneByOrg.get(orgId) ?? null,
      invite: inviteByOrg.get(orgId) ?? null,
      owner: ownerByOrg.get(orgId) ?? null,
      hasInboundCallLog: orgsWithCalls.has(orgId),
    });
    results.push({
      org: org as TenantProvisioningOrgRow,
      provisioning,
      inviteEmail: inviteByOrg.get(orgId)?.email ?? null,
    });
  }

  return results.sort((a, b) => a.org.name.localeCompare(b.org.name));
}

/** Lightweight stage labels for tenant lists (skips per-user legal checks). */
export async function loadProvisioningStagesByOrgId(
  orgIds: string[],
): Promise<Map<string, TenantProvisioningStatus["stage"]>> {
  const stages = new Map<string, TenantProvisioningStatus["stage"]>();
  if (orgIds.length === 0) return stages;

  const admin = createAdminClient();
  const { data: inviteOrgIds } = await admin
    .from("admin_invites")
    .select("organization_id")
    .in("organization_id", orgIds);

  const provisionedOrgIds = new Set(
    (inviteOrgIds ?? []).map((r) => r.organization_id as string),
  );
  if (provisionedOrgIds.size === 0) return stages;

  const ids = [...provisionedOrgIds];
  const { data: orgs } = await admin
    .from("organizations")
    .select(
      "id, name, greeting, custom_prompt, assistant_display_name, phone_number, call_routing_mode, fallback_number, store_public_number, divert_carrier, business_hours, agent_services_departments, agent_faqs, agent_voice_id, agent_business_type, business_knowledge_summary, agent_services_not_offered, agent_extra_notes, prompt_compile_warnings, cara_online_since",
    )
    .in("id", ids);

  const { data: phones } = await admin
    .from("phone_numbers")
    .select("organization_id, e164, status")
    .in("organization_id", ids)
    .eq("status", "assigned");

  const { data: invites } = await admin
    .from("admin_invites")
    .select("organization_id, sent_at, accepted_at, email")
    .in("organization_id", ids);

  const phoneByOrg = new Map<string, TenantProvisioningPhoneRow>();
  for (const p of phones ?? []) {
    phoneByOrg.set(p.organization_id as string, {
      e164: String(p.e164),
      status: String(p.status),
    });
  }

  const inviteByOrg = new Map<string, TenantProvisioningInviteRow>();
  for (const inv of invites ?? []) {
    const orgId = inv.organization_id as string;
    if (!inviteByOrg.has(orgId)) {
      inviteByOrg.set(orgId, {
        sent_at: inv.sent_at ? String(inv.sent_at) : null,
        accepted_at: (inv.accepted_at as string | null) ?? null,
        email: String(inv.email),
      });
    }
  }

  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    const status = deriveTenantProvisioningStatus({
      org: org as TenantProvisioningOrgRow,
      poolPhone: phoneByOrg.get(orgId) ?? null,
      invite: inviteByOrg.get(orgId) ?? null,
      owner: null,
      hasInboundCallLog: false,
    });
    stages.set(orgId, status.stage);
  }

  return stages;
}

export async function loadOrganizationProvisioning(
  organizationId: string,
): Promise<TenantProvisioningStatus | null> {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, greeting, custom_prompt, assistant_display_name, phone_number, call_routing_mode, fallback_number, store_public_number, divert_carrier, business_hours, agent_services_departments, agent_faqs, agent_voice_id, agent_business_type, business_knowledge_summary, agent_services_not_offered, agent_extra_notes, prompt_compile_warnings, cara_online_since",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (!org?.id) return null;

  const [{ data: phone }, { data: invite }, { data: profile }, { count }] =
    await Promise.all([
      admin
        .from("phone_numbers")
        .select("e164, status")
        .eq("organization_id", organizationId)
        .eq("status", "assigned")
        .maybeSingle(),
      admin
        .from("admin_invites")
        .select("user_id, sent_at, accepted_at, email")
        .eq("organization_id", organizationId)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle(),
      admin
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
    ]);

  let owner: TenantProvisioningOwnerRow = null;
  const ownerUserId = invite?.user_id ?? profile?.id;
  if (ownerUserId) {
    const hasLegal = await userHasCurrentLegalAcceptances(
      ownerUserId as string,
      organizationId,
    );
    owner = {
      user_id: ownerUserId as string,
      hasLegalAcceptances: hasLegal,
    };
  }

  return deriveTenantProvisioningStatus({
    org: org as TenantProvisioningOrgRow,
    poolPhone: phone
      ? { e164: String(phone.e164), status: String(phone.status) }
      : null,
    invite: invite
      ? {
          sent_at: invite.sent_at ? String(invite.sent_at) : null,
          accepted_at: (invite.accepted_at as string | null) ?? null,
          email: String(invite.email),
        }
      : null,
    owner,
    hasInboundCallLog: (count ?? 0) > 0,
  });
}
