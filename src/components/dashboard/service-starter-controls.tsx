"use client";

import {useId,useState,type ReactNode} from 'react';
import {ArrowRight,Check,Plus,Search} from 'lucide-react';
import type {BusinessClassification} from '@/lib/business-classification';
import {selectedServiceRecipes,starterServiceKey} from '@/lib/service-starter';
import type {ServiceSelection} from './first-call-services-fields';

const secondary='inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm text-[#637075] transition-colors hover:text-[#11181d] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40';
const primary='inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#11181d] px-6 text-sm font-medium text-white transition-colors hover:bg-[#243136] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40';

export function ServiceStarterControls({model,classification,pending,offeredField,excludedField}:{model:ServiceSelection;classification:BusinessClassification|null;pending:boolean;offeredField:ReactNode;excludedField:ReactNode}){
 const [query,setQuery]=useState('');
 const id=useId(),recipes=selectedServiceRecipes(classification),profiles=recipes.filter(recipe=>recipe.options?.length);
 const count=model.entries.services.items.length;
 const extras=model.extras.filter(label=>label.toLocaleLowerCase('en-IE').includes(query.trim().toLocaleLowerCase('en-IE')));
 function open(){setQuery('');model.openSuggestions();}

 if(model.stage==='choose')return <div className="space-y-3 text-center">
  <div className="grid gap-3" aria-label="Choose a starting list">
   <button type="button" onClick={()=>model.chooseStartingList('suggested')} className="relative rounded-xl border border-[#353D42]/40 bg-white px-10 py-5 text-center transition-colors hover:bg-[#f3f6f4] focus-visible:outline-2 focus-visible:outline-offset-2">
    <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-[#6b7c75]">Recommended</span>
    <span className="block text-base font-medium text-[#11181d]">Use suggested services</span>
    <span className="mx-auto mt-2 block max-w-sm text-sm leading-5 text-[#6b7c75]">Start with common services for your business. Remove anything that doesn’t apply.</span>
    <ArrowRight size={16} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#637075]"/>
   </button>
   <button type="button" onClick={()=>model.chooseStartingList('fresh')} className="relative rounded-xl border border-[#d9e2dd] bg-white px-10 py-5 text-center transition-colors hover:bg-[#f7f9f8] focus-visible:outline-2 focus-visible:outline-offset-2">
    <span className="block text-base font-medium text-[#11181d]">Start fresh</span>
    <span className="mt-2 block text-sm leading-5 text-[#6b7c75]">Build your own service list.</span>
    <ArrowRight size={16} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#637075]"/>
   </button>
  </div>
 </div>;

 if(model.stage==='profiles')return <div className="space-y-4 text-center">
  <div className="max-h-[min(300px,38dvh)] space-y-5 overflow-y-auto overscroll-contain rounded-xl border border-[#d9e2dd] bg-white p-3 [scrollbar-width:thin]">
   {profiles.map(recipe=><fieldset key={recipe.id} className="space-y-2">
    <legend className="mb-2 w-full text-center text-sm font-medium text-[#353D42]">{profiles.length>1?`${recipe.label} · `:''}{recipe.question}</legend>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{recipe.options!.map(option=>{const checked=model.starter.profiles[recipe.id]?.includes(option.id)??false;return <button key={option.id} type="button" aria-pressed={checked} onClick={()=>model.changeProfile(recipe.id,option.id)} className={`relative flex min-h-11 items-center justify-center rounded-lg border px-9 py-2 text-center text-sm focus-visible:outline-2 ${checked?'border-[#353D42] bg-[#f3f6f4] text-[#11181d]':'border-[#d9e2dd] bg-white text-[#5b6b65]'}`}><span>{option.label}</span>{checked?<Check size={15} className="absolute right-3" aria-hidden="true"/>:null}</button>;})}</div>
   </fieldset>)}
  </div>
  {model.notice?<p role="status" className="text-sm text-[#6b7c75]">{model.notice.message}</p>:null}
  <button type="button" className={primary} disabled={pending||model.missingProfiles.length>0} onClick={model.reviewProfiles}>Review services<ArrowRight size={16} aria-hidden="true"/></button>
 </div>;

 if(model.stage==='excluded')return <div className="text-center">{excludedField}</div>;

 if(model.stage==='suggestions')return <div className="space-y-4 text-center">
  <label htmlFor={id} className="relative mx-auto flex min-h-12 items-center rounded-xl border border-[#d9e2dd] bg-white px-10 focus-within:border-[#84938c] focus-within:ring-2 focus-within:ring-[#353D42]/5">
   <Search size={17} className="absolute left-4 text-[#84938c]" aria-hidden="true"/>
   <span className="sr-only">Search suggested services</span>
   <input id={id} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}} placeholder="Find a service" className="w-full min-w-0 bg-transparent py-3 text-center text-sm outline-none"/>
  </label>
  <div role="region" aria-label="Suggested services" tabIndex={0} className="max-h-[min(320px,38dvh)] overflow-y-auto overscroll-contain rounded-xl border border-[#d9e2dd] bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#84938c] [scrollbar-width:thin]">
   {extras.map(label=>{const selected=model.entries.services.items.some(item=>starterServiceKey(item)===starterServiceKey(label));return <button key={label} type="button" disabled={pending||selected} aria-pressed={selected} onClick={()=>model.addSuggestion(label)} className={`relative flex min-h-12 w-full items-center justify-center border-b border-[#e7ece9] px-12 py-3 text-center text-sm leading-5 transition-colors last:border-b-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] ${selected?'bg-[#f3f6f4] text-[#353D42]':'text-[#353D42] hover:bg-[#f7f9f8]'}`}>
    <span>{label}</span><span className={`absolute right-4 flex size-6 items-center justify-center rounded-full ${selected?'bg-[#353D42] text-white':'border border-[#d9e2dd] text-[#637075]'}`}>{selected?<Check size={14} aria-hidden="true"/>:<Plus size={14} aria-hidden="true"/>}</span>
   </button>;})}
   {!extras.length?<p className="px-6 py-8 text-sm leading-6 text-[#6b7c75]">No matching suggestions. You can add your own service on the previous screen.</p>:null}
  </div>
  {model.notice?<p role={model.notice.kind==='error'?'alert':'status'} className="text-sm leading-5 text-[#6b7c75]">{model.notice.message}</p>:null}
  <p role="status" className="sr-only">{count} services in your list.</p>
  <button type="button" disabled={pending} onClick={model.returnToEditor} className={primary}>Done<Check size={16} aria-hidden="true"/></button>
 </div>;

 return <div className="space-y-3 text-center">
  <p className="text-sm font-medium text-[#353D42]">What you offer <span className="ml-1 font-normal text-[#84938c]">{count}</span></p>
  {offeredField}
  {model.extras.length?<button type="button" disabled={pending} onClick={open} className={`${secondary} mx-auto border border-[#d9e2dd] bg-white text-[#353D42] hover:border-[#84938c]`}><Plus size={14} aria-hidden="true"/>Add suggested services</button>:null}
 </div>;
}
