import {notFound} from "next/navigation";
import {FirstCallWelcome} from "@/components/dashboard/first-call-welcome";
import type {FirstCallSetupState} from "@/lib/first-call-setup";

export default async function ForwardingSetupPreview({searchParams}:{searchParams:Promise<{state?:string}>}) {
 const query=await searchParams;
 if(process.env.NODE_ENV!=="development") notFound();
 const state:FirstCallSetupState={email:"you@business.ie",emailVerified:true,businessName:"Your business",legalName:"",verificationStatus:"submitted",reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:true,greetingReady:true,hoursReady:true,servicesReady:false,hadConversation:true,forwardingVerified:false,welcomeSeen:false,canManage:true};
 if(query.state==='pending'||query.state==='connected')state.connection={business_number:'+35312345678',phone_type:'landline',provider:'eir',requested_at:new Date().toISOString(),verified_at:query.state==='connected'?new Date().toISOString():null,verified_call_sid:query.state==='connected'?'CA00000000000000000000000000000000':null,trial_activated_at:query.state==='connected'?new Date().toISOString():null,support_ticket_id:null};
 return <FirstCallWelcome state={state} initialOpen readOnly requiredSetup previewScreen="forwarding"/>;
}
