import { notFound } from "next/navigation";
import { SignupOnboardingShell } from "@/components/onboarding/signup-onboarding-shell";
import { BillingSetupPreview } from "./billing-preview";

export const dynamic = "force-dynamic";
export default function LocalBillingSetupPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SignupOnboardingShell><BillingSetupPreview /></SignupOnboardingShell>;
}
