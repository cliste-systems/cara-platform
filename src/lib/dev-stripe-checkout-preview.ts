import "server-only";

import { PUBLIC_SIGNUP_FLOW } from "@/lib/public-signup-flow";
import { isPlanTier } from "@/lib/cliste-plans";
import { resolveCheckoutReturnOrigin } from "@/lib/platform-billing-checkout";
import type { PlatformElementsCheckoutSummary } from "@/lib/platform-billing-elements";
import { createPlatformElementsCheckout } from "@/lib/platform-billing-elements";
import { isDevOnboardingPreviewEnabled } from "@/lib/onboarding-dev";

export type DevElementsCheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      subscriptionId: string;
      returnUrl: string;
      summary: PlatformElementsCheckoutSummary;
    }
  | { ok: false; message: string };

export async function prepareDevElementsCheckoutPreview(selection: {plan?:string;setup?:string} = {}): Promise<DevElementsCheckoutResult> {
  if (!isDevOnboardingPreviewEnabled()) {
    return { ok: false, message: "Dev preview is not enabled." };
  }

  return prepareTestElementsCheckout(selection);
}

/** Staff-only test checkout; never touches the customer’s real subscription. */
export async function prepareAdminElementsCheckoutPreview(selection: {plan?:string;setup?:string} = {}): Promise<DevElementsCheckoutResult> {
  const {requireAdminPermission}=await import("@/lib/admin-session");
  await requireAdminPermission("customers");
  return prepareTestElementsCheckout(selection);
}

async function prepareTestElementsCheckout(selection: {plan?:string;setup?:string}): Promise<DevElementsCheckoutResult> {
  if (!/^[sr]k_test_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "")) {
    return { ok: false, message: "Checkout previews require Stripe test-mode credentials." };
  }

  const origin = await resolveCheckoutReturnOrigin();
  const result = await createPlatformElementsCheckout({
    planTier: isPlanTier(selection.plan) && selection.plan !== "enterprise" ? selection.plan : "pro",
    launchTier: selection.setup === "remote" ? "remote" : selection.setup === "onsite_dublin" ? "onsite_dublin" : "diy",
    interval: "month",
    userEmail: "dev-preview@cliste.local",
    devPreview: true,
    signupFlow: PUBLIC_SIGNUP_FLOW,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    clientSecret: result.clientSecret,
    subscriptionId: result.subscriptionId,
    returnUrl: `${origin}/dev/onboarding/plan?status=preview`,
    summary: result.summary,
  };
}
