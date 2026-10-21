import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";

export async function resolveAccountIdFromBillingMetadata(input: {
  accountId?: string | null;
  organizationId?: string | null;
}): Promise<string | null> {
  const accountId = (input.accountId ?? "").trim();
  if (accountId) return accountId;

  const organizationId = (input.organizationId ?? "").trim();
  if (!organizationId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("account_id")
    .eq("id", organizationId)
    .maybeSingle();
  return (data?.account_id as string | null) ?? null;
}

export async function patchAccountAndLocations(
  accountId: string,
  patch: Record<string, unknown>,
  options?: { primaryOrganizationId?: string | null },
): Promise<void> {
  const admin = createAdminClient();
  const { error: accountError } = await admin.from("accounts").update(patch).eq("id", accountId);
  if (accountError) throw new Error(`Could not update account billing: ${accountError.message}`);
  const { error: locationsError } = await admin.from("organizations").update(patch).eq("account_id", accountId);
  if (locationsError) throw new Error(`Could not update location billing: ${locationsError.message}`);

  const primaryOrgId = (options?.primaryOrganizationId ?? "").trim();
  if (primaryOrgId) {
    const { error } = await admin.from("organizations").update(patch).eq("id", primaryOrgId);
    if (error) throw new Error(`Could not update primary location billing: ${error.message}`);
  }
}

export async function loadPlatformCustomerIdsForOrganizations(
  organizationIds: string[],
): Promise<Map<string, string | null>> {
  const admin = createAdminClient();
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, account_id")
    .in("id", organizationIds);

  const accountIds = [
    ...new Set((orgs ?? []).map((o) => o.account_id as string).filter(Boolean)),
  ];
  const { data: accounts } = await admin
    .from("accounts")
    .select("id, platform_customer_id")
    .in("id", accountIds.length > 0 ? accountIds : ["00000000-0000-0000-0000-000000000000"]);

  const accountCustomers = new Map<string, string | null>(
    (accounts ?? []).map((a) => [
      a.id as string,
      (a.platform_customer_id as string | null) ?? null,
    ]),
  );

  const result = new Map<string, string | null>();
  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    const accountId = org.account_id as string | null;
    result.set(orgId, accountId ? accountCustomers.get(accountId) ?? null : null);
  }
  return result;
}
