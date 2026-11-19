import {notFound} from "next/navigation";
import {FirstCallWelcome} from "@/components/dashboard/first-call-welcome";
import type {FirstCallSetupState} from "@/lib/first-call-setup";

export default function ProfileSetupPreview() {
 if(process.env.NODE_ENV!=="development") notFound();
 const state:FirstCallSetupState={email:"you@business.ie",emailVerified:true,businessName:"",legalName:"",verificationStatus:"submitted",reviewNote:null,ticketId:null,details:{},number:null,lineEnabled:false,profileReady:false,greetingReady:false,hoursReady:false,servicesReady:false,hadConversation:false,forwardingVerified:false,welcomeSeen:false,canManage:true};
 return <FirstCallWelcome state={state} initialOpen readOnly requiredSetup previewScreen="profile"/>;
}
