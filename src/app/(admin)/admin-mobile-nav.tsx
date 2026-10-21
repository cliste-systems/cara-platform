"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { AdminNav } from "./admin-nav";
import type { AdminStaffAccess } from "@/lib/admin-permissions";
type NavProps = { loggedInAs:string;displayName?:string;access:AdminStaffAccess };
export function AdminMobileNav(props:NavProps) {
 const pathname=usePathname();
 return <AdminMobileNavContent key={pathname} {...props}/>;
}
function AdminMobileNavContent(props:NavProps) {
 const [open,setOpen]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;if(!element)return;if(open && !element.open)element.showModal();else if(!open && element.open)element.close();},[open]);
 return <>
  <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden"><Link href="/admin" className="flex items-center gap-2.5 text-sm font-semibold"><ClisteLogoMark size={30}/>HelloCara Admin</Link><button type="button" aria-label="Open admin navigation" aria-controls="admin-mobile-navigation" aria-expanded={open} onClick={()=>setOpen(true)} className="flex size-10 items-center justify-center rounded-lg border border-slate-200"><Menu size={20} aria-hidden/></button></div>
  <dialog ref={dialog} id="admin-mobile-navigation" aria-label="Admin navigation" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-[#11181d]/55 md:hidden">
   <button type="button" className="absolute inset-0" aria-label="Close admin navigation" onClick={()=>setOpen(false)}/>
   <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-[#202830] shadow-2xl"><div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5"><span className="text-sm font-semibold">HelloCara Admin</span><button type="button" aria-label="Close admin navigation" onClick={()=>setOpen(false)} className="flex size-10 items-center justify-center rounded-lg hover:bg-white/10"><X size={20} aria-hidden/></button></div><AdminNav {...props}/></aside>
  </dialog>
 </>;
}
