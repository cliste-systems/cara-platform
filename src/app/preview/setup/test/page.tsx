import {notFound} from "next/navigation";
import {FirstCallWelcome} from "@/components/dashboard/first-call-welcome";
import type {FirstCallSetupState} from "@/lib/first-call-setup";

export default async function TestCallSetupPreview({searchParams}:{searchParams:Promise<{state?:string}>}) {
 if(process.env.NODE_ENV!=="development") notFound();
 const previewState=(await searchParams).state;
 const complete=previewState==="complete";
 const state:FirstCallSetupState={email:"you@business.ie",emailVerified:true,businessName:"Your business",legalName:"",verificationStatus:"submitted",reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:true,greetingReady:true,hoursReady:true,servicesReady:false,hadConversation:false,forwardingVerified:false,welcomeSeen:false,canManage:true};
 return <FirstCallWelcome state={state} initialOpen readOnly requiredSetup previewScreen="test" previewTestComplete={complete} previewNumberUnavailable={previewState==="unavailable"}/>;
}
