import { SignupOnboardingShell } from "@/components/onboarding/signup-onboarding-shell";
export default function SignupBillingLayout({children}: {children: React.ReactNode}) {
  return <SignupOnboardingShell>{children}</SignupOnboardingShell>;
}
