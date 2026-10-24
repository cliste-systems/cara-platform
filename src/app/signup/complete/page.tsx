import { requirePublicSignupSession } from "@/lib/public-signup-session";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";
import { SignupConfirmation } from "@/components/onboarding/signup-confirmation";
import { ArrowRight } from "lucide-react";
import { completePublicCheckout, persistPublicCheckout } from "../plan/actions";
export const dynamic = "force-dynamic";
export default async function SignupCompletePage({searchParams}: {searchParams: Promise<{session_id?:string;subscription_id?:string;setup_intent?:string}>}) {
  const session = await requirePublicSignupSession();
  const {session_id:id,subscription_id,setup_intent}=await searchParams;
  const retryParams = new URLSearchParams();
  if (id) retryParams.set("session_id", id);
  if (subscription_id) retryParams.set("subscription_id", subscription_id);
  if (setup_intent) retryParams.set("setup_intent", setup_intent);
  const retryHref = retryParams.size ? `/signup/complete?${retryParams}` : "/signup/plan";
  let completed=false;
  if(id) { try { await completePublicCheckout(id); completed=true; } catch (error) { console.error("[signup] checkout completion failed", error instanceof Error ? error.message : "Unknown completion error"); } }
  if(subscription_id && setup_intent) { try { await persistPublicCheckout(subscription_id,setup_intent); completed=true; } catch (error) { console.error("[signup] payment return failed",error instanceof Error ? error.message : "Unknown return error"); } }
  if(completed) {
    const { data: account } = await session.supabase.from("accounts").select("launch_tier").eq("id", session.accountId).single();
    if (account?.launch_tier === "diy") return <SignupConfirmation />;
    redirect("/dashboard?welcome=1");
  }
  return <SignupBrandFrame stage="billing" title="We’re confirming your payment setup" description="Your account is saved. If you’ve completed checkout, try again in a moment."><Link href={retryHref} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0b1220] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#182233]">Check again<ArrowRight size={16} aria-hidden/></Link></SignupBrandFrame>;
}
