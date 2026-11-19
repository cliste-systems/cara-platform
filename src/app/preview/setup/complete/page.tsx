import {notFound} from 'next/navigation';
import Link from 'next/link';
import {FirstCallWelcome} from '@/components/dashboard/first-call-welcome';
import type {FirstCallSetupState} from '@/lib/first-call-setup';
import styles from '@/components/dashboard/setup-business-step.module.css';
export default async function SetupCompletePreview({searchParams}:{searchParams:Promise<{state?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const connected=(await searchParams).state==='connected';
 const state:FirstCallSetupState={email:'you@business.ie',emailVerified:true,businessName:'Your business',legalName:'',verificationStatus:'submitted',reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:true,greetingReady:true,hoursReady:true,servicesReady:false,hadConversation:true,forwardingVerified:connected,welcomeSeen:false,canManage:true,connection:connected?{business_number:'+35312345678',phone_type:'landline',provider:'eir',requested_at:new Date().toISOString(),verified_at:new Date().toISOString(),verified_call_sid:'CA00000000000000000000000000000000',trial_activated_at:new Date().toISOString(),support_ticket_id:null}:null};
 return <FirstCallWelcome state={state} initialOpen readOnly requiredSetup previewScreen="forwarding" previewCompletion dashboardAction={<Link href="/dashboard" className={`${styles.primary} w-full`}>Open dashboard<span aria-hidden>→</span></Link>}/>;
}
