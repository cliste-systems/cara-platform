/** Official manufacturer/provider guidance checked 19 October 2026. No shared GSM-code assumptions. */
export const FORWARDING_SOURCES={
 apple:{label:"Apple · iPhone",url:"https://support.apple.com/guide/iphone/set-up-call-forwarding-iph7405291c4/ios"},
 samsung:{label:"Samsung · Galaxy",url:"https://www.samsung.com/uk/support/mobile-devices/how-do-i-use-the-call-functions-on-my-device/"},
 vodafone:{label:"Vodafone Ireland · mobile",url:"https://n.vodafone.ie/support/mobile/calls-texts-and-voicemail.html"},
 virgin:{label:"Virgin Media Ireland · business phone",url:"https://www.virginmedia.ie/business/faqs/phone"},
 three:{label:"Three Ireland · support",url:"https://www.three.ie/business/support.html"},
 eir:{label:"eir · support",url:"https://www.eir.ie/helpandsupport/"},
 vodafoneFixed:{label:"Vodafone Ireland · fixed-line support",url:"https://www.vodafone.ie/business/support/broadband"},
} as const;
export function irishNationalDestination(number:string|null){return /^\+353[1-9]\d{7,8}$/.test(number??"")?`0${number!.slice(4)}`:null;}
export function forwardingCodes(provider:string,line:string,number:string|null){
 const destination=irishNationalDestination(number);return destination?codesForDestination(provider,line,destination):null;
}
/** Preview codes show the displayed number, but never enable copy or dial actions. */
export function forwardingCodePreview(provider:string,line:string,displayNumber:string|null){return displayNumber&&/^\+353\d+$/.test(displayNumber)?codesForDestination(provider,line,displayNumber):null;}
function codesForDestination(provider:string,line:string,destination:string){
 if(provider==="Vodafone"&&line!=="landline"&&line!=="hosted")return [{label:"Unanswered calls",on:`**61*${destination}#`,off:"##61#"},{label:"Busy calls",on:`**67*${destination}#`,off:"##67#"},{label:"All calls",on:`**21*${destination}#`,off:"##21#"}];
 if(provider==="Virgin Media"&&line==="landline")return [{label:"All calls · Virgin Media business phone",on:`*70${destination}`,off:"#70"}];
 return null;
}
