import { VoiceForm } from "@/app/(onboarding)/onboarding/voice/voice-form";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
export default function DevVoicePreviewPage() {
  return <OnboardingStepShell variant="profile" title="Hear Cara" description="A warm welcome, personalised for your business."><VoiceForm reviewBeforeContinue={false} allowEditing={false} continueLabel="Continue to plans" businessName="Your business" defaultGreeting="" visualPreview /></OnboardingStepShell>;
}
