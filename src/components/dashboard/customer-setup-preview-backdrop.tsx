"use client";
import {createPortal} from "react-dom";
import {useSyncExternalStore} from "react";
import Image from "next/image";
import {Activity,BookOpen,Building2,Gauge,LayoutDashboard,LifeBuoy,Phone,Settings,Share2,Shield,Users} from "lucide-react";
import {DASHBOARD_HOME_CARD,DASHBOARD_SHELL_BG,DASHBOARD_TITLE_CLASS} from "./dashboard-surface";
import {dashboardSidebarRowClassName} from "./dashboard-sidebar-nav-shared";

const subscribe=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;

/** Inert customer context for the protected admin UI preview; no customer navigation or invented activity. */
export function CustomerSetupPreviewBackdrop({businessName,setupComplete=false}:{businessName:string;setupComplete?:boolean}){
 const mounted=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
 const workspace=[["Overview",LayoutDashboard],["Activity",Activity],["Calls",Phone],["Cara’s Knowledge",BookOpen],["Call flow",Share2]] as const;
 const account=[["Usage",Gauge],["Support",LifeBuoy],["Legal",Shield],["Locations",Building2],["Team",Users],["Profile",Building2],["Settings",Settings]] as const;
 if(!mounted)return null;
 return createPortal(<div inert aria-hidden="true" className={`pointer-events-none fixed inset-0 z-40 flex overflow-hidden text-[#11181d] ${DASHBOARD_SHELL_BG}`}>
  <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-200/80 bg-[#fafbfc] p-5 lg:flex">
   <div className="mb-9 flex items-center gap-3"><Image src="/m8x4p2n7.png" alt="" width={38} height={38}/><div><p className="text-[15px] font-semibold tracking-[0.12em]">HELLO</p><p className="text-[10px] tracking-[0.14em] text-[#64748b]">CARA</p></div></div>
   <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
   <div className="space-y-1">{workspace.map(([label,Icon],index)=><div key={label} className={dashboardSidebarRowClassName(index===0)}><Icon size={16}/><span>{label}</span></div>)}</div>
   <p className="mb-3 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Account</p>
   <div className="space-y-1">{account.map(([label,Icon])=><div key={label} className={dashboardSidebarRowClassName(false)}><Icon size={16}/><span>{label}</span></div>)}</div>
   <p className="mt-auto truncate border-t border-[#d9e2dd] px-3 pt-4 text-xs text-[#5b6b65]">{businessName}</p>
  </aside>
  <div className="min-w-0 flex-1"><header className="flex h-12 items-center gap-3 border-b border-[#d9e2dd] px-8 text-[13px]"><span className="text-[#6b7c75]">Workspace</span><span className="text-[#b9c8c1]">/</span><span>Overview</span></header>
   <div className="mx-auto max-w-[1500px] space-y-5 p-8"><section className={DASHBOARD_HOME_CARD}><p className="mb-2 text-xs text-[#6b7c75]">{businessName}</p><h1 className={DASHBOARD_TITLE_CLASS}>Welcome to your workspace</h1><p className="mt-2 text-sm text-[#5b6b65]">{setupComplete?"Manage calls and keep Cara up to date.":"Get Cara ready for your first call."}</p></section><div className="grid gap-4 md:grid-cols-3">{["Recent activity","Calls","Cara’s Knowledge"].map(title=><section key={title} className={`${DASHBOARD_HOME_CARD} min-h-60`}><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-10 text-sm text-[#6b7c75]">{setupComplete?"No activity yet.":"Complete setup to get started."}</p></section>)}</div></div>
  </div>
 </div>,document.body);
}
