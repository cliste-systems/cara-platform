import Link from "next/link";
import { Settings, ArrowUpRight } from "lucide-react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminStaffContext } from "@/lib/admin-session";
import { hasAdminPermission } from "@/lib/admin-permissions";
export const dynamic = "force-dynamic";
export default async function AdminSettingsPage() {
 const staff = await requireAdminStaffContext();
 const tools = [
  {title:"Organisations",description:"Companies, their businesses and shared billing details.",href:"/admin/organisations",permission:"customers"},
  {title:"Account security",description:"MFA, sign-in activity and your sessions.",href:"/admin/security",permission:null},
  {title:"Team",description:"Staff access and workspace permissions.",href:"/admin/team",permission:"team"},
  {title:"Phone numbers",description:"Available numbers, assignments and cooldowns.",href:"/admin/phone-pool",permission:"customers"},
  {title:"Demo calls",description:"Make test calls and inspect Cara’s behaviour.",href:"/admin/demo-calls",permission:"calls"},
  {title:"Text rehearsal",description:"Test conversations without making a phone call.",href:"/admin/demo-calls/text-rehearsal",permission:"calls"},
 ] as const;
 return <AdminPageShell icon={Settings} title="Settings & tools" description="Workspace administration and engineering tools."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tools.filter(tool=>tool.permission===null || hasAdminPermission(staff,tool.permission)).map(tool=><Link key={tool.href} href={tool.href} className="group rounded-lg border border-slate-200 p-5 transition-colors hover:bg-slate-50"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{tool.title}</h2><ArrowUpRight size={16} aria-hidden /></div><p className="mt-2 text-sm leading-6 text-slate-500">{tool.description}</p></Link>)}</div></AdminPageShell>;
}
