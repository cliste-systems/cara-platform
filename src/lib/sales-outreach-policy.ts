/** Provider-independent gate for a future sales sender. Recheck immediately before send. */
export type OutreachGateInput = {
  contactAddress: string;
  sourceUrl: string;
  businessRelevant: boolean;
  permissionReviewed: boolean;
  campaignApproved: boolean;
  provider: 'resend' | 'permitted-sales-provider';
  coldOutreach: boolean;
  optedOut: boolean;
  hardBounced: boolean;
  existingCustomer: boolean;
  replied: boolean;
  meetingBooked: boolean;
  alreadySent: boolean;
  dailySent: number;
  dailyLimit: number;
};

export function evaluateOutreachSend(input: OutreachGateInput): { allowed: boolean; reason: string } {
  if (input.optedOut || input.hardBounced) return {allowed:false,reason:'suppressed'};
  if (input.existingCustomer) return {allowed:false,reason:'existing_customer'};
  if (input.replied || input.meetingBooked) return {allowed:false,reason:'sequence_paused'};
  if (input.alreadySent) return {allowed:false,reason:'duplicate_send'};
  if (input.provider === 'resend' && input.coldOutreach) return {allowed:false,reason:'provider_prohibits_cold_outreach'};
  if (!input.permissionReviewed || !input.businessRelevant || !input.campaignApproved) return {allowed:false,reason:'review_required'};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactAddress.trim())) return {allowed:false,reason:'invalid_contact'};
  try { if (new URL(input.sourceUrl).protocol !== 'https:') return {allowed:false,reason:'invalid_source'}; }
  catch { return {allowed:false,reason:'invalid_source'}; }
  if (!Number.isSafeInteger(input.dailyLimit) || input.dailyLimit <= 0 || !Number.isSafeInteger(input.dailySent) || input.dailySent < 0 || input.dailySent >= input.dailyLimit) return {allowed:false,reason:'daily_limit'};
  return {allowed:true,reason:'eligible'};
}
