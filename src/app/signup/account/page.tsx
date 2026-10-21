import { redirect } from "next/navigation";
import { requirePublicSignupSession } from "@/lib/public-signup-session";

/** Compatibility for old links: account creation proceeds directly to Hear Cara. */
export default async function SignupAccountPage() {
  await requirePublicSignupSession();
  redirect("/signup/voice");
}
