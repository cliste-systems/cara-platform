"use client";
import {FormFeedback} from "@/components/ui/form-feedback";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import {openBillingPortal,cancelPendingConnectionSetup} from "./actions";
export function OpenBillingPortalButton({className}:{className?:string}){
 const [pending,start]=useTransition(),[error,setError]=useState<string|null>(null),[connectionPending,setConnectionPending]=useState(false),[confirmCancel,setConfirmCancel]=useState(false);
 function open(paymentOnly=false){start(async()=>{setError(null);try{const result=await openBillingPortal(paymentOnly);if(result.ok)window.location.href=result.url;else if(result.connectionPending)setConnectionPending(true);else setError(result.message);}catch{setError('Billing could not be opened. Please retry.');}});}
 return <div className={className}><button type="button" disabled={pending} onClick={()=>open()} className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS,"inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-auto")}>{pending?'Opening…':'Manage billing'}</button>
 <Dialog open={connectionPending} onOpenChange={open=>{setConnectionPending(open);setConfirmCancel(false);}}><DialogContent className="max-w-md rounded-3xl bg-white p-6 text-center"><DialogTitle>{confirmCancel?'Cancel your setup?':'Your trial is waiting'}</DialogTitle><DialogDescription>{confirmCancel?'This cancels your subscription immediately. Your phone service will stop.':'Your 7-day trial starts when your number is connected. Manage your saved payment details here.'}</DialogDescription>
 {confirmCancel?<><button disabled={pending} className={DASHBOARD_PRIMARY_BUTTON_CLASS} onClick={()=>start(async()=>{try{const result=await cancelPendingConnectionSetup();setError(result.message);if(result.ok)setConnectionPending(false);}catch{setError('Cancellation could not be completed. Please retry.');}})}>Confirm cancellation</button><button disabled={pending} className="min-h-11 rounded-full border" onClick={()=>setConfirmCancel(false)}>Keep setup</button></>:<><button disabled={pending} className={DASHBOARD_PRIMARY_BUTTON_CLASS} onClick={()=>open(true)}>Update payment method</button><button disabled={pending} className="min-h-11 rounded-full border" onClick={()=>setConfirmCancel(true)}>Cancel setup</button></>}
 {error&&<p role="status" className="text-sm">{error}</p>}
 </DialogContent></Dialog>{error&&!connectionPending&&<FormFeedback message={error} className="mt-2"/>}</div>;
}
