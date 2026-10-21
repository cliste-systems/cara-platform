"use client";

import {useEffect, useId, useImperativeHandle, useRef, useState, type Ref} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {CalendarDays, Check, Clock3, Moon} from 'lucide-react';
import {CallHandlingPreferences} from './call-handling-preferences';
import {DAY_KEYS, DAY_LABELS} from '@/lib/business-hours';
import {firstCallHoursErrors,hoursPanelForField,type HoursPanel} from '@/lib/first-call-hours-validation';
import {AuthFormAlert} from '@/components/auth/auth-form-alert';

const field='w-full rounded-xl border border-[#d9e2dd] bg-white px-3 py-2 text-xs text-[#11181d] outline-none transition-colors focus:border-[#84938c] focus:ring-2 focus:ring-[#353D42]/10';
const focus='focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#353D42]';

export type HoursFieldsHandle = {validate:()=>boolean};
export function FirstCallHoursFields({values,smsPricing,ref}:{ref?:Ref<HoursFieldsHandle>;values:Record<string,string>;smsPricing?:import("@/lib/sms-plan-pricing").SmsPlanPricing|null}) {
 const [panel,setPanel]=useState<HoursPanel>(['week','holidays','outside'].includes(values.hoursPanel)?values.hoursPanel as HoursPanel:'week');
 const [attempted,setAttempted]=useState(false);
 const root=useRef<HTMLDivElement>(null),pendingFocus=useRef<string|null>(null);
 const [fields,setFields]=useState<Record<string,string>>(()=>({...Object.fromEntries(DAY_KEYS.flatMap(day=>[[`${day}_open`,values[`${day}_open`]??''],[`${day}_start`,values[`${day}_start`]||'09:00'],[`${day}_end`,values[`${day}_end`]||'17:00']])),holidayMode:values.holidayMode||'usual',holidayStart:values.holidayStart||'10:00',holidayEnd:values.holidayEnd||'14:00',outsideAvailability:values.outsideAvailability||'closed',smsAlerts:values.smsAlerts||'off',alertPhone:values.alertPhone||''}));
 const scope=useId();
 const reduced=useReducedMotion();
 const duration=reduced?0:0.22;
 const hasOpenDay=DAY_KEYS.some(day=>fields[`${day}_open`]==="on");
 const errors=attempted?firstCallHoursErrors(fields):{};
 const visibleErrors=Object.entries(errors).filter(([name])=>hoursPanelForField(name)===panel);
 function focusProblem(){if(!pendingFocus.current)return;const target=root.current?.querySelector<HTMLElement>(`[data-hours-field="${pendingFocus.current}"]`);if(target){target.focus({preventScroll:true});target.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});pendingFocus.current=null;}}
 useEffect(()=>{focusProblem();},[panel,attempted]);
 useImperativeHandle(ref,()=>({validate(){const issues=firstCallHoursErrors(fields);setAttempted(true);const first=Object.keys(issues)[0];if(!first)return true;pendingFocus.current=first;setPanel(hoursPanelForField(first));requestAnimationFrame(focusProblem);return false;}}));
 function fieldProps(name:string){return {'data-hours-field':name,'aria-invalid':Boolean(errors[name]),'aria-describedby':errors[name]?`${scope}-${name}-error`:undefined};}
 function fieldError(name:string){return errors[name]?<span id={`${scope}-${name}-error`} className="block text-xs leading-5 text-[#a13d35]">{errors[name]}</span>:null;}
 const update=(name:string,value:string)=>setFields(previous=>({...previous,[name]:value}));
 const tabs:{id:HoursPanel;label:string;icon:typeof Clock3}[]=[{id:'week',label:'Usual hours',icon:Clock3},{id:'holidays',label:'Bank holidays',icon:CalendarDays},{id:'outside',label:'Outside hours',icon:Moon}];
 function choice(name:string,value:string,label:string,Icon:typeof Clock3) {
  const checked=fields[name]===value;
  return <motion.button key={value} type="button" aria-pressed={checked} onClick={()=>update(name,value)} whileTap={reduced?undefined:{scale:0.98}} className={`relative flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-medium transition-colors ${focus} ${checked?'border-[#353D42] bg-[#f3f6f4] text-[#11181d]':'border-[#d9e2dd] bg-white text-[#5b6b65] hover:border-[#84938c]'}`}>
   <Icon size={16} aria-hidden="true"/><span>{label}</span>{checked&&<motion.span initial={{scale:reduced?1:0}} animate={{scale:1}} className="absolute right-2 top-2 flex size-3.5 items-center justify-center rounded-full bg-[#353D42] text-white"><Check size={10}/></motion.span>}
  </motion.button>;
 }
 return <div ref={root} data-setup-hours className="space-y-3">
  {visibleErrors.length>0&&<AuthFormAlert title="Check your opening hours" message={visibleErrors[0][1]}/>}
  <input type="hidden" name="hoursPanel" value={panel}/>
  {Object.entries(fields).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
  <div role="group" aria-label="Opening hours settings" className="isolate flex gap-1 rounded-full border border-[#e3e9e5] bg-white p-1">
   {tabs.map(({id,label,icon:Icon})=><button key={id} type="button" aria-pressed={panel===id} aria-label={Object.keys(errors).some(name=>hoursPanelForField(name)===id)?`${label} — needs attention`:label} onClick={()=>setPanel(id)} className={`relative flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full px-2 text-[11px] font-medium transition-colors sm:text-xs ${focus} ${panel===id?'text-white':'text-[#5b6b65] hover:text-[#11181d]'}`}>
    {panel===id&&<motion.span layoutId={`${scope}-tab`} className="absolute inset-0 -z-10 rounded-full bg-[#353D42]" transition={reduced?{duration:0}:{type:'spring',stiffness:360,damping:34}}/>}<Icon size={14} className="hidden sm:block" aria-hidden="true"/>{label}{Object.keys(errors).some(name=>hoursPanelForField(name)===id)&&<span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#b74b3f]"/>}
   </button>)}
  </div>
  <div data-hours-panel-body={panel} className="relative">
   <AnimatePresence mode="wait" initial={false}>
    <motion.div key={panel} initial={{opacity:0,y:reduced?0:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-4}} transition={{duration,ease:[0.22,1,0.36,1]}} onAnimationComplete={focusProblem} className="relative flex flex-col">
     {panel==='week'&&<>
      <div data-setup-schedule-heading className="mb-2 grid grid-cols-[1fr_80px_14px_80px] gap-2 px-2 text-[10px] font-medium uppercase tracking-wider text-[#63756c]"><span>Weekly schedule</span><span aria-hidden={!hasOpenDay} className={`text-center transition-opacity duration-200 motion-reduce:transition-none ${hasOpenDay?"opacity-100":"opacity-0"}`}>From</span><span/><span aria-hidden={!hasOpenDay} className={`text-center transition-opacity duration-200 motion-reduce:transition-none ${hasOpenDay?"opacity-100":"opacity-0"}`}>Until</span></div>
      <div className="divide-y divide-[#e3e9e5]">{DAY_KEYS.map(day=>{const open=fields[`${day}_open`]==='on';return <div data-setup-schedule-row key={day} className={`grid min-h-8 grid-cols-[1fr_80px_14px_80px] items-center gap-x-2 px-2 ${errors[`${day}_start`]||errors[`${day}_end`]?"gap-y-1 py-1":"h-8"}`}>
       <label className="flex w-fit cursor-pointer items-center gap-3 text-xs text-[#353D42]"><input type="checkbox" className="peer sr-only" checked={open} onChange={e=>update(`${day}_open`,e.target.checked?'on':'')}/><span className={`relative h-4 w-7 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${open?'bg-[#353D42]':'bg-[#e3e9e5]'}`}><motion.span initial={false} animate={{x:open?14:2}} transition={{duration:reduced?0:0.18}} className="absolute top-0.5 size-3 rounded-full bg-white shadow-sm"/></span><span>{DAY_LABELS[day]}</span></label>
       {open?<><input aria-label={`${DAY_LABELS[day]} opening time`} type="time" {...fieldProps(`${day}_start`)} value={fields[`${day}_start`]} onChange={e=>update(`${day}_start`,e.target.value)} className="h-7 min-w-0 rounded-md border border-[#d9e2dd] bg-white px-1 text-[11px] text-[#353D42] outline-none focus:ring-2 focus:ring-[#353D42]/10 aria-invalid:border-[#a13d35]"/><span className="text-center text-xs text-[#63756c]">–</span><input aria-label={`${DAY_LABELS[day]} closing time`} type="time" {...fieldProps(`${day}_end`)} value={fields[`${day}_end`]} onChange={e=>update(`${day}_end`,e.target.value)} className="h-7 min-w-0 rounded-md border border-[#d9e2dd] bg-white px-1 text-[11px] text-[#353D42] outline-none focus:ring-2 focus:ring-[#353D42]/10 aria-invalid:border-[#a13d35]"/></>:<span className="col-span-3 text-right text-xs text-[#63756c]">Closed</span>}
       {(errors[`${day}_start`]||errors[`${day}_end`])&&<div className="col-span-full text-left">{fieldError(`${day}_start`)}{fieldError(`${day}_end`)}</div>}
      </div>;})}</div>
      <p className="mt-auto pt-2 text-center text-[11px] text-[#63756c]">Irish local time · Switch on the days you’re open.</p>
     </>}
     {panel==='holidays'&&<>
      <p className="mb-4 text-center text-xs leading-5 text-[#5b6b65]">How do your hours change on bank & public holidays?</p>
      <div className="flex gap-2">{choice('holidayMode','usual','Usual hours',CalendarDays)}{choice('holidayMode','closed','Closed',Moon)}{choice('holidayMode','different','Different hours',Clock3)}</div>
      <div className="mt-4 flex items-center justify-center">
       <AnimatePresence mode="wait" initial={false}><motion.div key={fields.holidayMode} initial={{opacity:0,y:reduced?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-4}} transition={{duration}} className="w-full">
        {fields.holidayMode==='different'?<div className="mx-auto grid max-w-sm grid-cols-2 gap-3">{[['holidayStart','Opening time'],['holidayEnd','Closing time']].map(([name,label])=><label key={name} className="block space-y-2 text-xs text-[#5b6b65]"><span>{label}</span><input type="time" {...fieldProps(name)} aria-label={`Bank holiday ${label.toLowerCase()}`} value={fields[name]} onChange={e=>update(name,e.target.value)} className={`${field} h-11 aria-invalid:border-[#a13d35]`}/>{fieldError(name)}</label>)}</div>:<p className="rounded-2xl bg-[#f7f9f8] px-4 py-4 text-center text-sm leading-6 text-[#353D42]">{fields.holidayMode==='closed'?'Cara will let callers know you’re closed on bank and public holidays.':'Cara will use your usual weekly hours for that day.'}</p>}
       </motion.div></AnimatePresence>
      </div>
     </>}
     {panel==='outside'&&<CallHandlingPreferences values={fields} onChange={update} smsPricing={smsPricing} alertPhoneProps={fieldProps("alertPhone")} alertPhoneError={fieldError("alertPhone")}/>}

    </motion.div>
   </AnimatePresence>
  </div>
 </div>;
}
