"use server";

import { cookies, headers } from "next/headers";

import {
  clearRateLimit,
  emailRateLimitFingerprint,
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { SUPPORT_DASHBOARD_COOKIE } from "@/lib/support-dashboard-cookie";
import { createClient } from "@/utils/supabase/server";

export type PasswordSignInResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      requiresCaptcha: boolean;
      retryAfterSeconds?: number;
    };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Server-side log shim. We deliberately never write the full email to
 * logs because login logs are kept long-term for incident review and
 * include both successful + failed addresses — a leaked log file would
 * otherwise enumerate every customer's account. The DB security event
 * (`logSecurityEvent`) still stores the full email behind RLS for
 * support purposes; only the console log is masked.
 */
function maskEmailForLog(raw: string | null | undefined): string {
  const e = (raw ?? "").trim();
  if (!e) return "";
  const at = e.indexOf("@");
  if (at <= 0) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

function genericAuthFailureMessage(retryAfterSeconds?: number): string {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return `For your security, sign-in is paused for ${retryAfterSeconds} seconds. Then try again.`;
  }
  return "We couldn't sign you in with those details. Check your email and password, then try again.";
}

export async function passwordSignIn(payload: {
  email: string;
  password: string;
  turnstileToken?: string | null;
}): Promise<PasswordSignInResult> {
  const email = normalizeEmail(String(payload.email ?? ""));
  const password = String(payload.password ?? "");
  if (!email || !password) {
    return {
      ok: false,
      message: "Email and password are required.",
      requiresCaptcha: false,
    };
  }

  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const turnstileEnabled = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
  const ipFingerprint = rateLimitFingerprint(h, "auth-ip");
  const emailFingerprint = emailRateLimitFingerprint(email);
  const ipStatus = await getRateLimitStatus("authenticate", ipFingerprint);
  const emailStatus = await getRateLimitStatus("authenticate", emailFingerprint);
  const preRequiresCaptcha =
    ipStatus.requiresCaptcha || emailStatus.requiresCaptcha;

  if (!ipStatus.allowed || !emailStatus.allowed) {
    const retryAfterSeconds = Math.max(
      ipStatus.retryAfterSeconds,
      emailStatus.retryAfterSeconds
    );
    console.warn("[security] auth_rate_limited", {
      email,
      retryAfterSeconds,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "auth_password_sign_in",
      outcome: "rate_limited",
      loginEmail: email,
      attemptCount: Math.max(
        ipStatus.failuresInWindow,
        emailStatus.failuresInWindow
      ),
      metadata: { retryAfterSeconds },
    });
    return {
      ok: false,
      message: genericAuthFailureMessage(retryAfterSeconds),
      requiresCaptcha: turnstileEnabled,
      retryAfterSeconds,
    };
  }

  if (preRequiresCaptcha && turnstileEnabled) {
    const ts = await verifyTurnstileToken(payload.turnstileToken);
    if (!ts.ok) {
      await logSecurityEvent(securityCtx, {
        eventType: "auth_password_sign_in",
        outcome: "failure",
        loginEmail: email,
        metadata: { reason: "turnstile_failed" },
      });
      return {
        ok: false,
        message: ts.message,
        requiresCaptcha: true,
      };
    }
  }

  const supabase = await createClient({ userAgent: securityCtx.userAgent });
  const { error: signError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signError) {
    const afterIp = await recordRateLimitFailure("authenticate", ipFingerprint);
    const afterEmail = await recordRateLimitFailure("authenticate", emailFingerprint);
    const retryAfterSeconds = Math.max(
      afterIp.retryAfterSeconds,
      afterEmail.retryAfterSeconds
    );
    const requiresCaptcha =
      turnstileEnabled &&
      (afterIp.requiresCaptcha || afterEmail.requiresCaptcha);
    console.warn("[security] auth_sign_in_failed", {
      email: maskEmailForLog(email),
      reason: signError.message,
      retryAfterSeconds,
      requiresCaptcha,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "auth_password_sign_in",
      outcome: requiresCaptcha ? "rate_limited" : "failure",
      loginEmail: email,
      attemptCount: Math.max(
        afterIp.failuresInWindow,
        afterEmail.failuresInWindow
      ),
      metadata: {
        retryAfterSeconds,
        requiresCaptcha,
        reason: signError.message,
      },
    });
    const unconfirmed = /email not confirmed/i.test(signError.message);
    return {
      ok: false,
      message: unconfirmed
        ? "Confirm your email first — check your inbox for the link we sent when you signed up."
        : genericAuthFailureMessage(retryAfterSeconds),
      requiresCaptcha,
      retryAfterSeconds: retryAfterSeconds || undefined,
    };
  }

  await clearRateLimit("authenticate", ipFingerprint);
  await clearRateLimit("authenticate", emailFingerprint);
  (await cookies()).delete(SUPPORT_DASHBOARD_COOKIE);
  console.info("[security] auth_sign_in_success", { email: maskEmailForLog(email) });
  await logSecurityEvent(securityCtx, {
    eventType: "auth_password_sign_in",
    outcome: "success",
    loginEmail: email,
  });
  return { ok: true };
}
