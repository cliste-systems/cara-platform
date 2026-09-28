"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  ONBOARDING_STEPS,
  requireOnboardingAdminSession,
} from "@/lib/onboarding-session";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

import {
  callRoutingAllowsHumanTransfer,
  isCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";

export type SaveOnboardingNumberInput = {
  mode: CallRoutingMode;
  transferPhone?: string;
};

export type RetryNumberProvisionResult =
  | { ok: true; phoneNumber: string }
  | { ok: false; message: string };

export async function retryNumberProvision(): Promise<RetryNumberProvisionResult> {
  const session = await requireOnboardingAdminSession();
  const result = await provisionOrganizationPhoneNumber(session.organizationId);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/onboarding/number");
  return { ok: true, phoneNumber: result.e164 };
}

export async function saveOnboardingNumber(
  input: SaveOnboardingNumberInput,
): Promise<{ ok: false; message: string } | never> {
  const session = await requireOnboardingAdminSession();

  if (!isCallRoutingMode(input.mode)) {
    return { ok: false, message: "Pick how calls should reach Cara." };
  }

  const allowsTransfer = callRoutingAllowsHumanTransfer(input.mode);
  const transfer = allowsTransfer ? (input.transferPhone?.trim() ?? "") : "";

  const admin = createAdminClient();

  const update: Record<string, unknown> = {
    call_routing_mode: input.mode,
    fallback_number: transfer || null,
    onboarding_step: ONBOARDING_STEPS.goLive,
    updated_at: new Date().toISOString(),
  };
  if (transfer) update.notification_phone = transfer;

  const { error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  // Final onboarding compile after routing mode — train-cara should have run first.
  await regenerateCaraCustomPrompt(admin, session.organizationId);

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/routing");
  redirect("/onboarding/plan");
}
