'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {reviewAssistedConnection} from '@/app/(admin)/admin/organizations/[id]/store-setup/actions';
export function ConnectionEvidenceReview({organizationId}:{organizationId:string}){
 const [sid,setSid]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState(''),[busy,start]=useTransition();const router=useRouter();
 return <details className="mt-5 border-t border-[#e5e7eb] pt-4"><summary className="cursor-pointer text-xs font-medium">Review a connection with missing carrier evidence</summary><form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();start(async()=>{try{const result=await reviewAssistedConnection(organizationId,{callSid:sid,reason,confirmed});setMessage(result.message);if(result.ok)router.refresh();}catch{setMessage('The review could not be saved. Please retry.');}});}}>
 <p className="text-xs leading-5 text-gray-500">Use only after witnessing a call to the saved business number reaching Cara. The server checks the call, assigned line and duration. The review is recorded in the security log.</p>
 <label className="block text-xs">Twilio call SID<input required value={sid} maxLength={34} onChange={e=>setSid(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm" placeholder="CA…"/></label>
 <label className="block text-xs">How was forwarding confirmed?<textarea required minLength={20} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm"/></label>
 <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I witnessed this call reaching Cara through the customer’s saved business number, rather than by calling Cara directly.</label>
 <button disabled={busy||!confirmed} className="rounded-full bg-[#292929] px-5 py-2 text-xs text-white disabled:opacity-50">{busy?'Checking…':'Verify connection and activate trial'}</button>{message&&<p role="status" className="text-xs leading-5">{message}</p>}
 </form></details>;
}
