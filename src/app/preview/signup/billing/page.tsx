import { PLANS, type PlanTier } from "@/lib/cliste-plans.data";
import { notFound } from "next/navigation";
import { SignupOnboardingShell } from "@/components/onboarding/signup-onboarding-shell";
import { BillingSetupPreview } from "./billing-preview";

export const dynamic = "force-dynamic";
export default async function LocalBillingSetupPreview({ searchParams }: { searchParams: Promise<{plan?: string}> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { plan } = await searchParams;
  const selected = Object.values(PLANS).find(p => p.tier === plan && p.selfServe)?.tier ?? "pro";
  return <SignupOnboardingShell><BillingSetupPreview planTier={selected as PlanTier} /></SignupOnboardingShell>;
}
