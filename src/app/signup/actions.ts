"use server";

import { checkSignupPassword } from "@/lib/signup-password-security";
import { signupDetails, PUBLIC_SIGNUP_FLOW } from "@/lib/public-signup-flow";
import { isPublicSignupEnabled } from "@/lib/public-signup";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { isResendConfigured } from "@/lib/resend-mail";
import { sendSignupConfirmationEmail } from "@/lib/signup-confirmation-email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isPlanTier, type PlanTier } from "@/lib/cliste-plans";
import { isSignupOnboardingDevRelaxed } from "@/lib/onboarding-dev";
import { recordLegalAcceptances } from "@/lib/legal-acceptances";
import { scoreSignupFraud, shouldRouteToReview } from "@/lib/signup-security";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const MIN_SALON_NAME = 2;
const MAX_SALON_NAME = 120;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_COMPACT_RE = /^\+?\d{7,15}$/;

/** Strip spaces and punctuation so "+353 87 123 4567" validates and stores compactly. */
function compactPhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

export type SignupResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string; retryAfterSeconds?: number };

function slugifySalonName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  const seed = base || "business";
  let candidate = seed;
  for (let i = 0; i < 25; i++) {
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error("Signup service unavailable");
    if (!data) return candidate;
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${seed.slice(0, 44)}-${suffix}`;
  }
  return `${seed}-${Date.now().toString(36)}`;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Self-serve signup. Creates an auth user, organisation (`status='onboarding'`),
 * and profile. Production requires Turnstile + email confirmation before onboarding;
 * dev auto-confirms and signs in for local iteration.
 *
 * Rate-limited by IP via the existing auth rate limiter so signup abuse
 * reuses the same throttle surface as login.
 */
export async function startSignup(_: unknown, formData: FormData): Promise<SignupResult> {
  if (!isPublicSignupEnabled()) return { ok: false, message: "Signup is temporarily unavailable." };
  const { businessName: salonName, firstName, lastName, ownerName } = signupDetails(formData);
  const legalCompanyName = String(formData.get("legalCompanyName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = compactPhone(String(formData.get("phone") ?? "").trim());
  const password = String(formData.get("password") ?? "");
  const rawPlan = String(formData.get("planTier") ?? "").trim();
  const rawInterval = String(formData.get("billingInterval") ?? "").trim();
  const planTier: PlanTier | null = isPlanTier(rawPlan) ? rawPlan : null;
  const billingInterval = rawInterval === "year" ? "year" : "month";

  if (!salonName || salonName.length < MIN_SALON_NAME || salonName.length > MAX_SALON_NAME) {
    return { ok: false, message: "Enter your business name." };
  }
  if (legalCompanyName.length < 2 || legalCompanyName.length > 200) return { ok: false, message: "Enter your legal company name, or your legal trading name if not incorporated." };
  if (ownerName.length < 2) {
    return { ok: false, message: "Enter your name." };
  }
  if (ownerName.length > MAX_SALON_NAME) {
    return { ok: false, message: "Name is too long." };
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (phone && !PHONE_COMPACT_RE.test(phone)) {
    return { ok: false, message: "Enter a valid phone number." };
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return {
      ok: false,
      message: `Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`,
    };
  }
  if (formData.get("acceptLegal") !== "on") {
    return {
      ok: false,
      message: "Please accept the terms of service and Data Processing Agreement, and acknowledge the privacy notice.",
    };
  }

  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  if (IS_PRODUCTION && !process.env.TURNSTILE_SECRET_KEY?.trim()) {
    console.error("[signup] TURNSTILE_SECRET_KEY is required in production");
    return {
      ok: false,
      message: "Signup is temporarily unavailable. Please try again later.",
    };
  }
  if (IS_PRODUCTION && !isResendConfigured()) {
    console.error("[signup] Resend is required in production for confirmation email");
    return {
      ok: false,
      message: "Signup is temporarily unavailable. Please try again later.",
    };
  }
  const devRelaxed = isSignupOnboardingDevRelaxed();
  const turnstileEnabled =
    !devRelaxed &&
    (IS_PRODUCTION || Boolean(process.env.TURNSTILE_SECRET_KEY?.trim()));
  if (turnstileEnabled) {
    const turnstileToken = String(formData.get("turnstileToken") ?? "").trim();
    const ts = await verifyTurnstileToken(turnstileToken || null);
    if (!ts.ok) {
      return { ok: false, message: ts.message };
    }
  }

  const ipFp = rateLimitFingerprint(h, "signup-ip");
  if (!devRelaxed) {
    const ipStatus = await recordRateLimitFailure("authenticate", ipFp);
    if (!ipStatus.allowed) {
      return {
        ok: false,
        message: `Too many signups from this network. Try again in ${ipStatus.retryAfterSeconds}s.`,
        retryAfterSeconds: ipStatus.retryAfterSeconds,
      };
    }
  }

  if (IS_PRODUCTION) {
    const passwordCheck = await checkSignupPassword(password);
    if (!passwordCheck.ok) return passwordCheck;
  }

  const ua = h.get("user-agent");
  const forwardedFor = h.get("x-forwarded-for") ?? "";
  const signupIp = forwardedFor.split(",")[0]?.trim() || null;
  const fraud = devRelaxed
    ? { score: 0, reasons: [] as string[] }
    : scoreSignupFraud({ email, salonName, signupIp, userAgent: ua });

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Backend unavailable.",
    };
  }

  const companyCheck = await admin.rpc("company_name_exists", {p_name:legalCompanyName});
  if (companyCheck.error) return {ok:false,message:"The signup service could not check your company details. Please try again shortly."};
  if (companyCheck.data) {
    return {ok:false,message:"An organisation with this legal company name already exists. Sign in to your existing account or contact support for access."};
  }
  const baseSlug = slugifySalonName(salonName);
  let slug: string;
  try {
    slug = await uniqueSlug(admin, baseSlug);
  } catch {
    return { ok: false, message: "The signup service is taking too long to respond. Please try again shortly." };
  }

  const authResponse = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: !IS_PRODUCTION,
    user_metadata: {
      full_name: ownerName,
      first_name: firstName,
      last_name: lastName,
      phone,
      source: "self_signup",
    },
    app_metadata: {
      cliste_signup_source: "self_serve",
      cliste_signup_flow: PUBLIC_SIGNUP_FLOW,
    },
  }).catch(() => null);
  // A timed-out creation may have reached Auth; do not automatically submit it again.
  if (!authResponse) return { ok: false, message: "We couldn’t confirm your account was created. Please try signing in before signing up again." };
  const { data: authData, error: authError } = authResponse;

  if (authError || !authData.user?.id) {
    if (authError?.status === 0 || authError?.name === "AuthRetryableFetchError") {
      return { ok: false, message: "We couldn’t confirm your account was created. Please try signing in before signing up again." };
    }
    const raw = authError?.message?.toLowerCase() ?? "";
    if (raw.includes("already") || raw.includes("duplicate") || raw.includes("exists")) {
        return {
        ok: false,
        message:
          "An account with this email already exists. Log in instead, or use a different email.",
      };
    }
    return {
      ok: false,
      message: authError?.message ?? "Could not create account.",
    };
  }

  const userId = authData.user.id;

  const accountPayload = {
    name: legalCompanyName,
    slug,
    billing_method: "card",
    billing_email: email,
    billing_contact_name: ownerName,
    status: "onboarding" as const,
    launch_status: "not_started" as const,
    billing_period_start: new Date().toISOString().slice(0, 10),
    signup_ip: signupIp,
    signup_user_agent: ua ?? null,
    ...(planTier ? { plan_tier: planTier, billing_interval: billingInterval } : {}),
  };

  const { data: accountRow, error: accountErr } = await admin
    .from("accounts")
    .insert(accountPayload)
    .select("id")
    .single();

  if (accountErr || !accountRow?.id) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return {
      ok: false,
      message: accountErr?.code === "23505" && accountErr.message.includes("company") ? "An organisation with this legal company name already exists. Sign in or contact support for access." : "Could not create your organisation. Please try again.",
    };
  }
  const accountId = accountRow.id;

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert({
      account_id: accountId,
      is_primary_location: true,
      name: salonName,
      slug,
      tier: "native",
      is_active: false,
      status: "onboarding",
      onboarding_step: 1,
      launch_status: "not_started",
      billing_period_start: new Date().toISOString().slice(0, 10),
      signup_ip: signupIp,
      signup_user_agent: ua ?? null,
      niche: "other",
      notification_phone: phone,
      ...(planTier ? { plan_tier: planTier, billing_interval: billingInterval } : {}),
    })
    .select("id")
    .single();

  if (orgErr || !orgRow?.id) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("accounts").delete().eq("id", accountId).then(() => undefined);
    return {
      ok: false,
      message: orgErr?.message ?? "Could not create organisation.",
    };
  }
  const orgId = orgRow.id;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    account_id: accountId,
    organization_id: orgId,
    active_organization_id: orgId,
    role: "admin",
    name: ownerName,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("organizations").delete().eq("id", orgId).then(() => undefined);
    await admin.from("accounts").delete().eq("id", accountId).then(() => undefined);
    return {
      ok: false,
      message: `Profile not created: ${profileErr.message}`,
    };
  }

  const { error: membershipError } = await admin.from("account_memberships").insert({
    user_id: userId,
    account_id: accountId,
    role: "admin",
  });
  if (membershipError) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.from("accounts").delete().eq("id", accountId);
    return { ok: false, message: "Could not create your business access. Please try again." };
  }

  const willReview = devRelaxed ? false : shouldRouteToReview(fraud.score);
  const { error: reviewError } = await admin
    .from("onboarding_applications")
    .insert({
      organization_id: orgId,
      review_status: willReview ? "pending_review" : "auto_approved",
      fraud_score: fraud.score,
      reasons: fraud.reasons,
    });
  if (reviewError) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.from("accounts").delete().eq("id", accountId);
    return { ok: false, message: "We could not complete the security checks. Please try again." };
  }

  try {
    await recordLegalAcceptances(admin, {
      userId,
      organizationId: orgId,
      documents: ["terms", "privacy", "dpa"],
      context: securityCtx,
      agreement: { accountId, organisationName: legalCompanyName, signatoryName: ownerName, signatoryRole: "Account owner", authorityConfirmed: true },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("organizations").delete().eq("id", orgId).then(() => undefined);
    await admin.from("accounts").delete().eq("id", accountId).then(() => undefined);
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not record legal acceptance.",
    };
  }

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/customers", "layout");

  await logSecurityEvent(securityCtx, {
    eventType: "legal_acceptance",
    outcome: "success",
    actorUserId: userId,
    actorEmail: email,
    metadata: {
      documents: ["terms", "privacy", "dpa"],
      organizationId: orgId,
      source: "signup",
    },
  });

  if (IS_PRODUCTION) {
    const sent = await sendSignupConfirmationEmail({
      email,
      password,
      admin,
    });
    if (!sent.ok) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      await admin.from("organizations").delete().eq("id", orgId).then(() => undefined);
      await admin.from("accounts").delete().eq("id", accountId).then(() => undefined);
      return { ok: false, message: sent.message };
    }
    return {
      ok: true,
      redirectTo: `/signup/check-email?email=${encodeURIComponent(email)}`,
    };
  }

  // Dev: auto sign-in so the wizard sees the session immediately.
  try {
    const userClient = await createClient();
    const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error("Automatic sign-in failed");
  } catch {
    return { ok: false, message: "Your account was created, but we couldn’t sign you in. Use the Sign in link below to continue." };
  }

  void cookies;

  return { ok: true, redirectTo: "/signup/voice" };
}
