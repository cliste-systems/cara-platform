"use client";

import {ChevronDown} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuRadioGroup,DropdownMenuRadioItem} from '@/components/ui/dropdown-menu';

/** Shared setup choices retain Cara styling in both the trigger and the open menu. */
export function SetupChoice({label,value,displayValue,placeholder,options,onChange,disabled=false,compact=false}:{label:string;value:string;displayValue?:string;placeholder?:string;options:readonly string[];onChange:(value:string)=>void;disabled?:boolean;compact?:boolean}) {
 return <DropdownMenu>
  <DropdownMenuTrigger data-setup-dropdown data-setup-dropdown-compact={compact||undefined} type="button" disabled={disabled} aria-label={`${label}: ${value||placeholder||'Choose an option'}`} className={`group inline-flex items-center justify-between gap-2 border border-[#d9e2dd] bg-white font-normal text-[#353D42] shadow-[0_1px_3px_rgba(53,61,66,0.04)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-[#84938c] focus-visible:ring-2 focus-visible:ring-[#353D42]/15 disabled:cursor-not-allowed disabled:bg-[#f7f9f8] disabled:text-[#84938c] motion-reduce:transition-none ${compact?'h-9 w-auto rounded-full px-3 text-xs sm:h-8':'h-10 w-full rounded-xl px-3 text-sm'}`}>
   <span className="min-w-0 truncate">{displayValue||value||placeholder||'Choose an option'}</span><ChevronDown size={14} aria-hidden="true" className="shrink-0 text-[#6b7c75] transition-transform group-data-[popup-open]:rotate-180 motion-reduce:transition-none"/>
  </DropdownMenuTrigger>
  <DropdownMenuContent data-setup-dropdown-menu align={compact?'end':'start'} sideOffset={6} className="min-w-44 rounded-2xl border border-[#d9e2dd] bg-white p-1.5 text-[#353D42] shadow-xl shadow-[#11181d]/10 ring-0 duration-150 motion-reduce:animate-none motion-reduce:duration-0">
   <DropdownMenuRadioGroup aria-label={label} value={value} onValueChange={next=>{if(typeof next==='string'&&options.includes(next))onChange(next);}}>
    {options.map(option=><DropdownMenuRadioItem key={option} value={option} label={option} closeOnClick className={`min-h-10 justify-center rounded-[10px] px-9 text-center text-sm transition-colors motion-reduce:transition-none ${value===option?'bg-[#353D42] text-white focus:bg-[#353D42] focus:text-white focus:**:text-white data-highlighted:bg-[#353D42]':'text-[#353D42] focus:bg-[#f3f6f4] focus:text-[#353D42] focus:**:text-[#353D42] data-highlighted:bg-[#f3f6f4]'}`}>{option}</DropdownMenuRadioItem>)}
   </DropdownMenuRadioGroup>
  </DropdownMenuContent>
 </DropdownMenu>;
}
