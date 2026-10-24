import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { isResendConfigured, sendTransactionalEmail } from "@/lib/resend-mail";
import { SIGNUP_EMAIL_OTP_PATTERN } from "@/lib/signup-email-otp";
import { PRODUCT_NAME } from "@/lib/company-details";
import { createAdminClient } from "@/utils/supabase/admin";

export function signupConfirmationRedirectOrigin(): string {
  return resolveAppSiteOrigin().origin;
}

export function signupConfirmationLogoUrl(): string {
  return `${signupConfirmationRedirectOrigin()}${PUBLIC_ASSETS.logo}`;
}

export function buildSignupConfirmationEmailBodies(
  actionLink: string,
  emailOtp?: string,
): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = emailOtp
    ? `${emailOtp} is your ${PRODUCT_NAME} verification code`
    : `Confirm your ${PRODUCT_NAME} account`;
  const text = [
    `Thanks for signing up for ${PRODUCT_NAME}.`,
    "",
    ...(emailOtp
      ? [`Your verification code: ${emailOtp}`, "", "Or confirm via this link:"]
      : ["Confirm your email to continue setting up Cara:"]),
    actionLink,
    "",
    "This code and link expire after a while. If you did not create this account, you can ignore this email.",
  ].join("\n");

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const codeBlock = emailOtp ? `<div style="margin:24px 0;padding:20px 12px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:12px;color:#292929;font-size:30px;font-weight:600;letter-spacing:6px;text-align:center;"><span>${escapeHtml(emailOtp)}</span></div>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><title>Confirm your email — HelloCara</title>
<style>a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}</style></head>
<body style="margin:0;background:#f5f5f5;color:#292929;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;"><tr><td style="padding:32px 24px;">
<p style="margin:0 0 32px;font-size:20px;font-weight:700;letter-spacing:-.7px;">HelloCara<span style="color:#999;">.</span></p>
<h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;letter-spacing:-.8px;">You’re nearly in.</h1>
<p style="margin:0;color:#737373;font-size:15px;line-height:1.6;">${emailOtp ? "Enter this code to confirm your email." : "Confirm your email to get started."}</p>
${codeBlock}
<p style="margin:24px 0 12px;font-size:13px;color:#737373;">${emailOtp ? "Or continue with one click:" : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#292929" style="border-radius:28px;"><a href="${escapeHtml(actionLink)}" style="display:block;padding:15px 20px;border-radius:28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Confirm email &amp; continue →</a></td></tr></table>
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #ededed;font-size:12px;line-height:1.6;color:#737373;">Didn’t sign up for HelloCara? You can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, text, html };
}

type SendSignupConfirmationInput = {
  email: string;
  /** Required on first signup; optional when resending to an existing account. */
  password?: string;
  admin?: SupabaseClient;
};

export async function sendSignupConfirmationEmail(
  input: SendSignupConfirmationInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      message: "Email is not configured yet. Please try again later.",
    };
  }

  const email = input.email.trim().toLowerCase();
  const redirectTo = `${signupConfirmationRedirectOrigin()}/auth/callback`;

  let admin = input.admin;
  try {
    admin ??= createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Backend unavailable.",
    };
  }

  const linkType = input.password ? "signup" : "magiclink";
  const { data: linkData, error: linkError } = input.password
    ? await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password: input.password,
        options: { redirectTo },
      })
    : await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
  if (linkError) {
    return {
      ok: false,
      message:
        linkError.message ??
        "Could not create a confirmation link. Check Supabase Auth redirect URLs.",
    };
  }

  // Build a clean first-party link straight to our callback page, which
  // verifies via token_hash + type. This avoids the long Supabase
  // /auth/v1/verify action link bouncing through a third-party domain.
  const hashedToken = linkData?.properties?.hashed_token?.trim();
  const fallbackActionLink = linkData?.properties?.action_link?.trim();
  const actionLink = hashedToken
    ? `${redirectTo}?token_hash=${encodeURIComponent(hashedToken)}&type=${linkType}`
    : fallbackActionLink;
  if (!actionLink) {
    return {
      ok: false,
      message:
        "Could not create a confirmation link. Check Supabase Auth redirect URLs.",
    };
  }

  const emailOtp = linkData?.properties?.email_otp?.trim();
  if (!emailOtp || !SIGNUP_EMAIL_OTP_PATTERN.test(emailOtp)) {
    return {
      ok: false,
      message: "Could not create a verification code. Please try again.",
    };
  }

  const bodies = buildSignupConfirmationEmailBodies(actionLink, emailOtp);
  return sendTransactionalEmail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
}
