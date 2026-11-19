"use client";

import {useRef, useState, type AriaAttributes} from 'react';
import {ChevronDown, Minus, Plus} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';

type Props=AriaAttributes & {
 value:string;
 onChange:(value:string)=>void;
 'aria-label':string;
 'data-hours-field'?:string;
 className?:string;
};
const validTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const control='flex size-11 items-center justify-center rounded-full border border-[#dedede] text-[#292929] transition-colors hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#626262]';

/** A single editable time, with familiar quarter-hour adjustments. */
export function SetupTimePicker({value,onChange,className,...props}:Props) {
 const trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState(value);
 const label=props['aria-label'];
 function adjust(delta:number){
  const [hour,minute]=(validTime(draft)?draft:value).split(':').map(Number);
  const total=(hour*60+minute+delta+1440)%1440;
  setDraft(`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`);
 }
 function save(){if(validTime(draft)){onChange(draft);setOpen(false);}}
 return <Dialog open={open} onOpenChange={setOpen}>
  <button ref={trigger} {...props} data-setup-time type="button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setDraft(value);setOpen(true);}} className={`inline-flex items-center justify-between gap-1 tabular-nums ${className??''}`}>
   <span>{value}</span><ChevronDown size={12} className="shrink-0 text-[#777]" aria-hidden="true"/>
  </button>
  <DialogContent finalFocus={trigger} className="gap-5 rounded-3xl bg-white p-6 text-center text-[#292929] sm:max-w-[360px]" overlayClassName="bg-black/20 backdrop-blur-sm">
   <div className="px-5"><DialogTitle className="text-lg font-semibold leading-6">{label}</DialogTitle><DialogDescription className="mt-2 text-xs text-[#737373]">Enter a 24-hour time, e.g. 09:30.</DialogDescription></div>
   <div className="flex items-center justify-center gap-3 rounded-2xl bg-[#f5f5f5] px-3 py-5">
    <button type="button" aria-label="15 minutes earlier" onClick={()=>adjust(-15)} className={control}><Minus size={17}/></button>
    <input data-setup-time-editor style={{fontSize:28}} aria-label={label} type="text" inputMode="numeric" maxLength={5} value={draft} onChange={event=>{const text=event.target.value.replace(/[^\d:]/g,'');setDraft(/^\d{3,4}$/.test(text)?`${text.slice(0,2)}:${text.slice(2)}`:text);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();save();}if(event.key==='ArrowUp'){event.preventDefault();adjust(15);}if(event.key==='ArrowDown'){event.preventDefault();adjust(-15);}}} className="min-w-0 w-28 rounded-lg bg-transparent py-2 text-center text-[32px] font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[#626262]"/>
    <button type="button" aria-label="15 minutes later" onClick={()=>adjust(15)} className={control}><Plus size={17}/></button>
   </div>
   <p className="text-xs text-[#737373]">− / + adjusts by 15 minutes · Irish local time</p>
   <button type="button" disabled={!validTime(draft)} onClick={save} className="min-h-11 w-full rounded-full bg-[#292929] px-4 text-sm font-medium text-white transition-colors hover:bg-[#444] disabled:bg-[#737373] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#626262]">Set time</button>
  </DialogContent>
 </Dialog>;
}
