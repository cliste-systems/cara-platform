"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CLISTE_COMPANY } from "@/lib/company-details";
import { resolveAccountIdFromBillingMetadata } from "@/lib/account-billing";
import {
  activatePlatformSubscriptionGoLive,
  createPlatformSubscriptionCheckout,
  persistOrgBillingSelection,
  persistPlatformCheckoutSession,
  resolveCheckoutReturnOrigin,
} from "@/lib/platform-billing-checkout";
import {
  assertElementsSubscriptionReady,
  assertPlatformSubscriptionOwnership,
  assertSetupIntentMatchesSubscription,
  assertSetupIntentSucceeded,
  createPlatformElementsCheckout,
  persistPlatformElementsSubscription,
} from "@/lib/platform-billing-elements";
import { resolveAccountIdForOrganization } from "@/lib/account-access";
import {
  isPlanTier,
  PLANS,
  planSupportsSelfServeCheckout,
  type PlanTier,
} from "@/lib/cliste-plans";
import { getStripeClient } from "@/lib/stripe";

/** Stripe plan checkout — off until billing is ready. Set `CLISTE_PLAN_CHECKOUT_ENABLED=true` to enable. */
const PLAN_CHECKOUT_ENABLED =
  process.env.CLISTE_PLAN_CHECKOUT_ENABLED === "true";
const PLAN_CHECKOUT_DEV_SKIP_ALLOWED =
  process.env.NODE_ENV !== "production" && !PLAN_CHECKOUT_ENABLED;
import { cleanAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { verticalPackForNiche } from "@/lib/verticals";
import { classifyBusinessDescription } from "@/lib/classify-business-description";
import {
  nicheHasPhysicalLocation,
  type OrganizationNiche,
} from "@/lib/organization-niche";
import {
  parseVerticalId,
  profileDefaultsForVertical,
  resolveNicheForVerticalChoice,
} from "@/lib/verticals";
import { parseStoredLocation } from "@/lib/location-fields";
import { importBusinessFromWebsite } from "@/lib/website-import";
import { isValidIrishEircode } from "@/lib/irish-eircode";
import type { WebsiteImportLocation } from "@/lib/website-import-types";
import { geocodeIrelandLocation } from "@/lib/geocode-ireland";
import { CLISTE_DEFAULT_ELEVENLABS_VOICE_ID } from "@/lib/onboarding-voice-presets";
import {
  ONBOARDING_STEPS,
  requireOnboardingAdminSession,
  resolveCurrentStepPath,
} from "@/lib/onboarding-session";
import {
  enforceOnboardingStepOrder,
  isOnboardingFreeNavEnabled,
} from "@/lib/onboarding-dev";
import {
  buildFullVoiceGreeting,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";
import { joinOwnerName, ownerNameNeedsCapture } from "@/lib/profile-display-name";
import { reviewVoiceGreetingSafe } from "@/lib/voice-greeting-review";
import { prepareOnboardingVoiceGreetingInput } from "@/lib/onboarding-voice-input";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import {
  getMissingLegalAcceptances,
  recordLegalAcceptances,
} from "@/lib/legal-acceptances";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import {
  handleOptionsForCaraGoal,
  type CaraGoal,
} from "@/lib/cara-goal";
import { createAdminClient } from "@/utils/supabase/admin";

async function provisionPhoneForOrganization(organizationId: string): Promise<void> {
  try {
    const result = await provisionOrganizationPhoneNumber(organizationId);
    if (!result.ok) {
      console.warn(
        "[onboarding] phone provision failed",
        organizationId,
        result.message,
      );
    }
  } catch (err) {
    console.error("[onboarding] phone provision error", organizationId, err);
  }
}

/** Flip an account + org live once payment + setup are done (go-live). */
async function activateOrganization(organizationId: string): Promise<void> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const activationPatch = {
    status: "active",
    launch_status: "completed",
    updated_at: nowIso,
  };

  const accountId = await resolveAccountIdFromBillingMetadata({ organizationId });
  if (accountId) {
    await admin.from("accounts").update(activationPatch).eq("id", accountId);
  }

  await admin
    .from("organizations")
    .update({
      ...activationPatch,
      is_active: true,
      onboarding_step: ONBOARDING_STEPS.done,
    })
    .eq("id", organizationId);

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
}

/** Cheap guard against keyboard-mashing / obvious non-answers. */
function looksLikeGibberish(text: string): boolean {
  const trimmed = text.trim();
  const letters = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length < 5) return false;
  const vowels = (letters.match(/[aeiou]/g) ?? []).length;
  if (vowels / letters.length < 0.12) return true;
  if (!/\s/.test(trimmed) && /(.)\1{3,}/.test(trimmed)) return true;
  return false;
}

export type ImportWebsiteResult =
  | {
      ok: true;
      businessDescription: string;
      address: string;
      eircode: string;
      locations: WebsiteImportLocation[];
      regulated: boolean;
      imported: { services: number; faqs: number; hours: boolean; area: boolean };
    }
  | { ok: false; message: string; reason?: string };

/**
 * Website import — fetch the business site, AI-extract details, persist drafts
 * (so Train Cara prefills), and return the profile fields to prefill on screen.
 */
export async function importWebsiteForProfile(
  url: string,
): Promise<ImportWebsiteResult> {
  const session = await requireOnboardingAdminSession();

  const result = await importBusinessFromWebsite(url);
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }
  const d = result.data;

  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();
  const skipServiceArea = verticalPackForNiche(String(orgRow?.niche ?? ""))
    .capabilities.skipServiceArea;

  const update: Record<string, unknown> = {
    raw_business_description: d.businessDescription,
    updated_at: new Date().toISOString(),
  };
  if (d.services.length) {
    update.agent_services_departments = d.services.join(", ");
  }
  if (d.servicesNotOffered.length) {
    update.agent_services_not_offered = d.servicesNotOffered.join(", ");
  }
  if (d.openingHours) update.agent_opening_hours = d.openingHours;
  if (d.serviceArea && !skipServiceArea) update.agent_service_area = d.serviceArea;
  if (d.faqs.length) update.agent_faqs = cleanAgentFaqs(d.faqs);

  const multipleLocations = d.locations.length > 1;
  if (!multipleLocations) {
    const primaryAddress = d.address.trim() || d.locations[0]?.address?.trim() || "";
    const primaryEircode = d.eircode.trim() || d.locations[0]?.eircode?.trim() || "";
    if (primaryAddress) {
      const parsed = parseStoredLocation({ address: primaryAddress });
      update.address = primaryAddress;
      update.agent_location_address = parsed.street || primaryAddress;
      if (parsed.town) update.agent_base_town = parsed.town;
      if (parsed.county) update.agent_location_county = parsed.county;
    }
    if (primaryEircode) {
      update.storefront_eircode = primaryEircode;
      update.agent_location_eircode = primaryEircode;
    }
  }

  const { error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", session.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await regenerateCaraCustomPrompt(admin, session.organizationId);

  return {
    ok: true,
    businessDescription: d.businessDescription,
    address: multipleLocations ? "" : d.address,
    eircode: multipleLocations ? "" : d.eircode,
    locations: d.locations,
    regulated: d.regulated,
    imported: {
      services: d.services.length,
      faqs: d.faqs.length,
      hours: Boolean(d.openingHours),
      area: Boolean(d.serviceArea),
    },
  };
}

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; message: string };

export type SaveProfilePayload = {
  address: string;
  eircode: string;
  firstName: string;
  lastName: string;
  /** Owner's explicit vertical choice from the niche picker. */
  vertical?: string;
  /** What Cara should do on calls — FAQ-only vs full follow-up. */
  caraGoal?: string;
};

/**
 * Step 1 — capture salon profile details used for the AI prompt and the
 * public storefront. Address is geocoded (Ireland) so the directory search
 * can sort by distance.
 */
export async function saveProfileStep(
  _: unknown,
  payload: SaveProfilePayload,
): Promise<SaveProfileResult> {
  const session = await requireOnboardingAdminSession();

  const address = payload.address.trim();
  const eircode = payload.eircode.trim();
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const ownerNameFromForm = joinOwnerName(firstName, lastName);

  const verticalChoice = parseVerticalId(payload.vertical);
  if (!verticalChoice) {
    return { ok: false, message: "Pick the option that fits you best." };
  }

  const caraGoalRaw = String(payload.caraGoal ?? "").trim();
  if (caraGoalRaw !== "faq_only" && caraGoalRaw !== "full_agent") {
    return { ok: false, message: "Choose what you want Cara to do on calls." };
  }
  const caraGoal: CaraGoal = caraGoalRaw;

  const admin = createAdminClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, raw_business_description, business_knowledge_summary")
      .eq("id", session.organizationId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("name")
      .eq("id", session.user.id)
      .maybeSingle(),
  ]);

  const businessName = String(org?.name ?? "").trim();
  if (businessName.length < 2) {
    return {
      ok: false,
      message:
        "Business name is missing from your account. Go back to signup or contact support.",
    };
  }

  const existingRaw = String(org?.raw_business_description ?? "").trim();
  const existingSummary = String(org?.business_knowledge_summary ?? "").trim();

  let agentBusinessType: string;
  let classifiedNiche: OrganizationNiche;
  let regulated = false;

  if (existingRaw.length >= 2 && !looksLikeGibberish(existingRaw)) {
    const classified = await classifyBusinessDescription(existingRaw);
    agentBusinessType = classified.agentBusinessType;
    classifiedNiche = classified.niche;
    regulated = classified.regulated;
  } else {
    const defaults = profileDefaultsForVertical(verticalChoice);
    agentBusinessType = defaults.agentBusinessType;
    classifiedNiche = defaults.niche;
  }

  // Honour the owner's explicit vertical choice: a "Salon & Beauty" pick keeps
  // the tailored experience even if an imported description is ambiguous.
  const niche = resolveNicheForVerticalChoice(verticalChoice, classifiedNiche);
  const businessDescription = existingRaw || agentBusinessType;

  if (regulated && !isOnboardingFreeNavEnabled()) {
    return {
      ok: false,
      message:
        `We don't support medical, legal, or financial services yet — they need extra compliance. Email ${CLISTE_COMPANY.helloEmail} and we'll let you know when that changes.`,
    };
  }

  const profileName = String(profile?.name ?? "").trim();
  const captureOwnerName = ownerNameNeedsCapture(profileName, businessName);

  // Online-only verticals (e.g. e-commerce) don't need a public address.
  const requiresLocation = nicheHasPhysicalLocation(niche);
  if (requiresLocation && !address) {
    return { ok: false, message: "Add your address so callers can be directed." };
  }
  if (requiresLocation && !eircode) {
    return { ok: false, message: "Add your Eircode." };
  }
  if (requiresLocation && eircode && !isValidIrishEircode(eircode)) {
    return { ok: false, message: "Enter one Eircode for this location." };
  }

  if (captureOwnerName || firstName || lastName) {
    if (firstName.length < 1 || lastName.length < 1) {
      return { ok: false, message: "Add your first and last name." };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        name: ownerNameFromForm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (profileError) {
      return { ok: false, message: profileError.message };
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;
  const geoQuery = [address, eircode].filter(Boolean).join(", ");
  if (geoQuery) {
    const g = await geocodeIrelandLocation(geoQuery);
    if (g) {
      lat = g.lat;
      lng = g.lng;
    }
  }

  const locationAddress = address || null;
  const locationEircode = eircode || null;
  const seedKnowDraft = !existingRaw && !existingSummary;

  const { error } = await admin
    .from("organizations")
    .update({
      niche,
      agent_business_type: agentBusinessType,
      address: locationAddress,
      storefront_eircode: locationEircode,
      storefront_map_lat: lat,
      storefront_map_lng: lng,
      ...(seedKnowDraft
        ? { raw_business_description: businessDescription }
        : {}),
      // Pre-fill Cara Setup location so onboarding step 5 isn't a repeat.
      ...(locationAddress
        ? { agent_location_address: locationAddress }
        : {}),
      ...(locationEircode
        ? { agent_location_eircode: locationEircode }
        : {}),
      cara_goal: caraGoal,
      cara_handle_options: handleOptionsForCaraGoal(caraGoal),
      onboarding_step: ONBOARDING_STEPS.voice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/voice");
}

export type SaveVoiceResult =
  | { ok: true }
  | { ok: false; message: string };

export type SaveVoicePayload = {
  greetingIntro: string;
  greetingClosing: string;
};

export type ReviewVoiceGreetingResult =
  | { ok: true; status: "approved" }
  | {
      ok: true;
      status: "suggestions";
      summary: string;
      greetingIntro?: string;
      greetingClosing?: string;
    }
  | {
      ok: false;
      message: string;
      introIssue?: boolean;
      closingIssue?: boolean;
      rateLimited?: boolean;
    };

export type ValidateVoicePreviewResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      introIssue?: boolean;
      closingIssue?: boolean;
    };

export async function validateVoiceGreetingPreviewStep(
  payload: SaveVoicePayload,
): Promise<ValidateVoicePreviewResult> {
  const session = await requireOnboardingAdminSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim();

  const prepared = await prepareOnboardingVoiceGreetingInput(
    {
      session,
      businessName,
      source: "voice_preview",
    },
    payload,
    { rateLimitScope: null },
  );

  if (!prepared.ok) {
    return {
      ok: false,
      message: prepared.message,
      introIssue: prepared.introIssue,
      closingIssue: prepared.closingIssue,
    };
  }

  return { ok: true };
}

export async function reviewVoiceGreetingStep(
  payload: SaveVoicePayload,
): Promise<ReviewVoiceGreetingResult> {
  const session = await requireOnboardingAdminSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim();

  const prepared = await prepareOnboardingVoiceGreetingInput(
    {
      session,
      businessName,
      source: "onboarding_review",
    },
    payload,
    { rateLimitScope: "greeting_review" },
  );

  if (!prepared.ok) {
    return {
      ok: false,
      message: prepared.message,
      introIssue: prepared.introIssue,
      closingIssue: prepared.closingIssue,
      rateLimited: prepared.rateLimited,
    };
  }

  const outcome = await reviewVoiceGreetingSafe({
    businessName,
    greetingIntro: prepared.greetingIntro,
    greetingClosing: prepared.greetingClosing,
  });

  if (outcome.status === "approved") {
    return { ok: true, status: "approved" };
  }

  return {
    ok: true,
    status: "suggestions",
    summary: outcome.suggestion.summary,
    greetingIntro: outcome.suggestion.greetingIntro,
    greetingClosing: outcome.suggestion.greetingClosing,
  };
}

/**
 * Step 2 — Cara voice + compliant opening greeting.
 */
export async function saveVoiceStep(
  _: unknown,
  payload: SaveVoicePayload,
): Promise<SaveVoiceResult> {
  const session = await requireOnboardingAdminSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim();

  const prepared = await prepareOnboardingVoiceGreetingInput(
    {
      session,
      businessName,
      source: "onboarding_save",
    },
    payload,
    { rateLimitScope: null },
  );

  if (!prepared.ok) {
    return { ok: false, message: prepared.message };
  }

  const greeting = buildFullVoiceGreeting(
    prepared.greetingIntro,
    VOICE_ASSISTANT_DEFAULT_NAME,
    prepared.greetingClosing,
  );

  const nextStep = ONBOARDING_STEPS.knowledge;

  const { error } = await admin
    .from("organizations")
    .update({
      assistant_display_name: VOICE_ASSISTANT_DEFAULT_NAME,
      agent_voice_id: CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
      greeting,
      onboarding_step: nextStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/knowledge");
}

/**
 * Final go-live step — create a Stripe Billing Checkout Session that charges:
 *   - the selected plan's monthly or annual price (licensed line)
 *   - a metered price for per-minute overage (licensed=false line, quantity
 *     grows via usage_records nightly sync)
 *
 * Payment is deferred to here (after the user has built + tested Cara). On
 * success the org is activated. Webhook also sets platform_subscription_id +
 * activates on `checkout.session.completed`.
 */
export async function startPlanCheckout(
  _: unknown,
  formData: FormData,
): Promise<{ ok: false; message: string }> {
  const session = await requireOnboardingAdminSession();

  const rawPlan = String(formData.get("planTier") ?? "").trim();
  const interval = String(formData.get("interval") ?? "month") === "year" ? "year" : "month";

  if (!isPlanTier(rawPlan)) {
    return { ok: false, message: "Pick a plan to continue." };
  }
  if (!planSupportsSelfServeCheckout(rawPlan)) {
    return {
      ok: false,
      message:
        `Custom plans are arranged directly with our team. Email ${CLISTE_COMPANY.helloEmail} to get started.`,
    };
  }
  if (formData.get("acceptDpa") !== "on") {
    return {
      ok: false,
      message: "You must accept the Data Processing Agreement to continue.",
    };
  }
  if (formData.get("acceptCallerPrivacy") !== "on") {
    return {
      ok: false,
      message:
        "Confirm you have added or will display caller privacy information before go-live.",
    };
  }
  const planTier: PlanTier = rawPlan;
  const launchTier = "diy" as const;

  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const adminForLegal = createAdminClient();
  try {
    await recordLegalAcceptances(adminForLegal, {
      userId: session.user.id,
      organizationId: session.organizationId,
      documents: ["dpa"],
      context: securityCtx,
    });
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not record DPA acceptance.",
    };
  }

  await logSecurityEvent(securityCtx, {
    eventType: "legal_acceptance",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    metadata: {
      documents: ["dpa"],
      organizationId: session.organizationId,
      source: "onboarding_plan",
    },
  });

  await adminForLegal
    .from("organizations")
    .update({
      caller_privacy_acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (PLAN_CHECKOUT_DEV_SKIP_ALLOWED) {
    console.warn(
      "[onboarding] CLISTE_PLAN_CHECKOUT_ENABLED is off — skipping Stripe checkout (dev only)",
    );
    const admin = createAdminClient();
    const plan = PLANS[planTier];
    const { data: orgRow } = await admin
      .from("organizations")
      .select("account_id")
      .eq("id", session.organizationId)
      .maybeSingle();
    const accountId = orgRow?.account_id as string | undefined;
    const billingPatch = {
      plan_tier: planTier,
      billing_interval: interval,
      launch_tier: launchTier,
      application_fee_bps: plan.applicationFeeBps,
      platform_subscription_id: "dev_checkout_skipped",
      status: "active",
      launch_status: "completed",
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin
      .from("organizations")
      .update(billingPatch)
      .eq("id", session.organizationId);

    if (error) {
      return { ok: false, message: error.message };
    }
    if (accountId) {
      await admin.from("accounts").update(billingPatch).eq("id", accountId);
    }

    await provisionPhoneForOrganization(session.organizationId);
    await completeOnboarding();
  }

  if (!PLAN_CHECKOUT_ENABLED) {
    return {
      ok: false,
      message: "Billing is not available. Contact support.",
    };
  }

  await persistOrgBillingSelection({
    organizationId: session.organizationId,
    planTier,
    launchTier,
    interval,
  });

  redirect("/onboarding/plan/checkout");
}

export type OnboardingEmbeddedCheckoutResult =
  | { ok: true; clientSecret: string }
  | { ok: false; message: string };

export async function prepareOnboardingEmbeddedCheckout(): Promise<OnboardingEmbeddedCheckoutResult> {
  const session = await requireOnboardingAdminSession();

  const admin = createAdminClient();
  const missingDpa = await getMissingLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
    needsDpa: true,
  });
  if (missingDpa.includes("dpa")) {
    return {
      ok: false,
      message:
        "Accept the Data Processing Agreement on the plan page before continuing to billing.",
    };
  }

  if (!PLAN_CHECKOUT_ENABLED) {
    return {
      ok: false,
      message: "Plan checkout is not enabled in this environment.",
    };
  }

  const planTier = isPlanTier(session.planTier) ? session.planTier : "pro";
  if (!planSupportsSelfServeCheckout(planTier)) {
    return {
      ok: false,
      message:
        `Custom plans are arranged directly with our team. Email ${CLISTE_COMPANY.helloEmail} to get started.`,
    };
  }

  const launchTier = "diy" as const;
  const interval = session.billingInterval === "year" ? "year" : "month";
  const origin = await resolveCheckoutReturnOrigin();

  const result = await createPlatformSubscriptionCheckout({
    organizationId: session.organizationId,
    userEmail: session.user.email ?? undefined,
    planTier,
    launchTier,
    interval,
    checkoutMode: "embedded",
    returnUrl: `${origin}/onboarding/plan?status=return&session_id={CHECKOUT_SESSION_ID}`,
    idempotencyKey: `onboarding-checkout-embedded-${session.organizationId}-${planTier}-${launchTier}`,
  });

  if (!result.ok) return result;
  if (result.mode !== "embedded") {
    return { ok: false, message: "Expected embedded Checkout session." };
  }
  return { ok: true, clientSecret: result.clientSecret };
}

export type OnboardingElementsCheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      subscriptionId: string;
      returnUrl: string;
      summary: {
        planName: string;
        trialDays: number;
        amountLabel: string;
        intervalLabel: string;
        email: string;
      };
    }
  | { ok: false; message: string };

export async function prepareOnboardingElementsCheckout(): Promise<OnboardingElementsCheckoutResult> {
  const session = await requireOnboardingAdminSession();

  const admin = createAdminClient();
  const missingDpa = await getMissingLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
    needsDpa: true,
  });
  if (missingDpa.includes("dpa")) {
    return {
      ok: false,
      message:
        "Accept the Data Processing Agreement on the plan page before continuing to billing.",
    };
  }

  if (!PLAN_CHECKOUT_ENABLED) {
    return {
      ok: false,
      message: "Plan checkout is not enabled in this environment.",
    };
  }

  const planTier = isPlanTier(session.planTier) ? session.planTier : "pro";
  if (!planSupportsSelfServeCheckout(planTier)) {
    return {
      ok: false,
      message:
        `Custom plans are arranged directly with our team. Email ${CLISTE_COMPANY.helloEmail} to get started.`,
    };
  }

  const accountId = await resolveAccountIdForOrganization(session.organizationId);
  if (!accountId) {
    return { ok: false, message: "Organisation is not linked to an account." };
  }

  await persistOrgBillingSelection({
    organizationId: session.organizationId,
    planTier,
    launchTier: "diy",
    interval: session.billingInterval === "year" ? "year" : "month",
  });

  const origin = await resolveCheckoutReturnOrigin();
  const result = await createPlatformElementsCheckout({
    organizationId: session.organizationId,
    accountId,
    userEmail: session.user.email ?? "",
    planTier,
    launchTier: "diy",
    interval: session.billingInterval === "year" ? "year" : "month",
  });

  if (!result.ok) return result;

  return {
    ok: true,
    clientSecret: result.clientSecret,
    subscriptionId: result.subscriptionId,
    returnUrl: `${origin}/onboarding/plan?status=return&subscription_id=${result.subscriptionId}`,
    summary: result.summary,
  };
}

export async function persistOnboardingElementsCheckout(
  subscriptionId: string,
  setupIntentId?: string,
): Promise<void> {
  const session = await requireOnboardingAdminSession();
  const trimmed = subscriptionId.trim();
  if (!trimmed) {
    throw new Error("Missing subscription.");
  }

  const accountId = await resolveAccountIdForOrganization(session.organizationId);
  if (!accountId) {
    throw new Error("Organisation is not linked to an account.");
  }

  await persistPlatformElementsSubscription({
    organizationId: session.organizationId,
    subscriptionId: trimmed,
    accountId,
    setupIntentId: setupIntentId?.trim(),
  });

  await activatePlatformSubscriptionGoLive(session.organizationId);
}

export async function finaliseElementsCheckoutReturn(input: {
  subscriptionId: string;
  setupIntentId: string;
}): Promise<void> {
  const session = await requireOnboardingAdminSession();
  const subscriptionId = input.subscriptionId.trim();
  const setupIntentId = input.setupIntentId.trim();
  if (!subscriptionId || !setupIntentId) {
    throw new Error("Missing payment return details.");
  }

  const stripe = getStripeClient();
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  assertSetupIntentSucceeded(setupIntent);

  const accountId = await resolveAccountIdForOrganization(session.organizationId);
  if (!accountId) {
    throw new Error("Organisation is not linked to an account.");
  }

  const { subscription } = await assertElementsSubscriptionReady(
    subscriptionId,
    setupIntentId,
  );
  assertPlatformSubscriptionOwnership(subscription, {
    organizationId: session.organizationId,
    accountId,
  });
  assertSetupIntentMatchesSubscription(setupIntent, subscription, subscriptionId);

  await persistPlatformElementsSubscription({
    organizationId: session.organizationId,
    subscriptionId,
    accountId,
    setupIntentId,
  });

  await activatePlatformSubscriptionGoLive(session.organizationId);
}

export async function finalizeOnboardingElementsCheckout(
  subscriptionId: string,
): Promise<void> {
  await persistOnboardingElementsCheckout(subscriptionId);
  redirect("/dashboard?welcome=1");
}

/**
 * Go-live return handler — after Stripe Checkout success, persist the
 * subscription id + customer id, ensure a number, and activate the org.
 */
export async function finalisePlanCheckout(checkoutSessionId: string): Promise<void> {
  const session = await requireOnboardingAdminSession();
  if (!checkoutSessionId?.trim()) return;

  await persistPlatformCheckoutSession(
    session.organizationId,
    checkoutSessionId,
  );

  await activatePlatformSubscriptionGoLive(session.organizationId);
}

/**
 * Finishes onboarding at go-live. Verifies the org is actually ready
 * (subscription + greeting + number), activates it, and opens the dashboard.
 */
export async function completeOnboarding(): Promise<never> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "greeting, phone_number, platform_subscription_id, account_id",
    )
    .eq("id", session.organizationId)
    .maybeSingle();

  let hasSubscription = Boolean(
    String(org?.platform_subscription_id ?? "").trim(),
  );
  if (!hasSubscription && org?.account_id) {
    const { data: account } = await admin
      .from("accounts")
      .select("platform_subscription_id")
      .eq("id", org.account_id as string)
      .maybeSingle();
    hasSubscription = Boolean(
      String(account?.platform_subscription_id ?? "").trim(),
    );
  }
  if (!hasSubscription && session.platformSubscriptionId?.trim()) {
    hasSubscription = true;
  }
  const hasGreeting = String(org?.greeting ?? "").trim().length > 0;

  // In enforced mode, never half-activate: bounce back to the right step.
  if (enforceOnboardingStepOrder() && (!hasSubscription || !hasGreeting)) {
    redirect(resolveCurrentStepPath(session));
  }

  // Best-effort: make sure a number is assigned before going live.
  if (!String(org?.phone_number ?? "").trim()) {
    await provisionPhoneForOrganization(session.organizationId);
  }

  await activateOrganization(session.organizationId);
  redirect("/dashboard?welcome=1");
}

