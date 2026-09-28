"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  routesFromStoredLinks,
  serializeRoutes,
  validateRoutes,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { normalizeRoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-owner-copy";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import {
  generateOnboardingUiCopy,
  type OnboardingUiCopy,
} from "@/lib/onboarding-ui-copy";
import {
  persistBusinessKnowledge,
  type BusinessKnowledgePayload,
} from "@/lib/business-knowledge-save";
import {
  ONBOARDING_STEPS,
  requireOnboardingAdminSession,
} from "@/lib/onboarding-session";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import {
  serializeBusinessHours,
  weekScheduleHasOpenDay,
  type BankHolidayConfig,
  type WeekSchedule,
} from "@/lib/business-hours";
import { normalizeBaseTown } from "@/lib/base-town";
import { compactEircode, normalizeIrelandLocationQuery } from "@/lib/geocode-ireland";
import { extractServiceOfferings } from "@/lib/extract-service-offerings";
import { sanitizeServicesOfferedRaw } from "@/lib/service-offered-raw";
import { extractServiceCatalogSupplement } from "@/lib/extract-service-supplement";
import {
  emptyServiceCatalogSupplement,
  serializeServiceCatalogSupplement,
  type ServiceCatalogSupplement,
} from "@/lib/service-catalog-supplement";
import {
  listServicesForOrg,
  syncServiceNamesToBoundary,
} from "@/lib/service-catalog";
import { verticalPackForNiche } from "@/lib/verticals";
import {
  databaseUpdateRequiredMessage,
  isMissingPostgresColumn,
} from "@/lib/supabase-errors";
import {
  lintExtractedKnowledgeLists,
  type KnowledgeLintIssue,
} from "@/lib/cara-knowledge-lint";
import { snapshotFromLists } from "@/lib/cara-knowledge-snapshot";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

async function advanceToNumberStep(organizationId: string): Promise<never> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      onboarding_step: ONBOARDING_STEPS.number,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/number");
}

import type { CaraHandleOptionId, TrainCaraStepId } from "./train-cara-constants";
import { ensureSalonBookingRouteInPayload } from "./ensure-salon-booking-route";
import {
  buildTrainCaraFaqGuardContextFromPayload,
  sanitizeOnboardingFaqs,
} from "./train-cara-faq-guardrails";

export type TrainCaraPayload = BusinessKnowledgePayload & {
  preserveFaqs?: boolean;
  servicesOfferedRaw?: string;
  servicesNotOffered?: string;
  servicesNotOfferedRaw?: string;
  detailsToCollect?: string;
  handleOptions: CaraHandleOptionId[];
  routes: SavedRoute[];
  trainCaraStep?: TrainCaraStepId;
  captureDetailsNote?: string;
  transferPhone?: string;
  linkLabel?: string;
  linkUrl?: string;
  emailAddress?: string;
  whatsappContact?: string;
  meetingLink?: string;
  logNote?: string;
  serviceCatalogSupplement?: ServiceCatalogSupplement | null;
  businessHours?: WeekSchedule;
  open24_7?: boolean;
  bankHolidays?: BankHolidayConfig;
  locationAddress?: string;
  baseTown?: string;
  locationCounty?: string;
  locationEircode?: string;
};

export type TrainCaraSaveResult = { ok: true } | { ok: false; message: string };

function trainCaraKnowledgeSnapshot(
  payload: TrainCaraPayload,
  overrides: {
    servicesOffered?: string;
    servicesNotOffered?: string;
  } = {},
) {
  return snapshotFromLists({
    about: payload.rawBusinessDescription,
    openingHours: payload.openingHours,
    serviceArea: payload.serviceArea,
    servicesOffered: overrides.servicesOffered ?? payload.servicesOffered,
    servicesOfferedRaw: payload.servicesOfferedRaw,
    servicesNotOffered: overrides.servicesNotOffered ?? payload.servicesNotOffered,
    servicesNotOfferedRaw: payload.servicesNotOfferedRaw,
    captureFields: payload.captureFields,
    detailsToCollect: payload.detailsToCollect,
    faqs: payload.faqs,
    routes: payload.routes,
    transferNumber: payload.transferPhone,
  });
}

function firstExtractedKnowledgeBlock(
  snapshot: ReturnType<typeof trainCaraKnowledgeSnapshot>,
  extracted: {
    servicesOffered?: string[];
    servicesNotOffered?: string[];
  },
): KnowledgeLintIssue | null {
  const blockers = lintExtractedKnowledgeLists({
    snapshot,
    ...extracted,
  });
  return blockers[0] ?? null;
}

async function persistTrainCara(
  organizationId: string,
  payload: TrainCaraPayload,
  options: { strictRoutes?: boolean } = {},
): Promise<TrainCaraSaveResult> {
  const admin = createAdminClient();
  const { data: orgMeta } = await admin
    .from("organizations")
    .select("niche")
    .eq("id", organizationId)
    .maybeSingle();
  const niche = String(orgMeta?.niche ?? "");
  const pack = verticalPackForNiche(niche);
  const skipServiceArea = pack.capabilities.skipServiceArea;

  const faqGuardContext = buildTrainCaraFaqGuardContextFromPayload({
    businessHours: payload.businessHours,
    open24_7: payload.open24_7,
    openingHours: payload.openingHours,
    locationAddress: payload.locationAddress,
    baseTown: payload.baseTown,
    locationCounty: payload.locationCounty,
    locationEircode: payload.locationEircode,
    serviceArea: skipServiceArea ? "" : payload.serviceArea,
    servicesOffered: payload.servicesOffered,
  });
  const sanitizedFaqs = sanitizeOnboardingFaqs(payload.faqs, faqGuardContext);

  const supabase = await createClient();

  const knowledgeSaved = await persistBusinessKnowledge(supabase, organizationId, {
    rawBusinessDescription: payload.rawBusinessDescription,
    businessKnowledgeSummary: payload.businessKnowledgeSummary,
    openingHours: payload.openingHours,
    serviceArea: skipServiceArea ? "" : payload.serviceArea,
    servicesOffered: payload.servicesOffered,
    emergencyCallouts: payload.emergencyCallouts,
    extraNotes: payload.extraNotes,
    refinedBusinessType: payload.refinedBusinessType,
    preserveFaqs: payload.preserveFaqs,
    faqs: sanitizedFaqs,
    onboardingUiCopy: payload.onboardingUiCopy,
    captureFields: payload.captureFields,
    businessRules: [],
    skipServiceArea,
  });

  if (!knowledgeSaved.ok) return knowledgeSaved;

  const links = parseRoutingLinks(serializeRoutes(payload.routes)).map((link) =>
    normalizeRoutingLink(link),
  );

  if (options.strictRoutes) {
    const routeError = validateRoutes(routesFromStoredLinks(links));
    if (routeError) return { ok: false, message: routeError };
  }

  const servicesOfferedRaw = String(payload.servicesOfferedRaw ?? "").trim();
  const servicesNotOffered = String(payload.servicesNotOffered ?? "").trim();
  const servicesNotOfferedRaw = String(payload.servicesNotOfferedRaw ?? "").trim();
  const detailsToCollect = String(payload.detailsToCollect ?? "").trim();
  const update: Record<string, unknown> = {
    cara_handle_options: payload.handleOptions,
    routing_links: links,
    train_cara_step: payload.trainCaraStep ?? null,
    agent_services_departments_raw: servicesOfferedRaw || null,
    agent_services_not_offered: servicesNotOffered || null,
    agent_services_not_offered_raw: servicesNotOfferedRaw || null,
    agent_business_rules_raw: null,
    agent_details_to_collect: detailsToCollect || null,
    updated_at: new Date().toISOString(),
  };
  if (payload.serviceCatalogSupplement !== undefined) {
    update.agent_service_catalog_supplement = serializeServiceCatalogSupplement(
      payload.serviceCatalogSupplement ?? emptyServiceCatalogSupplement(),
    );
  }

  if (payload.businessHours) {
    const open24_7 = payload.open24_7 === true;
    const formattedHours = open24_7
      ? "Open 24 hours, 7 days a week"
      : weekScheduleHasOpenDay(payload.businessHours)
        ? formatWeekScheduleForAgent(payload.businessHours)
        : "Closed all week";
    update.agent_opening_hours = formattedHours;
    update.business_hours = serializeBusinessHours(payload.businessHours, {
      open24_7,
      bankHolidays: payload.bankHolidays,
    });
  }

  const locationAddress = String(payload.locationAddress ?? "").trim();
  const baseTown = normalizeBaseTown(String(payload.baseTown ?? ""));
  const locationCounty = normalizeBaseTown(String(payload.locationCounty ?? ""));
  let locationEircode = String(payload.locationEircode ?? "").trim();
  if (payload.locationAddress !== undefined) {
    if (locationEircode) {
      locationEircode = normalizeIrelandLocationQuery(locationEircode);
      if (!compactEircode(locationEircode)) {
        return {
          ok: false,
          message: "Enter a valid Eircode (e.g. D06 X2P6), or leave it blank.",
        };
      }
    }
    update.agent_location_address = locationAddress || null;
    update.agent_base_town = baseTown || null;
    update.agent_location_county = locationCounty || null;
    update.agent_location_eircode = locationEircode || null;
  }

  if (payload.emailAddress?.trim()) {
    update.notification_email = payload.emailAddress.trim();
  }
  const transfer = payload.transferPhone?.trim() ?? "";
  // The transfer number is where Cara puts callers through (voice worker reads
  // fallback_number); mirror it to notification_phone so the owner is reachable.
  update.fallback_number = transfer || null;
  if (transfer) {
    update.notification_phone = transfer;
  } else if (payload.whatsappContact?.trim()) {
    update.notification_phone = payload.whatsappContact.trim();
  }

  const { error } = await admin.from("organizations").update(update).eq("id", organizationId);

  if (error) {
    if (isMissingPostgresColumn(error, "agent_service_catalog_supplement")) {
      return {
        ok: false,
        message: databaseUpdateRequiredMessage("agent_service_catalog_supplement"),
      };
    }
    return { ok: false, message: error.message };
  }

  await regenerateCaraCustomPrompt(admin, organizationId);

  revalidatePath("/onboarding/knowledge");
  revalidatePath("/dashboard/routing");
  revalidatePath("/dashboard/agent-setup");
  return { ok: true };
}

export type GenerateOnboardingUiCopyResult =
  | { ok: true; copy: OnboardingUiCopy }
  | { ok: false; message: string };

export type EnsureOnboardingUiCopyPayload = {
  businessType?: string;
  niche?: string;
  rawBusinessDescription: string;
  openingHours?: string;
  serviceArea?: string;
  servicesOffered?: string;
};

export async function ensureOnboardingUiCopy(
  payload: EnsureOnboardingUiCopyPayload,
): Promise<GenerateOnboardingUiCopyResult> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, agent_business_type, niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessType =
    payload.businessType?.trim() ||
    String(org?.agent_business_type ?? "").trim() ||
    undefined;

  const result = await generateOnboardingUiCopy({
    businessName: String(org?.name ?? "").trim() || "Your business",
    businessType,
    niche: payload.niche?.trim() || String(org?.niche ?? "").trim() || undefined,
    rawBusinessDescription: payload.rawBusinessDescription,
    openingHours: payload.openingHours,
    serviceArea: payload.serviceArea,
    servicesOffered: payload.servicesOffered,
  });

  if (!result.ok) return result;

  const { error } = await admin
    .from("organizations")
    .update({
      onboarding_ui_copy: result.copy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding/knowledge");
  return result;
}

export async function saveTrainCaraProgress(
  payload: TrainCaraPayload,
): Promise<TrainCaraSaveResult> {
  const session = await requireOnboardingAdminSession();
  return persistTrainCara(session.organizationId, payload, { strictRoutes: false });
}

export type ExtractOfferingsResult =
  | { ok: true; formatted: string; raw: string; chips: string[] }
  | { ok: false; message: string };

export async function extractServiceOfferingsForTrainCara(
  rawParagraph: string,
): Promise<ExtractOfferingsResult> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();
  const raw = rawParagraph.trim();

  const { data: org } = await admin
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  const pack = verticalPackForNiche(String(org?.niche ?? ""));
  if (pack.capabilities.usesServiceCatalog) {
    const catalog = await listServicesForOrg(admin, session.organizationId);
    if (catalog.length > 0) {
      const formatted = syncServiceNamesToBoundary(catalog);
      const chips = catalog
        .map((service) => service.name.trim())
        .filter(Boolean);
      return {
        ok: true,
        formatted,
        raw,
        chips,
      };
    }
  }

  const result = await extractServiceOfferings(raw);
  if (!result.ok) return result;
  return { ok: true, formatted: result.formatted, raw, chips: result.chips };
}

export async function skipTrainCaraStep(): Promise<TrainCaraSaveResult | never> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();

  const { data: org, error: loadError } = await admin
    .from("organizations")
    .select("agent_services_departments, agent_opening_hours, niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, message: loadError.message };
  }

  const niche = String(org?.niche ?? "");
  const servicesText = String(org?.agent_services_departments ?? "").trim();
  const pack = verticalPackForNiche(niche);
  const hasCatalog =
    pack.capabilities.catalogSatisfiesServicesGate
      ? (await listServicesForOrg(admin, session.organizationId)).length > 0
      : false;
  const services = servicesText || (hasCatalog ? "catalog" : "");
  const hours = String(org?.agent_opening_hours ?? "").trim();
  if (!services || !hours) {
    return {
      ok: false,
      message:
        "Add your services and opening hours before continuing — Cara needs these to answer calls.",
    };
  }

  const { error } = await admin
    .from("organizations")
    .update({
      train_cara_step: null,
      train_cara_skipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/onboarding/knowledge");
  return advanceToNumberStep(session.organizationId);
}

export async function completeTrainCaraStep(
  _: unknown,
  payload: TrainCaraPayload,
): Promise<TrainCaraSaveResult | never> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("niche, agent_business_type")
    .eq("id", session.organizationId)
    .maybeSingle();

  const niche = String(org?.niche ?? "");
  const businessType = String(org?.agent_business_type ?? "").trim();
  const pack = verticalPackForNiche(niche);
  let nextPayload = payload;

  if (pack.capabilities.autoEnsureBookingRoute) {
    const ensured = ensureSalonBookingRouteInPayload({
      routes: payload.routes,
      linkUrl: payload.linkUrl,
      captureFields: payload.captureFields ?? [],
      handleOptions: payload.handleOptions,
      niche,
      businessType,
    });
    nextPayload = {
      ...payload,
      routes: ensured.routes,
      handleOptions: ensured.handleOptions,
    };
  }

  const saved = await persistTrainCara(session.organizationId, nextPayload, {
    strictRoutes: false,
  });
  if (!saved.ok) return saved;

  const { error } = await admin
    .from("organizations")
    .update({
      train_cara_step: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  await regenerateCaraCustomPrompt(admin, session.organizationId);

  revalidatePath("/onboarding", "layout");
  return advanceToNumberStep(session.organizationId);
}

export async function persistTrainCaraServicesStep(
  payload: TrainCaraPayload & {
    extractOfferings?: boolean;
  },
): Promise<TrainCaraSaveResult & { offerings?: string }> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();
  let servicesOffered = String(payload.servicesOffered ?? "").trim();
  let servicesOfferedRaw = String(payload.servicesOfferedRaw ?? "").trim();

  const { data: org } = await admin
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();
  const pack = verticalPackForNiche(String(org?.niche ?? ""));
  const catalog = pack.capabilities.usesServiceCatalog
    ? await listServicesForOrg(admin, session.organizationId)
    : [];
  const catalogNames = catalog.map((item) => item.name);

  if (catalog.length > 0) {
    servicesOfferedRaw = sanitizeServicesOfferedRaw({
      raw: servicesOfferedRaw,
      catalogNames,
      offeredChips: servicesOffered,
    });
  }

  let serviceCatalogSupplement: ServiceCatalogSupplement | null = null;
  if (catalog.length > 0) {
    serviceCatalogSupplement = servicesOfferedRaw
      ? await extractServiceCatalogSupplement(servicesOfferedRaw, catalogNames)
      : emptyServiceCatalogSupplement();
  }

  if (payload.extractOfferings !== false) {
    const extracted = await extractServiceOfferingsForTrainCara(servicesOfferedRaw);
    if (!extracted.ok) {
      return { ok: false, message: extracted.message };
    }
    servicesOffered = extracted.formatted;
    const snapshot = trainCaraKnowledgeSnapshot(payload, { servicesOffered });
    const blocker = firstExtractedKnowledgeBlock(snapshot, {
      servicesOffered: extracted.chips,
    });
    if (blocker) {
      return { ok: false, message: blocker.message };
    }
    const saved = await persistTrainCara(session.organizationId, {
      ...payload,
      servicesOffered,
      servicesOfferedRaw,
      serviceCatalogSupplement,
    });
    if (!saved.ok) return saved;
    await regenerateCaraCustomPrompt(admin, session.organizationId);
    return { ok: true, offerings: servicesOffered };
  }

  const saved = await persistTrainCara(session.organizationId, {
    ...payload,
    servicesOffered,
    servicesOfferedRaw,
    serviceCatalogSupplement,
  });
  if (!saved.ok) return saved;
  await regenerateCaraCustomPrompt(admin, session.organizationId);
  return { ok: true, offerings: servicesOffered };
}
