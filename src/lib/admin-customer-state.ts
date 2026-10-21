import { PLANS, type PlanTier } from "./cliste-plans.data";
export function customerPlanLabel(tier: string | null | undefined) {
  return tier && Object.hasOwn(PLANS, tier) ? PLANS[tier as PlanTier].name : "Not selected";
}
export function isTestCustomer(row: { name: string; slug?: string | null }) {
  return /^\[smoke test\]/i.test(row.name) || /^(smoke-test-|rt-test-)/i.test(row.slug ?? "");
}
export function resolveCustomerOwner(members: { user_id: string; role: string }[], inviteUserId?: string | null) {
  const owner = members.find(member => member.role === "owner");
  return owner?.user_id ?? (inviteUserId && members.some(member => member.user_id === inviteUserId) ? inviteUserId : null) ?? members.find(member => member.role === "admin")?.user_id ?? null;
}
export function customerNextAction(row: { isActive: boolean; accountStatus: string; phoneNumber: string | null; planTier: string | null; provisionSource: string; provisioningStage?: string | null }) {
  if (["suspended", "past_due", "unpaid"].includes(row.accountStatus)) return "Review billing";
  if (row.isActive) return "View activity";
  if (row.provisionSource === "managed" && row.provisioningStage === "invited") return "Check invitation";
  if (row.provisionSource === "self_serve" && (!row.planTier || row.accountStatus === "onboarding")) return "Review signup";
  if (!row.phoneNumber) return "Assign phone number";
  return "Review launch checklist";
}

export function customerActionTab(action: string) {
  if (action === "Review billing") return "billing";
  if (action === "View activity") return "activity";
  if (action === "Assign phone number") return "routing";
  if (action === "Check invitation") return "access";
  return "overview";
}
