import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { SignupBillingCheckout } from "@/components/billing/signup-billing-checkout";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { preparePublicCheckout, persistPublicCheckout, updatePublicCheckoutSetup } from "../actions";
export const dynamic="force-dynamic";
export default async function SignupCheckoutPage() {
  const result=await preparePublicCheckout();
  if(!result.ok) return <OnboardingStepShell variant="checkout" centered title="Set up billing"><AuthFormAlert message={result.message}/></OnboardingStepShell>;
  return <SignupBillingCheckout initialCheckout={result} onSetupChange={updatePublicCheckoutSetup} onPersist={persistPublicCheckout} />;
}
