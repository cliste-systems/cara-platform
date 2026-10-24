"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";

import {
  OnboardingFieldBox,
  OnboardingFieldSurfaceProvider,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { ONBOARDING_FIELD_INPUT } from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

import {
  SIGNUP_EMAIL_OTP_INPUT_MAX,
  SIGNUP_EMAIL_OTP_LENGTH,
} from "@/lib/signup-email-otp";

import { resendSignupConfirmationEmail } from "../resend-confirmation";
import { verifySignupCode } from "../verify-code";

export function VerifyCodeForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleVerify() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await verifySignupCode(email, code);
      if (result.ok) {
        router.replace("/auth/post-login");
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  function handleResend() {
    setError(null);
    setNotice(null);
    startResendTransition(async () => {
      const result = await resendSignupConfirmationEmail(email);
      if (result.ok) {
        setCode("");
        setNotice("New code sent. Check your inbox.");
        return;
      }
      setError(result.message);
    });
  }

  return (
    <OnboardingFieldSurfaceProvider surface="default">
      <div className="space-y-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleVerify();
          }}
        >
          <OnboardingFieldBox
            label="Verification code"
            htmlFor="verification-code"
            error={error ?? undefined}
            className="border border-[#dedede] bg-white px-4 py-4 shadow-none"
          >
            <input
              id="verification-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
            maxLength={SIGNUP_EMAIL_OTP_INPUT_MAX}
            placeholder={"0".repeat(SIGNUP_EMAIL_OTP_LENGTH)}
            value={code}
            onChange={(event) => {
              setCode(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, SIGNUP_EMAIL_OTP_INPUT_MAX),
              );
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            className={cn(
              ONBOARDING_FIELD_INPUT,
              "text-center font-mono text-[15px] font-semibold tracking-[0.22em] sm:text-[17px] sm:tracking-[0.26em]",
            )}
            />
          </OnboardingFieldBox>


          {notice ? (
            <p className="text-[12px] leading-relaxed text-[#555555]">
              {notice}
            </p>
          ) : null}

          <OnboardingPrimaryButton
            type="submit"
            pending={pending}
            disabled={code.length !== SIGNUP_EMAIL_OTP_LENGTH || resendPending}
            className="w-full max-w-none"
          >
            {pending ? "Verifying…" : "Verify and continue"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </OnboardingPrimaryButton>
        </form>

        <div className="pt-3 text-center text-[13px] text-[#737373]">
          No email? Check spam or{" "}
          <button type="button" onClick={handleResend} disabled={resendPending || pending}
            className="cursor-pointer font-medium text-[#292929] underline underline-offset-4 transition-opacity hover:opacity-70 disabled:opacity-50">
            {resendPending ? "sending…" : "resend code"}
          </button>
        </div>
      </div>
    </OnboardingFieldSurfaceProvider>
  );
}
