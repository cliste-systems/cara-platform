"use client";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {BusinessClassificationPicker} from './business-classification-picker';
import {parseBusinessClassification,type BusinessClassification} from '@/lib/business-classification';
import {saveBusinessClassification} from '@/app/(dashboard)/dashboard/business-classification-actions';
import {DASHBOARD_PRIMARY_BUTTON_CLASS} from './dashboard-surface';
export function BusinessClassificationEditor({initial,canManage}:{initial:BusinessClassification|null;canManage:boolean}){
 const [value,setValue]=useState(()=>parseBusinessClassification(initial)),[message,setMessage]=useState(''),[pending,start]=useTransition();const router=useRouter();
 return <div className="space-y-4"><fieldset disabled={pending||!canManage}><BusinessClassificationPicker value={value} onChange={setValue}/></fieldset><p className="text-xs leading-5 text-[#6b7c75]">This helps Cara recognise relevant enquiries. It does not add services, prices, qualifications or booking capabilities. Existing services and exclusions stay unchanged.</p>{canManage?<button type="button" disabled={pending||!value} className={`${DASHBOARD_PRIMARY_BUTTON_CLASS} disabled:opacity-50`} onClick={()=>start(async()=>{try{const result=await saveBusinessClassification(JSON.stringify(value));setMessage(result.message);if(result.ok)router.refresh();}catch{setMessage('Your business type could not be saved. Please try again.');}})}>{pending?'Saving…':'Save business type'}</button>:<p className="text-xs text-[#6b7c75]">Only the account owner can change this.</p>}{message&&<p role="status" className="text-sm text-[#35443f]">{message}</p>}</div>;
}
