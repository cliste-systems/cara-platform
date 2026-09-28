import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { normalizeOnboardingDbStep } from "@/components/onboarding/onboarding-steps";
import { enforceOnboardingStepOrder } from "@/lib/onboarding-dev";
import { hasAccountOwnerAccess } from "./account-owner-access";
import { redirectIfEmailUnconfirmed } from "@/lib/require-email-confirmed";
import { createClient } from "@/utils/supabase/server";

/**
 * Bump organisations.onboarding_step when a step completes.
 *
 * Payment is deferred to the end. The wizard runs:
 * profile -> voice -> knowledge -> number ->
 * go live (plan + pay) -> dashboard.
 */
export const ONBOARDING_STEPS = {
  profile: 1,
  voice: 2,
  knowledge: 3,
  number: 4,
  goLive: 5,
  done: 6,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;

export type OnboardingSession = {
  user: User;
  organizationId: string;
  role: string | null;
  accountId: string;
  status: string;
  onboardingStep: number;
  planTier: string;
  launchTier: string | null;
  billingInterval: "month" | "year";
  launchStatus: string;
  phoneNumber: string | null;
  platformSubscriptionId: string | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  applicationFeeBps: number;
};

export async function requireOnboardingSession(): Promise<OnboardingSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/authenticate?next=/onboarding");
  }
  redirectIfEmailUnconfirmed(user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, active_organization_id, account_id, role")
    .eq("id", user.id)
    .maybeSingle();

  const organizationId =
    profile?.active_organization_id ?? profile?.organization_id ?? null;
  if (!profile?.account_id || !organizationId) {
    redirect("/authenticate?error=no_org");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, status, onboarding_step, phone_number, stripe_account_id, stripe_charges_enabled, account_id",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (!org) {
    redirect("/authenticate?error=no_org");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "status, plan_tier, launch_tier, launch_status, platform_subscription_id, application_fee_bps, billing_interval",
    )
    .eq("id", profile.account_id)
    .maybeSingle();

  const lifecycleStatus =
    (account?.status as string | undefined) ??
    (org.status as string | undefined) ??
    "onboarding";

  if (lifecycleStatus === "active" && enforceOnboardingStepOrder()) {
    redirect("/dashboard");
  }
  if (lifecycleStatus === "suspended") {
    redirect("/dashboard/billing?suspended=1");
  }

  return {
    user: user!,
    organizationId: org.id as string,
    role: (profile.role as string | null) ?? null,
    accountId: profile.account_id as string,
    status: lifecycleStatus,
    onboardingStep: normalizeOnboardingDbStep(
      (org.onboarding_step as number) ?? 1,
    ),
    planTier: (account?.plan_tier as string) ?? "pro",
    launchTier: (account?.launch_tier as string | null) ?? null,
    billingInterval: account?.billing_interval === "year" ? "year" : "month",
    launchStatus: (account?.launch_status as string) ?? "not_started",
    phoneNumber: (org.phone_number as string | null) ?? null,
    platformSubscriptionId:
      (account?.platform_subscription_id as string | null) ?? null,
    stripeAccountId: (org.stripe_account_id as string | null) ?? null,
    stripeChargesEnabled: Boolean(org.stripe_charges_enabled),
    applicationFeeBps: (account?.application_fee_bps as number | null) ?? 100,
  };
}

export async function requireOnboardingAdminSession(): Promise<OnboardingSession> {
  const session = await requireOnboardingSession();
  if (!(await hasAccountOwnerAccess(await createClient(), {
    userId: session.user.id, accountId: session.accountId, profileRole: session.role,
  }))) redirect("/dashboard");
  return session;
}

export function resolveCurrentStepPath(session: OnboardingSession): string {
  // Payment deferred: profile -> voice -> knowledge -> number ->
  // go live (plan) -> dashboard.
  if (session.onboardingStep <= ONBOARDING_STEPS.profile) return "/onboarding/profile";
  if (session.onboardingStep <= ONBOARDING_STEPS.voice) return "/onboarding/voice";
  if (session.onboardingStep <= ONBOARDING_STEPS.knowledge) return "/onboarding/knowledge";
  if (session.onboardingStep <= ONBOARDING_STEPS.number) return "/onboarding/number";
  if (session.onboardingStep < ONBOARDING_STEPS.done) return "/onboarding/plan";
  return "/dashboard";
}
