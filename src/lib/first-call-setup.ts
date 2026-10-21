export type BusinessVerificationDetails = {
 legalName: string; registrationNumber: string; website: string; address: string;
 eircode: string; representative: string; email: string; businessType: "company" | "sole_trader";
};
export type FirstCallSetupState = {
 progressKey?: string;
 smsPricing?: import("./sms-plan-pricing").SmsPlanPricing | null;
 email: string; emailVerified: boolean; businessName: string; legalName: string;
 verificationStatus: string; reviewNote: string | null; ticketId: string | null;
 details: Partial<BusinessVerificationDetails>; number: string | null; lineEnabled: boolean; isTestNumber?: boolean;
 profileReady: boolean; greetingReady: boolean; hoursReady: boolean; servicesReady: boolean;
 hadConversation: boolean; forwardingVerified: boolean; forwardingReviewed?: boolean;
 welcomeSeen: boolean; canManage: boolean;
 configuration?: Record<string,string>;
 completedSections?: Record<string,string>;
 dashboardUnlocked?: boolean;
};
export function normalizeBusinessWebsite(value:string):string|null {
 const website=value.trim();
 if(!website||website.length>500||/\s/.test(website))return null;
 try {
  const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(website)?website:`https://${website}`);
  if(!["https:","http:"].includes(url.protocol)||!url.hostname.includes(".")||url.username||url.password)return null;
  return url.href;
 }catch{return null;}
}
export function validateVerificationDetails(raw: unknown): { details: BusinessVerificationDetails; error?: never } | { error: string; details?: never } {
 const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
 const field = (key: string) => typeof value[key] === "string" ? value[key].trim() : "";
 const details: BusinessVerificationDetails = { legalName:field("legalName"),registrationNumber:field("registrationNumber"),website:field("website"),address:field("address"),eircode:field("eircode").toUpperCase(),representative:field("representative"),email:field("email"),businessType:value.businessType === "sole_trader" ? "sole_trader" : "company" };
 if ([details.legalName,details.representative].some(v=>v.length<2||v.length>200) || details.address.length<8 || details.address.length>1000) return {error:"Enter your legal name, full business address and authorised contact."};
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)||details.email.length>254) return {error:"Enter a valid contact email."};
 if (!/^[A-Z][0-9A-Z]{2} ?[0-9A-Z]{4}$/.test(details.eircode)) return {error:"Enter a valid seven-character Eircode."};
 if (details.registrationNumber.length>80 || (details.businessType === "company" && !details.registrationNumber)) return {error:"Enter your company registration number."};
 const website=normalizeBusinessWebsite(details.website);
 if(!website)return {error:"Enter your business website, for example yourbusiness.ie. If you do not have one, contact support."};
 details.website=website;
 return {details};
}
export type FirstCallSection = "profile" | "hours" | "services" | "greeting";
/** Submitting business details completes setup; the team's review runs separately. */
export function firstCallBusinessDetailsComplete(s:FirstCallSetupState) {
 return ['submitted','needs_information','verified'].includes(s.verificationStatus);
}
export function firstCallConfigurationReady(s:FirstCallSetupState) {
 return s.emailVerified&&firstCallBusinessDetailsComplete(s)&&s.profileReady&&s.hoursReady&&s.greetingReady;
}
export function firstCallTestComplete(s:FirstCallSetupState) {
 return firstCallConfigurationReady(s)&&Boolean(s.number&&!s.isTestNumber&&s.hadConversation);
}
export function firstCallSteps(s: FirstCallSetupState) {
 const ready=firstCallConfigurationReady(s);
 const items=[
  {id:"email",title:"Verify your email",detail:s.email,complete:s.emailVerified},
  {id:"business",title:"Business details",detail:s.verificationStatus==="verified"?"Business verified":s.verificationStatus==="submitted"?"Awaiting review":s.verificationStatus==="needs_information"?"Update your details":"Legal details for your phone number",complete:firstCallBusinessDetailsComplete(s)},
  {id:"profile",title:"Your business",detail:"What your business does",complete:s.profileReady},
  {id:"hours",title:"Opening hours",detail:"When customers can reach you",complete:s.hoursReady},
  {id:"greeting",title:"Your greeting",detail:"How Cara welcomes callers",complete:s.greetingReady},
  {id:"test",title:"Try Cara",detail:s.hadConversation?"Test call complete":"Call Cara and try a few questions",complete:firstCallTestComplete(s)},
  {id:"forwarding",title:"Set up call forwarding",detail:"Connect your business number, then open your dashboard",complete:firstCallTestComplete(s)&&Boolean(s.forwardingReviewed)},
 ];
 return items.map((step,index)=>({...step,unlocked:
  items.slice(0,index).every(v=>v.complete)
  &&(step.id!=="test"||ready)
 }));
}
export function firstCallSetupComplete(s:FirstCallSetupState){return firstCallSteps(s).every(v=>v.complete);}
export function canEditFirstCallSection(s:FirstCallSetupState,id:string){
 // Keep the previous service-save action compatible with already-open clients.
 // Services are optional dashboard configuration and never a setup prerequisite.
 const step=id==="services"?"greeting":id;
 return firstCallSteps(s).some(v=>v.id===step&&v.unlocked);
}

export function nextFirstCallReceipts(previous:Record<string,string>,section:FirstCallSection,at:string){
 const order:FirstCallSection[]=["profile","hours","services","greeting"];
 const index=order.indexOf(section);
 return Object.fromEntries(order.slice(0,index+1).map(key=>[key,key===section?at:previous[key]]).filter(([,value])=>Boolean(value)));
}

export function needsFirstCallSetup(s:FirstCallSetupState){return !s.dashboardUnlocked&&!firstCallSetupComplete(s);}
