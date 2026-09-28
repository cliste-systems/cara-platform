import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { AdminBadge, adminTableMutedClass } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { adminTextLinkClass } from "@/components/admin/admin-interactive";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSegmentedTabs } from "@/components/admin/admin-segmented-tabs";
import { AdminSetupStatusBadge } from "@/components/admin/admin-setup-status-badge";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableTdDateClass,
  adminTableThActionsClass,
  adminTableThClass,
  adminTableThDateClass,
} from "@/components/admin/admin-table";
import { PRODUCT_NAME } from "@/lib/company-details";
import { loadAdminClients } from "@/lib/load-admin-clients";
import { cn } from "@/lib/utils";
import { isAdminClientLive } from "@/lib/admin-client-setup-status";
import {
  clientProvisionSourceLabel,
  parseClientProvisionFilter,
} from "@/lib/client-provision-source";
import {
  adminCustomerPath,
  adminCustomersPath,
} from "@/lib/admin-route-paths";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";

import { NewClientDialog } from "../new-client-dialog";
import { TenantProvisioningStageChip } from "../tenant-provisioning-chip";
import { TenantRowActions } from "../tenant-row-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Customers`,
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayCustomerName(name: string): string {
  return name.replace(/^\[smoke test\]\s*/i, "");
}

function formatStatusLabel(
  orgStatus: string | null,
  accountStatus: string,
  onboardingStep: number | null,
): string {
  const base = (orgStatus ?? accountStatus).replace(/_/g, " ");
  if (onboardingStep != null && onboardingStep > 0) {
    return `${base} · step ${onboardingStep}`;
  }
  return base;
}

const FILTER_TABS = [
  { value: "all", label: "All", href: adminCustomersPath() },
  { value: "managed", label: "Managed", href: adminCustomersPath("managed") },
  {
    value: "self_serve",
    label: "Self-serve",
    href: adminCustomersPath("self_serve"),
  },
] as const;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const filter = parseClientProvisionFilter(typeParam);

  let rows: Awaited<ReturnType<typeof loadAdminClients>> = [];
  let loadError: string | null = null;

  try {
    rows = await loadAdminClients(filter);
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load customers.";
  }

  const countLabel = `${rows.length} customer${rows.length === 1 ? "" : "s"}${
    filter !== "all" ? ` · ${clientProvisionSourceLabel(filter)}` : ""
  }`;

  return (
    <AdminPageShell
      icon={Users}
      title="Customers"
      description="Set up retail stores, connect their organisations, and manage client access."
    >
      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : (
        <AdminListCard
          countLabel={countLabel}
          toolbar={
            <>
              <AdminSegmentedTabs
                tabs={[...FILTER_TABS]}
                activeValue={filter}
                ariaLabel="Customer type"
              />
              <NewClientDialog />
            </>
          }
        >
          <table className={adminTableClass}>
            <thead className={adminTableHeadClass}>
              <tr>
                <th className={adminTableThClass}>Customer</th>
                <th className={adminTableThClass}>Type</th>
                <th className={adminTableThClass}>Niche</th>
                <th className={adminTableThClass}>Status</th>
                <th className={adminTableThClass}>Owner</th>
                <th className={adminTableThDateClass}>Created</th>
                <th className={adminTableThActionsClass}>Actions</th>
              </tr>
            </thead>
            <tbody className={adminTableBodyClass}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={adminTableEmptyClass}>
                    No customers yet. Use <strong>New client</strong> to
                    provision the first managed account.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.orgId} className={adminTableRowClass}>
                    <td className={adminTableTdClass}>
                      <Link
                        href={adminCustomerPath(row.orgId)}
                        className={cn(adminTextLinkClass, "text-gray-900")}
                      >
                        {displayCustomerName(row.name)}
                      </Link>
                      {row.accountName ? <span className="mt-1 block text-xs text-gray-500">{row.accountName}</span> : null}
                      {row.slug ? (
                        <span className="mt-0.5 block font-mono text-xs text-gray-400">
                          {row.slug}
                        </span>
                      ) : null}
                    </td>
                    <td className={adminTableTdClass}>
                      <AdminBadge variant="plain">
                        {clientProvisionSourceLabel(row.provisionSource)}
                      </AdminBadge>
                    </td>
                    <td className={adminTableTdClass}>
                      <span className={adminTableMutedClass}>
                        {
                          ORGANIZATION_NICHE_ADMIN_LABELS[
                            parseOrganizationNiche(row.niche)
                          ]
                        }
                      </span>
                    </td>
                    <td className={adminTableTdClass}>
                      {row.provisionSource === "managed" &&
                      row.provisioningStage ? (
                        <TenantProvisioningStageChip
                          stage={row.provisioningStage}
                        />
                      ) : (
                        <AdminSetupStatusBadge
                          isLive={isAdminClientLive(row)}
                          className="capitalize"
                        >
                          {formatStatusLabel(
                            row.orgStatus,
                            row.accountStatus,
                            row.onboardingStep,
                          )}
                        </AdminSetupStatusBadge>
                      )}
                    </td>
                    <td className={adminTableTdClass}>
                      <span className={adminTableMutedClass}>
                        {row.ownerEmail ?? "—"}
                      </span>
                    </td>
                    <td className={adminTableTdDateClass}>
                      {formatDateShort(row.createdAt)}
                    </td>
                    <td className={`text-right ${adminTableTdClass}`}>
                      <TenantRowActions
                        organizationId={row.orgId}
                        organizationName={row.name}
                        customerHref={adminCustomerPath(row.orgId)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminListCard>
      )}
    </AdminPageShell>
  );
}
