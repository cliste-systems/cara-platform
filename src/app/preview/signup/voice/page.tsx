import { notFound } from "next/navigation";
import { VoiceForm } from "@/app/(onboarding)/onboarding/voice/voice-form";
import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";

export const dynamic = "force-dynamic";

/** Local visual review using the real UI; no account reads or checkout writes. */
export default function LocalSignupVoicePreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SignupBrandFrame stage="voice" accountEmail="emma@example.ie" title="Hear Cara" description="You can personalise her greeting during setup.">
        <VoiceForm businessName="Your business" defaultGreeting="" allowEditing={false} reviewBeforeContinue={false} continueLabel="Continue to plans" visualPreview />

      </SignupBrandFrame>
    </main>
  );
}
