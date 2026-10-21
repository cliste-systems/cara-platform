import type { Metadata } from "next";
import Link from "next/link";

import { PRODUCT_NAME } from "@/lib/company-details";
import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { SIGNUP_EMAIL_OTP_LENGTH } from "@/lib/signup-email-otp";
import { PUBLIC_ASSETS } from "@/lib/public-assets";

import { VerifyCodeForm } from "./verify-code-form";

export const metadata: Metadata = {
  title: `Confirm your email — ${PRODUCT_NAME}`,
  description: `Enter the verification code to confirm your ${PRODUCT_NAME} account.`,
};

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function SignupCheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const q = await searchParams;
  const email = q.email?.trim() ?? "";

  return (
    <AuthMarketingShell
      title={email ? "Enter your code" : "Check your email"}
      subtitle="Confirm your inbox to continue setting up Cara."
      pageBackground={PUBLIC_ASSETS.signupScenes.signup}
      compact
    >
      <div className="space-y-5 text-center">
        <OnboardingEnter tone="profile">
          <p className="text-[13px] leading-relaxed text-slate-500">
            {email ? (
              <>
                We sent a {SIGNUP_EMAIL_OTP_LENGTH}-digit code to{" "}
                <span className="font-medium text-[#0b1220]">{email}</span>.
                Enter it below, or use the link in the email.
              </>
            ) : (
              <>Open your confirmation email and follow its link to verify your account.</>
            )}
          </p>
        </OnboardingEnter>

        {email ? (
          <OnboardingEnter tone="profile">
            <VerifyCodeForm email={email} />
          </OnboardingEnter>
        ) : null}

        <OnboardingEnter tone="profile" className="text-[12px] text-slate-500">
          Already confirmed?{" "}
          <Link
            href="/authenticate"
            className="font-medium text-[#0b1220] underline underline-offset-2"
          >
            Sign in
          </Link>
        </OnboardingEnter>
      </div>
    </AuthMarketingShell>
  );
}
