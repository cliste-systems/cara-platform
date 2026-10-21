"use client";
import type { ReactNode } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { adminPrimaryButtonClass } from "./admin-interactive";
export function AdminFormDialog({ title, description, children }: { title: string; description: string; children: ReactNode }) {
 return <Dialog><DialogTrigger className={adminPrimaryButtonClass}>{title}</DialogTrigger><DialogContent className="max-h-[85dvh] overflow-y-auto bg-white p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
