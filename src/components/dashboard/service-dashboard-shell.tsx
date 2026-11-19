"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpen, Building2, ChartNoAxesColumn, CircleHelp, House, LayoutGrid, Menu, Phone, Plus, Settings } from "lucide-react";
import type { DashboardSidebarNavItem } from "@/app/(dashboard)/dashboard/dashboard-sidebar";
import { isDashboardNavItemActive } from "@/lib/dashboard-nav-active";
import type { DashboardAccountSummary } from "@/lib/dashboard-account-summary";
import type { AccountLocationRow } from "@/lib/account-locations";
import { TopNavLocationSwitcher } from "./location-switcher";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DashboardSignOutButton } from "@/app/(dashboard)/dashboard/dashboard-sign-out-button";
import styles from "./service-dashboard.module.css";
import pageStyles from "./service-pages.module.css";
import { ServiceThemeContext } from "./service-theme-context";
import { CaraStatusCard } from "./cara-status-card";
import privacyStyles from "./service-privacy-dialog.module.css";
import statusStyles from "./status-nav-dialog.module.css";
import type { PhoneConnection } from "@/lib/phone-connection";

const icons = { "/dashboard": House, "/dashboard/calls": Phone, "/dashboard/services": LayoutGrid, "/dashboard/cara-knowledge": BookOpen, "/dashboard/business/profile": ChartNoAxesColumn, "/dashboard/settings": Settings, "/dashboard/support": CircleHelp };
const labels: Record<string,string> = { "/dashboard": "Overview", "/dashboard/cara-knowledge": "Knowledge", "/dashboard/business/profile": "Business", "/dashboard/settings": "Settings", "/dashboard/support": "Help" };

export function ServiceDashboardShell({ phoneConnection, children, coreNav, accountNav, account, locations, activeOrganizationId, viewAllLocations, locationLabel, accountName, dateLabel }: {
 phoneConnection?: PhoneConnection | null; children: ReactNode; coreNav: DashboardSidebarNavItem[]; accountNav: DashboardSidebarNavItem[];
 account: DashboardAccountSummary; locations: AccountLocationRow[]; activeOrganizationId: string;
 viewAllLocations: boolean; locationLabel: string; accountName: string; dateLabel: string;
}) {
 const pathname=usePathname();
 const pageKind = pathname.includes("cara-knowledge") || pathname.includes("cara-training") ? "knowledge" : pathname.includes("services") ? "services" : pathname.includes("support") ? "support" : pathname.includes("usage") || pathname.includes("billing") ? "billing" : pathname.includes("settings") || pathname.includes("team") || pathname.includes("legal") ? "settings" : "business";
 const themedPage = pathname !== "/dashboard" && !pathname.startsWith("/dashboard/calls") && !pathname.startsWith("/dashboard/call-history");
 const [menu,setMenu]=useState(false);
 const [profile,setProfile]=useState(false);
 const [statusOpen,setStatusOpen]=useState(false);
 const all=[...coreNav,...accountNav];
 const help=all.find(item=>item.href==="/dashboard/support");
 const navigation=all.filter(item=>item!==help);
 function links(){return <>{navigation.map(item=>{
  const Icon=icons[item.href as keyof typeof icons]??Building2;
  const active=isDashboardNavItemActive(pathname,item);
  return <Link key={item.href} href={item.href} onClick={()=>setMenu(false)} className={styles.navItem} aria-label={labels[item.href]??item.label} title={labels[item.href]??item.label} data-active={active} aria-current={active?"page":undefined}><Icon aria-hidden="true"/><span>{labels[item.href]??item.label}</span>{Boolean(item.badge)&&<b className={styles.navBadge}>{item.badge}</b>}</Link>;
 })}<button type="button" className={styles.navItem} aria-label="Status" title="Status" aria-haspopup="dialog" onClick={()=>{setMenu(false);setStatusOpen(true);}}><Activity aria-hidden="true"/><span>Status</span></button></>;}
 return <ServiceThemeContext.Provider value={themedPage}><div className={`${styles.workspace} cara-workspace`}>
  <div className={styles.mobileBrandBar}><Link href="/dashboard" aria-label="HelloCara overview"><Image src="/m8x4p2n7.png" alt="" width={32} height={32}/></Link><button type="button" onClick={()=>setMenu(true)} aria-label="Open navigation"><Menu aria-hidden="true"/></button></div>
  <aside className={styles.rail} aria-label="Workspace navigation">
   <Link href="/dashboard" className={styles.logo} aria-label="HelloCara overview"><Image src="/m8x4p2n7.png" alt="" width={48} height={48} priority/></Link>
   <nav>{links()}</nav>
   <div className={styles.railBottom}>{help&&<Link href={help.href} className={styles.navItem} aria-label="Help" title="Help"><CircleHelp aria-hidden="true"/><span>Help</span></Link>}<button type="button" className={styles.avatar} onClick={()=>setProfile(true)} aria-label="Your account">{account.initials}</button></div>
  </aside>
  <div className={styles.main}>
   <header className={styles.topbar}>
    <div className={styles.business}><button type="button" className={styles.mobileMenu} aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu/></button><TopNavLocationSwitcher locations={locations} activeOrganizationId={activeOrganizationId} viewAllLocations={viewAllLocations} locationLabel={locationLabel} accountName={accountName}/></div>
    <div className={styles.topActions}><time>{dateLabel}</time><Link className={styles.bell} href="/dashboard/calls?filter=follow_up" aria-label="View follow-ups"><Bell/></Link><Link href="/dashboard/cara-knowledge?teach=1" aria-label="Teach Cara" className={styles.teach}><Plus aria-hidden="true"/><span>Teach Cara</span></Link></div>
   </header>
   <main className={`${styles.content} ${themedPage ? pageStyles.page : ""}`} data-service-page={themedPage ? pageKind : undefined}>{children}</main>
  </div>
  <Dialog open={menu} onOpenChange={setMenu}><DialogContent className={styles.menuDialog}><DialogTitle>Welcome to {accountName}</DialogTitle><DialogDescription>Choose a section of your workspace.</DialogDescription><nav className={styles.mobileLinks}>{links()}{help&&<Link href={help.href} onClick={()=>setMenu(false)}>Help &amp; support</Link>}<button onClick={()=>{setMenu(false);setProfile(true);}}>Your account</button></nav></DialogContent></Dialog>
  <Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogContent overlayClassName={privacyStyles.backdrop} className={`${privacyStyles.popup} ${statusStyles.popup}`}><DialogTitle>System status</DialogTitle><DialogDescription>Check your phone connection and Cara’s services.</DialogDescription><CaraStatusCard compact connected={Boolean(phoneConnection?.verified_at)} phoneConnection={phoneConnection}/></DialogContent></Dialog>
  <Dialog open={profile} onOpenChange={setProfile}><DialogContent overlayClassName={privacyStyles.backdrop} className={privacyStyles.popup}><DialogTitle>Your account</DialogTitle><DialogDescription>{account.subtitle}</DialogDescription><Link href="/dashboard/settings" onClick={()=>setProfile(false)} className={styles.wideButton}>Account settings</Link><DashboardSignOutButton/></DialogContent></Dialog>
 </div></ServiceThemeContext.Provider>;
}
