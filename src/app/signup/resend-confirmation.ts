"use server";

import { headers } from "next/headers";

import { isSignupOnboardingDevRelaxed } from "@/lib/onboarding-dev";
import {
  emailRateLimitFingerprint,
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { sendSignupConfirmationEmail } from "@/lib/signup-confirmation-email";

export type ResendConfirmationResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function resendSignupConfirmationEmail(
  emailRaw: string,
): Promise<ResendConfirmationResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const h = await headers();
  const fingerprints = [
    rateLimitFingerprint(h, "signup-resend"),
    emailRateLimitFingerprint(email, "signup-resend-email"),
  ];
  if (!isSignupOnboardingDevRelaxed()) {
    const statuses = await Promise.all(fingerprints.map((fp) => getRateLimitStatus("authenticate", fp)));
    const status = statuses.find((entry) => !entry.allowed);
    if (status) {
      return {
        ok: false,
        message: `Please wait ${status.retryAfterSeconds}s before requesting another email.`,
        retryAfterSeconds: status.retryAfterSeconds,
      };
    }
  }

  // Count every send attempt, including successful sends and unknown accounts.
  // Reserve before calling the email provider, and fail closed if storage is unavailable.
  if (!isSignupOnboardingDevRelaxed()) {
    const reserved = await Promise.all(fingerprints.map((fp) => recordRateLimitFailure("authenticate", fp)));
    const denied = reserved.find((entry) => !entry.allowed);
    if (denied) return {
      ok: false,
      message: `Please wait ${denied.retryAfterSeconds}s before requesting another email.`,
      retryAfterSeconds: denied.retryAfterSeconds,
    };
  }
  const sent = await sendSignupConfirmationEmail({ email });
  if (!sent.ok) {
    const lower = sent.message.toLowerCase();
    if (
      lower.includes("user not found") ||
      lower.includes("not found") ||
      lower.includes("no user")
    ) {
      return { ok: true };
    }
    return sent;
  }

  return { ok: true };
}
