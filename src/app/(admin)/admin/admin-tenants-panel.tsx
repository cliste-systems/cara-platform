import Link from "next/link";

import { adminCustomerPath, adminCustomersPath } from "@/lib/admin-route-paths";
import {
  adminNavLinkBaseClass,
  adminTextLinkClass,
} from "@/components/admin/admin-interactive";

import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import type { TenantProvisioningStage } from "@/lib/tenant-provisioning-status";

import { TenantProvisioningStageChip } from "./tenant-provisioning-chip";
import { TenantRowActions } from "./tenant-row-actions";

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

type AdminTenantsPanelProps = {
  organizations: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    niche: string | null;
    created_at: string;
    provisioningStage?: TenantProvisioningStage | null;
  }[];
};

export function AdminTenantsPanel({ organizations }: AdminTenantsPanelProps) {
  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]"
      aria-labelledby="tenants-heading"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#e3e9e5] px-5 py-4">
        <h2 id="tenants-heading" className="text-sm font-semibold tracking-tight text-[#11181d]">
          Customers
        </h2>
        <span className="text-xs text-slate-500">{organizations.length}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {organizations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <p className="text-sm font-medium text-[#4d5f58]">No customers yet</p>
            <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-slate-500">
              Browse{" "}
              <Link href={adminCustomersPath()} className={adminTextLinkClass}>
                Customers
              </Link>{" "}
              to provision and manage accounts.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#e9efeb]">
            {organizations.map((org) => (
              <li
                key={org.id}
                className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
              >
                <Link
                  href={adminCustomerPath(org.id)}
                  className={`${adminNavLinkBaseClass} min-w-0 flex-1 rounded-md`}
                >
                  <p className="truncate text-[13px] font-medium text-[#11181d] hover:underline">
                    {org.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {
                      ORGANIZATION_NICHE_ADMIN_LABELS[
                        parseOrganizationNiche(org.niche)
                      ]
                    }
                    {" · "}
                    {formatDateShort(org.created_at)}
                  </p>
                  {org.provisioningStage ? (
                    <div className="mt-1">
                      <TenantProvisioningStageChip stage={org.provisioningStage} />
                    </div>
                  ) : null}
                </Link>
                <TenantRowActions
                  organizationId={org.id}
                  organizationName={org.name}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
