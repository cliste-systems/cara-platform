"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";

export function CheckoutRetry({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="space-y-4">
    <AuthFormAlert title="We couldn’t prepare billing" message={message}/>
    <OnboardingPrimaryButton className="w-full" pending={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Trying again…" : "Try again"}
    </OnboardingPrimaryButton>
  </div>;
}
