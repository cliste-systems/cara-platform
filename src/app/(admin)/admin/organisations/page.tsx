import Link from "next/link";
import { setupOptionLabel } from "@/lib/setup-option-label";
import { Building2, ArrowUpRight } from "lucide-react";
import { AdminPageShell, AdminErrorCard } from "@/components/admin/admin-page-shell";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { AdminDirectoryTable } from "@/components/admin/admin-directory-table";
import { adminTableHeadClass, adminTableThClass, adminTableTdClass, adminTableRowClass } from "@/components/admin/admin-table";
import { requireAdminPermission, requireAdminStaffContext } from "@/lib/admin-session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { createAdminClient } from "@/utils/supabase/admin";
import { OrganisationDialog } from "./organisation-dialog";
export const dynamic = "force-dynamic";
export default async function OrganisationsPage() {
  await requireAdminPermission("customers");
  const staff = await requireAdminStaffContext();
  const billing = hasAdminPermission(staff, "billing");
  const { data, error } = await createAdminClient().from("accounts").select("id, name, status, billing_method, billing_email, billing_address, billing_contact_name, billing_vat_number, launch_tier, organizations(id, name)").order("name");
  return <AdminPageShell icon={Building2} title="Organisations" description="Companies, their businesses and shared billing details." actions={billing ? <OrganisationDialog /> : null}>
    {error ? <AdminErrorCard message="Organisations could not be loaded. Refresh to try again." /> : <AdminListCard countLabel={`${data?.length ?? 0} organisations`}>
      <AdminDirectoryTable columns={5} label="organisations" header={<thead className={adminTableHeadClass}><tr>{["Organisation", "Businesses", "Status", "Billing", "Manage"].map(label => <th key={label} className={adminTableThClass}>{label}</th>)}</tr></thead>} rows={(data ?? []).map(account => ({ id: account.id, search: [account.name, account.status, billing ? account.billing_email : "", billing ? account.billing_contact_name : "", billing ? setupOptionLabel(account.launch_tier) : "", ...account.organizations.map(b => b.name)].join(" "), content: <tr key={account.id} id={account.id} className={adminTableRowClass}>
        <td className={adminTableTdClass}><p className="font-medium text-[#11181d]">{account.name}</p>{billing && <p className="mt-1 text-xs text-[#697078]">{account.billing_contact_name || ""}</p>}</td>
        <td className={adminTableTdClass}><details><summary className="cursor-pointer text-sm text-[#353d42]">{account.organizations.length} {account.organizations.length === 1 ? "business" : "businesses"}</summary><div className="mt-2 space-y-2">{account.organizations.map(business => <Link key={business.id} href={`/admin/customers/${business.id}`} className="flex items-center gap-2 text-xs hover:underline">{business.name}<ArrowUpRight className="size-3" aria-hidden /></Link>)}</div></details></td>
        <td className={`${adminTableTdClass} capitalize`}>{account.status}</td>
        <td className={adminTableTdClass}>{billing ? <><p className="text-xs">{account.billing_method === "manual_invoice" ? "Invoice" : account.billing_method || "Not recorded"}</p><p className="mt-1 text-xs text-[#697078]">{account.billing_email || "No billing email"}</p><p className="mt-1 text-xs text-[#697078]">{setupOptionLabel(account.launch_tier)}</p></> : <span className="text-xs text-[#697078]">Restricted</span>}</td>
        <td className={adminTableTdClass}>{billing ? <OrganisationDialog organisation={account} /> : "—"}</td>
      </tr> }))} />
    </AdminListCard>}
  </AdminPageShell>;
}
