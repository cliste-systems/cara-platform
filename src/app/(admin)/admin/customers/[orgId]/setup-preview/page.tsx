import {notFound,redirect} from "next/navigation";
import {requireAdminPermission,requireAdminStaffContext} from "@/lib/admin-session";
import {createAdminClient} from "@/utils/supabase/admin";
import {loadFirstCallSetup} from "@/lib/load-first-call-setup";
import {FirstCallWelcome} from "@/components/dashboard/first-call-welcome";
import Link from "next/link";
import {OpenDashboardButton} from "../../../organizations/[id]/open-dashboard-button";
export const dynamic="force-dynamic";
export default async function CustomerSetupPreview({params,searchParams}:{params:Promise<{orgId:string}>;searchParams:Promise<{screen?:string}>}){
 await requireAdminPermission("customers");
 const staff=await requireAdminStaffContext();
 const {orgId}=await params;const admin=createAdminClient();
 const {data:org}=await admin.from("organizations").select("id,account_id,name").eq("id",orgId).maybeSingle();if(!org)notFound();
 const screen=(await searchParams).screen;
 if(screen==="plan")redirect(`/preview/signup/${orgId}/plan`);
 const {data:membership}=await admin.from("account_memberships").select("user_id").eq("account_id",org.account_id).eq("role","admin").limit(1).maybeSingle();
 if(!membership)return <p className="p-6 text-sm">This business has no account owner yet. <Link href={`/admin/customers/${orgId}`} className="underline">Return to customer</Link></p>;
 const {data:{user}}=await admin.auth.admin.getUserById(membership.user_id);if(!user)notFound();
 const state=await loadFirstCallSetup({supabase:admin,user,accountId:org.account_id,organizationId:orgId,profile:{name:null,role:"admin",avatarUrl:null}},true);
 return <div className="p-6"><Link href={`/admin/customers/${orgId}`} className="mb-5 inline-block text-sm underline underline-offset-4">← Return to {org.name}</Link><FirstCallWelcome state={state} initialOpen readOnly dashboardAction={staff.role==="owner"?<OpenDashboardButton organizationId={orgId} appearance="setup"/>:<Link href={`/admin/customers/${orgId}`} className="inline-flex min-h-11 items-center rounded-full bg-[#11181d] px-6 text-sm font-medium text-white">Return to customer</Link>} billingSetupComplete={screen==="confirmation"} previewScreen={screen==="confirmation"?"welcome":screen==="forwarding"?"forwarding":undefined}/></div>;
}
