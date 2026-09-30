import Link from "next/link";
import { Building2, ArrowUpRight } from "lucide-react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminPermission, requireAdminStaffContext } from "@/lib/admin-session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { createAdminClient } from "@/utils/supabase/admin";
import { OrganisationDialog } from "./organisation-dialog";
export const dynamic = "force-dynamic";
export default async function OrganisationsPage() {
  await requireAdminPermission("customers");
  const staff = await requireAdminStaffContext();
  const billing = hasAdminPermission(staff, "billing");
  const { data, error } = await createAdminClient().from("accounts").select("id, name, status, billing_method, billing_email, billing_address, billing_contact_name, billing_vat_number, organizations(id, name)").order("name");
  return <AdminPageShell icon={Building2} title="Organisations" description="The companies behind your clients. Shared billing, separate businesses." actions={billing ? <OrganisationDialog /> : null}>
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Organisations could not be loaded. Refresh to try again.</p> : !data?.length ? <div className="rounded-xl border bg-white p-10 text-center"><h2 className="font-semibold">Start with an organisation</h2><p className="mt-2 text-sm text-slate-500">Create the legal company, then add its businesses through New client.</p></div> : <div className="grid gap-5 lg:grid-cols-2">{data.map((account) => <section key={account.id} id={account.id} className="overflow-hidden rounded-xl border border-[#d9e2dd] bg-white"><header className="flex items-start justify-between gap-3 border-b border-[#e7ece9] p-5"><div><h2 className="font-semibold text-[#11181d]">{account.name}</h2><p className="mt-1 text-xs capitalize text-slate-500">{account.status} · {account.organizations.length} {account.organizations.length === 1 ? "business" : "businesses"}</p></div>{billing && <OrganisationDialog organisation={account} />}</header>{billing && <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Invoice contact</dt><dd className="mt-1 break-all">{account.billing_email || "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">Billing method</dt><dd className="mt-1">{account.billing_method === "manual_invoice" ? "Invoice" : account.billing_method || "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">Billing address</dt><dd className="mt-1 whitespace-pre-line">{account.billing_address || "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">VAT number</dt><dd className="mt-1">{account.billing_vat_number || "Not recorded"}</dd></div></dl>}<div className="border-t border-[#e7ece9]">{account.organizations.length ? account.organizations.map((business) => <Link key={business.id} href={`/admin/customers/${business.id}`} className="flex items-center justify-between gap-3 border-b border-[#e7ece9] px-5 py-3 text-sm last:border-0 hover:bg-[#f4f6f5]">{business.name}<ArrowUpRight className="size-4 shrink-0 text-slate-400" /></Link>) : <p className="px-5 py-4 text-sm text-slate-500">No businesses added yet.</p>}</div></section>)}</div>}
  </AdminPageShell>;
}
