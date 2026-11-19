"use server";

import {checkSignupPassword} from "@/lib/signup-password-security";

import { headers } from "next/headers";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";

const MIN_PASSWORD_LEN = 8;
const MAX_EMAIL = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function changeSignInPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<AccountActionResult> {
  const session = await requireDashboardAdmin();
  if (session.isLocalPreview) {
    return { ok: false, message: "Not available in dashboard preview." };
  }

  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const actorEmail = session.user.email?.trim().toLowerCase() ?? null;

  const currentPassword = String(payload?.currentPassword ?? "");
  const newPassword = String(payload?.newPassword ?? "");
  const confirmPassword = String(payload?.confirmPassword ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: "All password fields are required." };
  }
  if (newPassword.length < MIN_PASSWORD_LEN || newPassword.length > 128) {
    return {
      ok: false,
      message: `New password must be ${MIN_PASSWORD_LEN}–128 characters.`,
    };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New passwords do not match." };
  }
  if (newPassword === currentPassword) {
    return {
      ok: false,
      message: "New password must be different from your current password.",
    };
  }
  if (!actorEmail) {
    return { ok: false, message: "No sign-in email on this account." };
  }

  const { supabase } = session;

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: actorEmail,
    password: currentPassword,
  });

  if (verifyError) {
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_password_change",
      outcome: "failure",
      actorUserId: session.user.id,
      actorEmail,
      metadata: { reason: "current_password_invalid" },
    });
    return {
      ok: false,
      message: "Current password is incorrect.",
    };
  }

  const passwordCheck=await checkSignupPassword(newPassword);
  if(!passwordCheck.ok)return {ok:false,message:passwordCheck.message};

  const nextMeta = {
    ...(session.user.user_metadata ?? {}),
    needs_password: false,
  };

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    data: nextMeta,
  });

  if (updateError) {
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_password_change",
      outcome: "failure",
      actorUserId: session.user.id,
      actorEmail,
      metadata: { reason: updateError.message },
    });
    return { ok: false, message: updateError.message };
  }

  await logSecurityEvent(securityCtx, {
    eventType: "dashboard_password_change",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail,
  });

  return { ok: true, message: "Password updated. You'll stay signed in." };
}

export async function changeSignInEmail(payload: {
  newEmail: string;
}): Promise<AccountActionResult> {
  const session = await requireDashboardAdmin();
  if (session.isLocalPreview) {
    return { ok: false, message: "Not available in dashboard preview." };
  }

  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const actorEmail = session.user.email?.trim().toLowerCase() ?? null;

  const newEmail = normalizeEmail(String(payload?.newEmail ?? ""));

  if (!newEmail) {
    return { ok: false, message: "New email is required." };
  }
  if (newEmail.length > MAX_EMAIL || !EMAIL_RE.test(newEmail)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (actorEmail && newEmail === actorEmail) {
    return {
      ok: false,
      message: "New email must be different from your current sign-in email.",
    };
  }
  if (!actorEmail) {
    return { ok: false, message: "No sign-in email on this account." };
  }

  const { supabase } = session;

  const { error: updateError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (updateError) {
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_email_change",
      outcome: "failure",
      actorUserId: session.user.id,
      actorEmail,
      targetEmail: newEmail,
      metadata: { reason: updateError.message },
    });
    return { ok: false, message: updateError.message };
  }

  await logSecurityEvent(securityCtx, {
    eventType: "dashboard_email_change",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail,
    targetEmail: newEmail,
    metadata: { pendingConfirmation: true },
  });

  return {
    ok: true,
    message:
      "Confirmation emails sent. Confirm the change from both your current and new email addresses to finish updating your sign-in email.",
  };
}
