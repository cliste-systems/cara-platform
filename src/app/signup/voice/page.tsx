import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { VoiceForm } from "@/app/(onboarding)/onboarding/voice/voice-form";
import { requirePublicSignupSession } from "@/lib/public-signup-session";
export const dynamic="force-dynamic";
export default async function SignupVoicePage() {
  const session=await requirePublicSignupSession();
  const {data:org,error}=await session.supabase.from("organizations").select("name,greeting").eq("id",session.organizationId).single();
  if(error || !org) throw new Error("Your business details could not be loaded.");
  return <OnboardingStepShell variant="profile" title="Hear Cara" description="A warm welcome, personalised for your business."><VoiceForm reviewBeforeContinue={false} allowEditing={false} continueLabel="Continue to plans" businessName={org.name} defaultGreeting={org.greeting?.trim()??""} /></OnboardingStepShell>;
}
