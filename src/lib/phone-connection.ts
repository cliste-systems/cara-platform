import {parsePhoneNumberFromString,type MetadataJson} from 'libphonenumber-js/core';
import metadata from './irish-phone-metadata.json';
export const CONNECTION_PHONE_TYPES = ['iphone','android','landline','hosted'] as const;
export const CONNECTION_PROVIDERS = ['Vodafone','Three','eir','Virgin Media','Other / not sure'] as const;
export type PhoneConnection = {
 business_number:string; phone_type:string; provider:string; requested_at:string;
 verified_at:string|null; verified_call_sid:string|null; trial_activated_at:string|null; support_ticket_id:string|null;
};
export type ConnectionNumberDetails={number:string;national:string;lineType:'Mobile'|'Landline'};
export function connectionNumberDetails(raw:string):ConnectionNumberDetails|null {
 if(typeof raw!=='string'||raw.length>64)return null;
 let value=raw.trim().replace(/[\s().\/-]/g,'');
 if(!/^\+?\d+$/.test(value))return null;
 if(value.startsWith('00353'))value=`+${value.slice(2)}`;
 // Irish numbers often get pasted with the optional domestic trunk prefix.
 if(value.startsWith('+3530'))value=`+353${value.slice(5)}`;
 if(value.startsWith('+3530')||value.startsWith('00'))return null;
 if(!value.startsWith('+')&&!value.startsWith('0'))return null;
 const parsed=parsePhoneNumberFromString(value,{defaultCountry:'IE',extract:false},metadata as MetadataJson);
 if(!parsed||parsed.country!=='IE'||!parsed.isValid())return null;
 const type=parsed.getType();
 if(!['MOBILE','FIXED_LINE','FIXED_LINE_OR_MOBILE'].includes(type??''))return null;
 return {number:parsed.number,national:parsed.formatNational(),lineType:type==='MOBILE'?'Mobile':'Landline'};
}
export function normalizeConnectionNumber(raw:string):string|null {return connectionNumberDetails(raw)?.number??null;}
export function connectionNumberIssue(raw:string,phoneType:string,caraNumber:string|null):string|null {
 const details=connectionNumberDetails(raw);
 if(!details)return 'Enter a valid Irish mobile or landline number, including its area code.';
 if(details.number===normalizeConnectionNumber(caraNumber??''))return 'Enter your existing business number, not your Cara number.';
 if(phoneType==='landline'&&details.lineType==='Mobile')return 'This is a mobile number. Choose iPhone or Android, or edit the number.';
 if(['iphone','android'].includes(phoneType)&&details.lineType==='Landline')return 'This is a landline number. Choose Landline or Cloud / PBX, or edit the number.';
 return null;
}
export function isForwardingEvidence(call:{sid:string;to:string;forwardedFrom:string;direction:string;status:string;duration:string;startTime:Date|null},input:{businessNumber:string;caraNumber:string;requestedAt:string}) {
 return /^CA[a-f0-9]{32}$/i.test(call.sid)&&['inbound','trunking-originating'].includes(call.direction)&&call.status==='completed'&&Number(call.duration)>10
  &&normalizeConnectionNumber(call.to)===input.caraNumber&&normalizeConnectionNumber(call.forwardedFrom)===input.businessNumber
  &&input.businessNumber!==input.caraNumber&&Boolean(call.startTime&&call.startTime.getTime()>=Date.parse(input.requestedAt));
}
export function needsProviderAssistance(phoneType:string,provider:string){return phoneType==='hosted'||provider==='Other / not sure'||(phoneType==='landline'&&provider!=='Virgin Media');}
