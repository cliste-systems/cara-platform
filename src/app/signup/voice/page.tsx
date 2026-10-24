import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";
import { VoiceForm } from "@/app/(onboarding)/onboarding/voice/voice-form";
import { requirePublicSignupSession } from "@/lib/public-signup-session";
export const dynamic="force-dynamic";
export default async function SignupVoicePage() {
  const session=await requirePublicSignupSession();
  const {data:org,error}=await session.supabase.from("organizations").select("name,greeting").eq("id",session.organizationId).single();
  if(error || !org) throw new Error("Your business details could not be loaded.");
  return <SignupBrandFrame stage="voice" accountEmail={session.user.email} title="Hear Cara" description="You can personalise her greeting during setup."><VoiceForm reviewBeforeContinue={false} allowEditing={false} continueLabel="Continue to plans" businessName={org.name} defaultGreeting={org.greeting?.trim()??""} /></SignupBrandFrame>;
}
