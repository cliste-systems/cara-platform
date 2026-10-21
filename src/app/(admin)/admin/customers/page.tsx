import { OrganisationDialog } from "../organisations/organisation-dialog";
import { hasAdminPermission } from "@/lib/admin-permissions";
import Link from "next/link";
import { Users } from "lucide-react";
import { AdminDirectoryTable } from "@/components/admin/admin-directory-table";
import { AdminPageShell, AdminErrorCard } from "@/components/admin/admin-page-shell";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { AdminSegmentedTabs } from "@/components/admin/admin-segmented-tabs";
import { AdminBadge } from "@/components/admin/admin-badge";
import { adminTableHeadClass, adminTableThClass, adminTableTdClass, adminTableRowClass } from "@/components/admin/admin-table";
import { requireAdminPermission, requireAdminStaffContext } from "@/lib/admin-session";
import { loadAdminClients } from "@/lib/load-admin-clients";
import { customerActionTab, customerNextAction, customerPlanLabel, isTestCustomer } from "@/lib/admin-customer-state";
import { setupOptionLabel } from "@/lib/setup-option-label";
import { clientProvisionSourceLabel, parseClientProvisionFilter } from "@/lib/client-provision-source";
import { adminCustomerPath, adminCustomersPath } from "@/lib/admin-route-paths";
import { NewClientDialog } from "../new-client-dialog";
import { TenantRowActions } from "../tenant-row-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Customers — HelloCara Admin" };
const tabs = [{value:"all",label:"All",href:adminCustomersPath()},{value:"managed",label:"Managed",href:adminCustomersPath("managed")},{value:"self_serve",label:"Self-service",href:adminCustomersPath("self_serve")}];
export default async function AdminCustomersPage({searchParams}:{searchParams:Promise<{type?:string}>}) {
 await requireAdminPermission("customers");
 const staff=await requireAdminStaffContext();
 const filter=parseClientProvisionFilter((await searchParams).type);
 let rows:Awaited<ReturnType<typeof loadAdminClients>>=[];let error:string|null=null;
 try {rows=await loadAdminClients(filter);} catch {error="Customers could not be loaded. Refresh to try again.";}
 return <AdminPageShell icon={Users} title="Customers" description="Business access, billing and readiness to go live." actions={<>{hasAdminPermission(staff, "billing") ? <OrganisationDialog /> : null}<NewClientDialog /></>}>
 {error ? <AdminErrorCard message={error}/> : <AdminListCard fillRemaining={false} countLabel="Customer directory" toolbar={<AdminSegmentedTabs tabs={tabs} activeValue={filter} ariaLabel="Customer type"/>}>
 <AdminDirectoryTable columns={6} label="customers" header={<thead className={adminTableHeadClass}><tr>{["Business / contact","Plan / setup","Cara","Next action","Account",""].map(label=><th key={label} className={adminTableThClass}>{label}</th>)}</tr></thead>} rows={rows.map(row=>{
 const name=row.name.replace(/^\[smoke test\]\s*/i,"");const href=adminCustomerPath(row.orgId);const next=customerNextAction(row);const actionHref=`${href}?tab=${customerActionTab(next)}`;
 const identity=<><Link href={href} className="font-semibold text-slate-900 hover:underline">{name}</Link><p className="mt-1 break-words text-xs text-slate-500">{row.ownerEmail || "Contact not recorded"}</p>{row.accountName && row.accountName!==row.name && <p className="mt-1 text-xs text-slate-500">{row.accountName.replace(/^\[smoke test\]\s*/i,"")}</p>}<p className="mt-1 text-xs text-slate-400">{clientProvisionSourceLabel(row.provisionSource)}{isTestCustomer(row) ? " · Test record" : ""}</p></>;
 const service=<span className={row.isActive ? "text-emerald-700" : "text-slate-500"}>{row.isActive ? "On" : "Off"}</span>;
 const plan=<><span>{customerPlanLabel(row.planTier)}</span><p className="mt-1 text-xs text-slate-500">{setupOptionLabel(row.setupOption)}</p></>;
 return {id:row.orgId,test:isTestCustomer(row),search:[row.name,row.accountName,row.ownerEmail,row.niche,row.accountStatus,customerPlanLabel(row.planTier),next].join(" "),mobileContent:<><div className="flex justify-between gap-3"><div className="min-w-0">{identity}</div><AdminBadge variant="plain">Cara {service}</AdminBadge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div>{plan}</div><p className="capitalize text-slate-500">{row.accountStatus.replaceAll("_"," ")}</p></div><Link href={actionHref} className="mt-4 inline-flex text-sm font-medium underline underline-offset-4">{next} →</Link></>,content:<tr className={adminTableRowClass} key={row.orgId}><td className={`${adminTableTdClass} min-w-[210px] max-w-[300px]`}>{identity}</td><td className={adminTableTdClass}>{plan}</td><td className={adminTableTdClass}>{service}</td><td className={adminTableTdClass}><Link href={actionHref} className="text-sm font-medium hover:underline">{next} →</Link></td><td className={`${adminTableTdClass} text-xs capitalize text-slate-500`}>{row.accountStatus.replaceAll("_"," ")}</td><td className={adminTableTdClass}><TenantRowActions allowOwnerActions={staff.role==="owner"} organizationId={row.orgId} organizationName={row.name} customerHref={href}/></td></tr>};
 })}/></AdminListCard>}
 </AdminPageShell>;
}
