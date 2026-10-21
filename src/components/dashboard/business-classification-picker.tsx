"use client";

import {useCallback, useEffect, useId, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, ChevronRight, Pencil, Search} from 'lucide-react';
import {SETUP_BUSINESS_CATEGORIES as BUSINESS_CATEGORIES, classificationLabels, type BusinessClassification} from '@/lib/business-classification';
import {SetupSectionTransition} from './setup-section-transition';
import {AuthFormAlert} from '@/components/auth/auth-form-alert';

const PAGE_SIZE = 4;
const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#353D42]';

export type IndustryNavigation = {back: () => void; label?:string} | null;

export function BusinessClassificationPicker({value, onChange, error, onIndustryNavigation}: {
 onIndustryNavigation?: (navigation: IndustryNavigation) => void;
 value: BusinessClassification | null;
 onChange: (value: BusinessClassification | null) => void;
 error?: string;
}) {
 const [editing, setEditing] = useState(false);
 const [categoryId, setCategoryId] = useState(value?.categoryId ?? '');
 const [query, setQuery] = useState('');
 const [page, setPage] = useState(0);
 const id = useId();
 const category = BUSINESS_CATEGORIES.find(c => c.id === categoryId);
 const resetIndustry = useCallback(() => {setEditing(false);setCategoryId('');setQuery('');setPage(0);onChange(null);}, [onChange]);
 const previousChoices=useCallback(()=>setPage(value=>Math.max(0,value-1)),[]);
 useEffect(() => {
  onIndustryNavigation?.(page>0 ? {back:previousChoices,label:"Previous choices"} : categoryId ? {back:resetIndustry,label:"Back to industries"} : null);
  return () => onIndustryNavigation?.(null);
 }, [page,categoryId,previousChoices,resetIndustry,onIndustryNavigation]);
 const match = (text: string) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
 const showChoices = !value || editing;
 const industries = BUSINESS_CATEGORIES.filter(c => match(`${c.label} ${c.specialties.map(s => s.label).join(' ')}`));
 const specialties = category?.specialties.filter(s => match(s.label)) ?? [];
 const count = category ? specialties.length : industries.length;
 const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
 const currentPage = Math.min(page, pageCount - 1);
 const start = currentPage * PAGE_SIZE;

 function toggle(specialtyId: string) {
  if (!category) return;
  const previous = value?.categoryId === category.id ? value.specialtyIds : [];
  const selected = previous.includes(specialtyId)
   ? previous.filter(id => id !== specialtyId)
   : previous.length < 8 ? [...previous, specialtyId] : previous;
  setEditing(true);
  onChange(selected.length ? {version: 1, categoryId: category.id, specialtyIds: selected} : null);
 }

 return <div className="space-y-3 text-left" aria-describedby={error ? `${id}-error` : undefined}>
  <SetupSectionTransition screenKey={showChoices ? `choose-${categoryId || "industry"}` : "summary"}>
  <div className="space-y-3">
  {showChoices && <div data-setup-choice-heading className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-sm font-medium text-[#353D42]">{category ? 'Choose your specialities' : 'Choose your industry'}</p>


  </div>}
  {showChoices && <>
   <label data-setup-search className="flex min-h-11 items-center gap-3 rounded-xl border border-[#d9e2dd] bg-white px-3 focus-within:ring-2 focus-within:ring-[#b9c8c1]">
    <Search size={16} className="shrink-0 text-[#63756c]" aria-hidden="true"/>
    <span className="sr-only">{category ? 'Search specialities' : 'Search industries or specialities'}</span>
    <input value={query} onChange={e => {setQuery(e.target.value); setPage(0);}} placeholder={category ? 'Find your speciality' : 'Find your industry, e.g. electrician'} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-[#11181d] outline-none"/>
   </label>
   <SetupSectionTransition screenKey={`${categoryId || 'categories'}-${currentPage}`}>
    <div className="grid grid-cols-1 gap-2 p-1 sm:grid-cols-2" role="group" aria-label={category ? 'Business specialities' : 'Business industries'}>
     {category ? specialties.slice(start, start + PAGE_SIZE).map(s => {
      const checked = value?.specialtyIds.includes(s.id) ?? false;
      return <button data-setup-option key={s.id} type="button" aria-pressed={checked} disabled={!checked && (value?.specialtyIds.length ?? 0) >= 8} onClick={() => toggle(s.id)} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusStyle} ${checked ? 'border-[#353D42] bg-[#f3f6f4] font-medium text-[#11181d]' : 'border-[#d9e2dd] bg-white text-[#353D42] hover:border-[#84938c] hover:bg-[#f7f9f8]'}`}>
       <span>{s.label}</span><span className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-[#353D42] bg-[#353D42] text-white' : 'border-[#d9e2dd]'}`}>{checked && <Check size={14} aria-hidden="true"/>}</span>
      </button>;
     }) : industries.slice(start, start + PAGE_SIZE).map(c => <button data-setup-option key={c.id} type="button" onClick={() => {setEditing(true);setCategoryId(c.id); setQuery(''); setPage(0); onChange(null);}} className={`group flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-[#d9e2dd] bg-white px-4 py-3 text-left transition-colors hover:border-[#84938c] hover:bg-[#f7f9f8] ${focusStyle}`}>
      <span><span className="block text-sm font-medium leading-5 text-[#11181d]">{c.label}</span><span className="mt-1 block text-xs leading-5 text-[#5b6b65]">{c.specialties.slice(0, 2).map(s => s.label).join(' · ')}</span></span>
      <ChevronRight size={16} className="shrink-0 text-[#63756c] transition-transform group-hover:translate-x-0.5" aria-hidden="true"/>
     </button>)}
     {!count && <p className="col-span-full px-3 py-6 text-center text-sm text-[#5b6b65]">No matches. Try another search or use Setup help.</p>}
    </div>
   </SetupSectionTransition>
   {pageCount > 1 && <nav aria-label={category ? 'Speciality pages' : 'Industry pages'} className="flex items-center justify-between gap-3 px-1 pt-1">
    {!onIndustryNavigation && currentPage>0 && <button type="button" aria-label="Previous choices" onClick={()=>setPage(currentPage-1)} className={`inline-flex size-10 items-center justify-center rounded-full border border-[#d9e2dd] text-[#353D42] hover:bg-[#f3f6f4] ${focusStyle}`}><ArrowLeft size={16}/></button>}
    <span aria-live="polite" className="text-xs text-[#5b6b65]">{start + 1}–{Math.min(start + PAGE_SIZE, count)} of {count} <span className="sr-only">choices</span></span>
    <button type="button" aria-label="Next choices" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className={`inline-flex size-10 items-center justify-center rounded-full border border-[#d9e2dd] text-[#353D42] hover:bg-[#f3f6f4] disabled:opacity-30 ${focusStyle}`}><ArrowRight size={16}/></button>
   </nav>}
  </>}
  {category && showChoices && <p className="text-center text-xs leading-5 text-[#5b6b65]">{`${value?.specialtyIds.length ?? 0} of 8 selected · Choose all that apply, then save below.`}</p>}
  {value && !showChoices && <section aria-label="Your selected business" aria-live="polite" className="overflow-hidden rounded-2xl border border-[#d9e2dd] bg-white text-center shadow-[0_2px_8px_rgba(53,61,66,0.04)]">
   <div className="space-y-3 border-b border-[#e3e9e5] p-4">
    <div className="min-w-0"><p className="text-xs text-[#5b6b65]">Industry</p><p className="mt-1 text-sm font-medium leading-6 text-[#11181d]">{classificationLabels(value).category.label}</p></div>
    <button type="button" aria-label="Change industry" onClick={()=>{setCategoryId('');setQuery('');setPage(0);onChange(null);}} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9e2dd] bg-white px-4 text-xs font-medium text-[#353D42] transition-colors hover:border-[#84938c] hover:bg-[#f3f6f4] ${focusStyle}`}><Pencil size={13} aria-hidden="true"/>Change industry</button>
   </div>
   <div className="space-y-3 p-4">
    <div className="min-w-0"><p className="text-xs text-[#5b6b65]">{value.specialtyIds.length===1?'Speciality':'Specialities'}</p><ul className="mt-2 flex flex-wrap justify-center gap-2">{classificationLabels(value).specialties.map(specialty=><li key={specialty.id} className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-[#f3f6f4] px-3 py-2 text-sm font-medium text-[#353D42]">{specialty.label}</li>)}</ul></div>
    <button type="button" aria-label="Edit specialities" onClick={()=>{setEditing(true);setQuery('');setPage(0);}} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9e2dd] bg-white px-4 text-xs font-medium text-[#353D42] transition-colors hover:border-[#84938c] hover:bg-[#f3f6f4] ${focusStyle}`}><Pencil size={13} aria-hidden="true"/>Edit specialities</button>
   </div>
  </section>}
  </div>
  </SetupSectionTransition>
  {error && <div id={`${id}-error`}><AuthFormAlert message={error}/></div>}
  <input type="hidden" name="businessClassification" value={value ? JSON.stringify(value) : ''}/>
 </div>;
}
