import {PLANS,type PlanTier} from './cliste-plans.data';
export type SmsPlanPricing={planName:string;includedSms:number;overageCents:number};
export function smsPlanPricing(tier:unknown):SmsPlanPricing|null {
 if(typeof tier!=='string'||!Object.hasOwn(PLANS,tier)||tier==='enterprise')return null;
 const plan=PLANS[tier as PlanTier];
 return {planName:plan.name,includedSms:plan.includedSms,overageCents:plan.smsOverageRateCents};
}
export function smsPricingNotice(pricing:SmsPlanPricing|null|undefined):string {
 if(!pricing)return 'SMS alerts count towards your account’s SMS usage. See Billing for your agreed allowance and extra-SMS rate.';
 const rate=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(pricing.overageCents/100);
 return `${pricing.planName} includes ${pricing.includedSms} SMS per month, shared across your account.\nExtra SMS: ${rate} each.`;
}
