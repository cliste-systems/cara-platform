"use server";

import { headers } from "next/headers";

import { isSignupOnboardingDevRelaxed } from "@/lib/onboarding-dev";
import {
  getRateLimitStatus,
  hashRateLimitIdentifier,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import {
  SIGNUP_EMAIL_OTP_LENGTH,
  SIGNUP_EMAIL_OTP_PATTERN,
} from "@/lib/signup-email-otp";
import { createClient } from "@/utils/supabase/server";

export type VerifySignupCodeResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Verifies the Supabase email OTP from the signup confirmation email and
 * signs the user in (cookies set via the server client). Rate-limited independently per
 * IP and email.
 */
export async function verifySignupCode(
  emailRaw: string,
  codeRaw: string,
): Promise<VerifySignupCodeResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const code = String(codeRaw ?? "").replace(/\s/g, "");
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!SIGNUP_EMAIL_OTP_PATTERN.test(code)) {
    return {
      ok: false,
      message: `Enter the ${SIGNUP_EMAIL_OTP_LENGTH}-digit code from the email.`,
    };
  }

  const h = await headers();
  const fpOrigin = rateLimitFingerprint(h, "signup-verify");
  const fpEmail = hashRateLimitIdentifier(`signup-verify-email:${email}`);
  if (!isSignupOnboardingDevRelaxed()) {
    for (const fp of [fpOrigin, fpEmail]) {
      const status = await getRateLimitStatus("authenticate", fp);
      if (!status.allowed) {
        return {
          ok: false,
          message: `Too many attempts. Try again in ${status.retryAfterSeconds}s.`,
          retryAfterSeconds: status.retryAfterSeconds,
        };
      }
    }
  }

  const supabase = await createClient();

  // First signup emails carry a "signup" token; resent emails carry
  // "magiclink". A wrong-type lookup fails without consuming the token.
  for (const type of ["signup", "magiclink"] as const) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (!error) {
      return { ok: true };
    }
  }

  await recordRateLimitFailure("authenticate", fpOrigin);
  await recordRateLimitFailure("authenticate", fpEmail);
  return {
    ok: false,
    message:
      "That code is invalid or has expired. Double-check the latest email, or resend a new code.",
  };
}
