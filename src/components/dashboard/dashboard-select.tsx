"use client";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServiceTheme } from "./service-theme-context";
import styles from "./service-pages.module.css";
export type DashboardSelectOption<T extends string> = { value:T; label:string };
export function DashboardSelect<T extends string>({id,value,options,onValueChange,invalid=false,placeholder="Select…",className,"aria-label":label}: {
 id?:string;value:T;options:readonly DashboardSelectOption<T>[];onValueChange:(value:T)=>void;invalid?:boolean;placeholder?:string;className?:string;"aria-label"?:string;
}) {
 const serviceTheme=useServiceTheme();
 return <Select.Root items={options} value={value} onValueChange={next=>{if(next!==null)onValueChange(next as T)}}>
  <Select.Trigger id={id} aria-label={label} aria-invalid={invalid||undefined} className={cn("flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#b9c8c1] bg-white px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#353d42]",invalid&&"border-red-400",className)}>
   <Select.Value placeholder={placeholder}/><Select.Icon><ChevronDown className="size-4"/></Select.Icon>
  </Select.Trigger>
  <Select.Portal><Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-[100] outline-none">
   <Select.Popup className={cn(serviceTheme && styles.selectPopup, "max-h-[var(--available-height)] w-[var(--anchor-width)] min-w-40 overflow-y-auto rounded-xl border border-[#d9e2dd] bg-white p-1 shadow-xl outline-none motion-safe:transition-[opacity,transform] data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0")}>
    <Select.List>{options.filter(o=>o.value!=="").map(o=><Select.Item key={o.value} value={o.value} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-[#35443f] outline-none data-[highlighted]:bg-[#f3f6f4]"><Select.ItemText>{o.label}</Select.ItemText><Select.ItemIndicator><Check className="size-4"/></Select.ItemIndicator></Select.Item>)}</Select.List>
   </Select.Popup>
  </Select.Positioner></Select.Portal>
 </Select.Root>;
}
