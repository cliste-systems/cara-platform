import {callerSmsEligibility} from './caller-line-sms';

export type OutsideHoursPolicy = {
 version: 2;
 availability: 'closed' | 'urgent_only' | 'normal';
 sms: 'off' | 'urgent' | 'all_messages';
 phone: string;
};
export const DEFAULT_OUTSIDE_HOURS: OutsideHoursPolicy={version:2,availability:'closed',sms:'off',phone:''};
export function normalizeAlertMobile(raw: string): string | null {
 const clean=raw.trim().replace(/[\s()-]/g,'').replace(/^00/,'+');
 if(!/^(?:\+[1-9]\d{7,14}|08\d{8})$/.test(clean))return null;
 const result=callerSmsEligibility(clean);
 return result.canText?result.e164:null;
}
export function parseOutsideHoursPolicy(raw:unknown):OutsideHoursPolicy {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {...DEFAULT_OUTSIDE_HOURS};
 const value=raw as Record<string,unknown>;
 // Previous free-text instructions are deliberately not interpreted as settings.
 if(value.version!==2)return {...DEFAULT_OUTSIDE_HOURS};
 const availability=['closed','urgent_only','normal'].includes(String(value.availability))?value.availability as OutsideHoursPolicy['availability']:'closed';
 const phone=normalizeAlertMobile(String(value.phone??''))??'';
 const sms=phone&&['urgent','all_messages'].includes(String(value.sms))?value.sms as OutsideHoursPolicy['sms']:'off';
 return {version:2,availability,sms,phone:sms==='off'?'':phone};
}
export function outsideHoursPrompt(policy:OutsideHoursPolicy):string {
 const availability={closed:'The business does not offer service outside its usual opening hours. Take a message for review when it reopens.',urgent_only:'Outside usual opening hours, the business accepts urgent enquiries only. Record other messages for the next working period.',normal:'The business accepts enquiries outside its usual opening hours. This does not mean attendance or an immediate response is guaranteed.'}[policy.availability];
 return `${availability} Collect the caller’s message and callback details when follow-up is needed. Recognise urgent enquiries from the actual situation; do not treat every call as urgent. Never promise attendance, a response time or a transfer unless the configured tools confirm it. SMS preferences are private server-side settings: do not disclose recipient numbers or claim an alert has been sent.`;
}
export function classifyCallUrgency(summary:string,transcript:string):boolean {
 // Use caller speech when role-labelled; assistant suggestions must not trigger alerts.
 const lines=transcript.split('\n');
 const callerLines=lines.filter(line=>/^\s*(?:caller|user|customer)\s*:/i.test(line));
 const text=callerLines.length?callerLines.join('\n'):summary;
 const clauses=text.toLowerCase().split(/[.!?\n;]/).filter(clause=>!(/\b(?:not|isn.t|is not|no|non)[ -]?(?:an? )?(?:urgent|emergency)\b/.test(clause)));
 return clauses.some(clause=>/\b(?:urgent|emergency|asap|immediately|burst pipe|pipe (?:has )?burst|flooding|gas leak|smell (?:of )?gas|sparking|exposed live wires|locked out|immediate danger)\b/.test(clause));
}
export function callHasMessage(outcome:string,summary:string,urgent:boolean):boolean {
 return urgent||['callback_requested','action_created'].includes(outcome)||/\b(?:take[n]? a message|left a message|call ?back|follow[ -]?up|contact (?:me|them|the caller)|return (?:the|my) call)\b/i.test(summary);
}
