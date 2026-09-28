import "server-only";

import {
  type ClientProvisionFilter,
  type ClientProvisionSource,
  isClientProvisionSource,
} from "@/lib/client-provision-source";
import { loadProvisioningStagesByOrgId } from "@/lib/load-provisioning-pipeline";
import type { TenantProvisioningStage } from "@/lib/tenant-provisioning-status";
import { createAdminClient } from "@/utils/supabase/admin";

export type AdminClientRow = {
  orgId: string;
  accountId: string | null;
  accountName: string | null;
  name: string;
  slug: string;
  niche: string | null;
  createdAt: string;
  provisionSource: ClientProvisionSource;
  accountStatus: string;
  onboardingStep: number | null;
  orgStatus: string | null;
  planTier: string | null;
  platformSubscriptionId: string | null;
  ownerEmail: string | null;
  provisioningStage: TenantProvisioningStage | null;
  phoneNumber: string | null;
};

type AccountJoin = {
  name: string | null;
  provision_source?: string | null;
  status: string | null;
  plan_tier: string | null;
  platform_subscription_id: string | null;
  signup_ip?: string | null;
};

type OrgRow = {
  id: string;
  account_id: string | null;
  name: string;
  slug: string;
  niche: string | null;
  created_at: string;
  status: string | null;
  onboarding_step: number | null;
  phone_number: string | null;
  is_primary_location: boolean | null;
  accounts: AccountJoin | AccountJoin[] | null;
};

function resolveAccountJoin(
  accounts: OrgRow["accounts"],
): AccountJoin | null {
  if (!accounts) return null;
  return Array.isArray(accounts) ? (accounts[0] ?? null) : accounts;
}

function inferProvisionSource(
  account: AccountJoin | null,
  hasInvite: boolean,
): ClientProvisionSource {
  const explicit = account?.provision_source;
  if (explicit && isClientProvisionSource(explicit)) return explicit;
  if (hasInvite) return "managed";
  if (account?.signup_ip) return "self_serve";
  return "managed";
}

const ACCOUNT_SELECT_WITH_SOURCE =
  "name, provision_source, status, plan_tier, platform_subscription_id, signup_ip";
const ACCOUNT_SELECT_LEGACY =
  "name, status, plan_tier, platform_subscription_id, signup_ip";

async function loadClientOrganizations(admin: ReturnType<typeof createAdminClient>) {
  const withSource = await admin
    .from("organizations")
    .select(
      `id, account_id, name, slug, niche, created_at, status, onboarding_step, phone_number, is_primary_location,
       accounts ( ${ACCOUNT_SELECT_WITH_SOURCE} )`,
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (!withSource.error) {
    return (withSource.data ?? []) as OrgRow[];
  }

  if (
    !withSource.error.message.includes("provision_source") &&
    !withSource.error.message.includes("schema cache")
  ) {
    throw new Error(withSource.error.message);
  }

  const legacy = await admin
    .from("organizations")
    .select(
      `id, account_id, name, slug, niche, created_at, status, onboarding_step, phone_number, is_primary_location,
       accounts ( ${ACCOUNT_SELECT_LEGACY} )`,
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (legacy.error) throw new Error(legacy.error.message);
  return (legacy.data ?? []) as OrgRow[];
}

async function loadOrganizationWithAccount(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
) {
  const withSource = await admin
    .from("organizations")
    .select(
      `id, account_id, name, slug, niche, created_at, status, onboarding_step, phone_number, is_primary_location, store_code, is_active,
       accounts ( ${ACCOUNT_SELECT_WITH_SOURCE}, billing_interval )`,
    )
    .eq("id", orgId)
    .maybeSingle();

  if (!withSource.error && withSource.data) {
    return withSource.data as OrgRow & {
      store_code: string | null;
      is_active: boolean | null;
    };
  }

  if (
    withSource.error &&
    !withSource.error.message.includes("provision_source") &&
    !withSource.error.message.includes("schema cache")
  ) {
    throw new Error(withSource.error.message);
  }

  const legacy = await admin
    .from("organizations")
    .select(
      `id, account_id, name, slug, niche, created_at, status, onboarding_step, phone_number, is_primary_location, store_code, is_active,
       accounts ( ${ACCOUNT_SELECT_LEGACY}, billing_interval )`,
    )
    .eq("id", orgId)
    .maybeSingle();

  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data as (OrgRow & {
    store_code: string | null;
    is_active: boolean | null;
  }) | null;
}

export async function loadAdminClients(
  filter: ClientProvisionFilter = "all",
): Promise<AdminClientRow[]> {
  const admin = createAdminClient();
  const orgs = await loadClientOrganizations(admin);
  const orgIds = orgs.map((o) => o.id);

  const [{ data: invites }, stageByOrg] = await Promise.all([
    admin
      .from("admin_invites")
      .select("organization_id, email")
      .in(
        "organization_id",
        orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"],
      ),
    loadProvisioningStagesByOrgId(orgIds),
  ]);

  const inviteEmailByOrg = new Map<string, string>();
  const inviteOrgIds = new Set<string>();
  for (const inv of invites ?? []) {
    const orgId = inv.organization_id as string;
    inviteOrgIds.add(orgId);
    if (!inviteEmailByOrg.has(orgId)) {
      inviteEmailByOrg.set(orgId, String(inv.email));
    }
  }

  const rows: AdminClientRow[] = orgs.map((org) => {
    const account = resolveAccountJoin(org.accounts);
    const hasInvite = inviteOrgIds.has(org.id);
    const provisionSource = inferProvisionSource(account, hasInvite);

    return {
      orgId: org.id,
      accountId: org.account_id,
      accountName: account?.name ?? null,
      name: org.name,
      slug: org.slug,
      niche: org.niche,
      createdAt: org.created_at,
      provisionSource,
      accountStatus: account?.status ?? "active",
      onboardingStep: org.onboarding_step,
      orgStatus: org.status,
      planTier: account?.plan_tier ?? null,
      platformSubscriptionId: account?.platform_subscription_id ?? null,
      ownerEmail: inviteEmailByOrg.get(org.id) ?? null,
      provisioningStage: stageByOrg.get(org.id) ?? null,
      phoneNumber: org.phone_number,
    };
  });

  if (filter === "all") return rows;
  return rows.filter((r) => r.provisionSource === filter);
}

export type AdminClientDetail = AdminClientRow & {
  storeCode: string | null;
  isActive: boolean;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
};

export async function loadAdminClientDetail(
  orgId: string,
): Promise<AdminClientDetail | null> {
  const admin = createAdminClient();
  const orgRow = await loadOrganizationWithAccount(admin, orgId);
  if (!orgRow) return null;

  const account = resolveAccountJoin(orgRow.accounts);

  const [{ data: invite }, stageByOrg] = await Promise.all([
    admin
      .from("admin_invites")
      .select("email, sent_at, accepted_at")
      .eq("organization_id", orgId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadProvisioningStagesByOrgId([orgId]),
  ]);

  const provisionSource = inferProvisionSource(account, Boolean(invite));

  return {
    orgId: orgRow.id,
    accountId: orgRow.account_id,
    accountName: account?.name ?? null,
    name: orgRow.name,
    slug: orgRow.slug,
    niche: orgRow.niche,
    createdAt: orgRow.created_at,
    provisionSource,
    accountStatus: account?.status ?? "active",
    onboardingStep: orgRow.onboarding_step,
    orgStatus: orgRow.status,
    planTier: account?.plan_tier ?? null,
    platformSubscriptionId: account?.platform_subscription_id ?? null,
    ownerEmail: invite?.email ? String(invite.email) : null,
    provisioningStage: stageByOrg.get(orgId) ?? null,
    phoneNumber: orgRow.phone_number,
    storeCode: orgRow.store_code,
    isActive: orgRow.is_active === true,
    inviteSentAt: invite?.sent_at ? String(invite.sent_at) : null,
    inviteAcceptedAt: invite?.accepted_at ? String(invite.accepted_at) : null,
  };
}
