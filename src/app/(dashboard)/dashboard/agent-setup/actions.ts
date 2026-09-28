"use server";

import { revalidatePath } from "next/cache";

import { compactEircode, normalizeIrelandLocationQuery } from "@/lib/geocode-ireland";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { auditVoiceGreetingSecurityEvent } from "@/lib/voice-greeting-audit";
import { sanitizeGreetingLine } from "@/lib/voice-greeting-security";
import {
  cleanBusinessRules,
  MAX_BUSINESS_RULES,
} from "@/lib/agent-business-rules";
import type { CaraConduct } from "@/lib/agent-cara-conduct";
import {
  MAX_CARA_CONDUCT_NOTE_LENGTH,
  parseCaraConduct,
} from "@/lib/agent-cara-conduct";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  databaseUpdateRequiredMessage,
  isMissingPostgresColumn,
} from "@/lib/supabase-errors";
import { compileCaraPromptWithMeta } from "@/lib/compile-cara-prompt";
import { lintCatalogPricingVsRules } from "@/lib/call-handling-boundary";
import { firstBlockingKnowledgeLint } from "@/lib/cara-knowledge-lint";
import { snapshotFromLists } from "@/lib/cara-knowledge-snapshot";
import { listServicesForOrg } from "@/lib/service-catalog";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
import { verticalPackForNiche } from "@/lib/verticals";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import {
  serializeBusinessHours,
  weekScheduleHasOpenDay,
  type WeekSchedule,
  type BankHolidayConfig,
} from "@/lib/business-hours";
import {
  ensureCompliantStoredGreeting,
  greetingMissingDisclosure,
} from "@/lib/general-boundary";
import {
  assistantNameLabel,
  buildFullVoiceGreeting,
  defaultVoiceGreetingIntro,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";
import { validateVoiceGreetingGuardrails } from "@/lib/voice-greeting-guardrails";
import { buildCaraAgentKnowledgeOrgUpdate } from "@/lib/persist-cara-agent-knowledge";
import type { CaraCaptureField } from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import { normalizeBaseTown } from "@/lib/base-town";
import { parseDetailsCollectMode } from "@/lib/details-collect-mode";

import { cleanAgentFaqs, type AgentFaq } from "./agent-faqs";

export type AgentSetupPayload = {
  assistantDisplayName: string;
  greetingIntro: string;
  greetingClosing: string;
  faqs: AgentFaq[];
  openingHours: string;
  businessHours: WeekSchedule;
  open24_7: boolean;
  hoursNote: string;
  bankHolidays: BankHolidayConfig;
  serviceArea: string;
  serviceAreaExclusions: string;
  servicesDepartments: string;
  servicesNotOffered: string;
  detailsToCollect: string;
  detailsCollectMode?: string;
  businessRules: string[];
  caraConduct: CaraConduct;
  locationAddress: string;
  locationEircode: string;
  baseTown: string;
  locationCounty: string;
  captureFields: CaraCaptureField[];
  rawBusinessDescription?: string;
};

type SaveResult = { ok: true } | { ok: false; message: string };

const MAX_GREETING = 500;
const MAX_ASSISTANT_NAME = 64;
const MAX_HOURS = 2000;
const MAX_SERVICE_AREA = 2000;
const MAX_SERVICES_DEPARTMENTS = 2000;
const MAX_SERVICES_NOT_OFFERED = 2000;
const MAX_DETAILS_TO_COLLECT = 2000;
const MAX_LOCATION_ADDRESS = 500;
const MAX_EIRCODE = 16;
const MAX_BASE_TOWN = 80;
const MAX_LOCATION_COUNTY = 80;

import { recordCaraKnowledgeEvent } from "@/lib/cara-knowledge-events";
import {
  AGENT_CONFIG_REVALIDATE_PATHS,
  CARA_KNOWLEDGE_REVALIDATE_PATHS,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard-routes";

function revalidateCaraSetup() {
  for (const path of AGENT_CONFIG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  for (const path of CARA_KNOWLEDGE_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

/**
 * Save the agent configuration. `custom_prompt` is always compiled from
 * structured fields via {@link regenerateCaraCustomPrompt}.
 */
export async function saveAgentSetup(payload: AgentSetupPayload): Promise<SaveResult> {
  const { supabase, organizationId, user } = await requireDashboardAdmin();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name, assistant_display_name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string; assistant_display_name: string | null }>();

  const businessName = orgRow?.name ?? "";
  const assistantDisplayName = assistantNameLabel(
    String(orgRow?.assistant_display_name ?? "").trim() ||
      VOICE_ASSISTANT_DEFAULT_NAME,
  );
  const greetingIntro =
    sanitizeGreetingLine(String(payload?.greetingIntro ?? "")) ||
    defaultVoiceGreetingIntro(businessName);
  const greetingClosing = sanitizeGreetingLine(
    String(payload?.greetingClosing ?? ""),
  );
  const guardrail = validateVoiceGreetingGuardrails({
    greetingIntro,
    greetingClosing,
    businessName,
  });
  if (!guardrail.ok) {
    void auditVoiceGreetingSecurityEvent({
      source: "agent_setup",
      outcome: "failure",
      actorUserId: user.id,
      organizationId,
      eventType: "voice_greeting_guardrail_blocked",
      introIssue: guardrail.introIssue,
      closingIssue: guardrail.closingIssue,
      introLength: greetingIntro.length,
    });
    return { ok: false, message: guardrail.message };
  }

  const greetingAssembled = buildFullVoiceGreeting(
    greetingIntro,
    assistantDisplayName,
    greetingClosing,
  );
  if (greetingMissingDisclosure(greetingAssembled, assistantDisplayName)) {
    return {
      ok: false,
      message:
        "Callers must be told they're speaking to an AI and that calls may be recorded — we've kept that part in.",
    };
  }
  const greeting = ensureCompliantStoredGreeting({
    greeting: greetingAssembled,
    businessName,
    assistantDisplayName,
  });

  const businessHours = payload.businessHours;
  const open24_7 = payload.open24_7 === true;
  const hoursNote = String(payload?.hoursNote ?? "").trim().slice(0, 120);
  const bankHolidays = payload.bankHolidays;
  const openingHours = open24_7
    ? "Open 24 hours, 7 days a week"
    : weekScheduleHasOpenDay(businessHours)
      ? formatWeekScheduleForAgent(businessHours)
      : "Closed all week";
  const serviceArea = String(payload?.serviceArea ?? "").trim();
  const serviceAreaExclusions = String(payload?.serviceAreaExclusions ?? "").trim();
  const servicesDepartments = String(payload?.servicesDepartments ?? "").trim();
  const servicesNotOffered = String(payload?.servicesNotOffered ?? "").trim();
  const detailsToCollect = String(payload?.detailsToCollect ?? "").trim();
  const detailsCollectMode = parseDetailsCollectMode(payload?.detailsCollectMode);
  const businessRules = cleanBusinessRules(payload?.businessRules);
  const caraConduct = parseCaraConduct(payload?.caraConduct);
  const locationAddress = String(payload?.locationAddress ?? "").trim();
  const baseTown = normalizeBaseTown(String(payload?.baseTown ?? ""));
  const locationCounty = normalizeBaseTown(String(payload?.locationCounty ?? ""));
  let locationEircode = String(payload?.locationEircode ?? "").trim();
  const faqs = cleanAgentFaqs(payload?.faqs);

  if (locationEircode) {
    locationEircode = normalizeIrelandLocationQuery(locationEircode);
    if (!compactEircode(locationEircode)) {
      return {
        ok: false,
        message: "Enter a valid Eircode (e.g. D06 X2P6), or leave it blank.",
      };
    }
  }

  if (assistantDisplayName.length > MAX_ASSISTANT_NAME) {
    return { ok: false, message: "Caller-facing name is too long." };
  }
  if (greeting.length > MAX_GREETING) {
    return { ok: false, message: `Greeting is too long (max ${MAX_GREETING}).` };
  }
  if (openingHours.length > MAX_HOURS) {
    return { ok: false, message: "Opening hours text is too long." };
  }
  if (serviceArea.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Service area text is too long." };
  }
  if (serviceAreaExclusions.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Town exclusions text is too long." };
  }
  if (servicesDepartments.length > MAX_SERVICES_DEPARTMENTS) {
    return { ok: false, message: "Services and departments text is too long." };
  }
  if (servicesNotOffered.length > MAX_SERVICES_NOT_OFFERED) {
    return { ok: false, message: "What you don't offer text is too long." };
  }
  if (detailsToCollect.length > MAX_DETAILS_TO_COLLECT) {
    return { ok: false, message: "Details to collect text is too long." };
  }
  if (businessRules.length > MAX_BUSINESS_RULES) {
    return {
      ok: false,
      message: `Too many policies (max ${MAX_BUSINESS_RULES} including presets).`,
    };
  }
  const conductNote = caraConduct.additionalNote?.trim() ?? "";
  if (conductNote.length > MAX_CARA_CONDUCT_NOTE_LENGTH) {
    return { ok: false, message: "Style note is too long." };
  }
  const conductInjection = detectPromptInjectionViolation(conductNote);
  if (conductInjection) {
    return { ok: false, message: conductInjection.message };
  }
  for (const faq of faqs) {
    const injection = detectPromptInjectionViolation(
      `${faq.question} ${faq.answer}`,
    );
    if (injection) {
      return {
        ok: false,
        message: `FAQ "${faq.question.trim() || "entry"}" — ${injection.message}`,
      };
    }
  }
  if (locationAddress.length > MAX_LOCATION_ADDRESS) {
    return { ok: false, message: "Location address is too long." };
  }
  if (locationEircode.length > MAX_EIRCODE) {
    return { ok: false, message: "Eircode looks too long." };
  }
  if (baseTown.length > MAX_BASE_TOWN) {
    return { ok: false, message: "Town is too long." };
  }
  if (locationCounty.length > MAX_LOCATION_COUNTY) {
    return { ok: false, message: "County is too long." };
  }

  const { data: orgMeta } = await supabase
    .from("organizations")
    .select(
      "niche, quote_prices_on_calls, routing_links, fallback_number, agent_business_type",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const niche = String(orgMeta?.niche ?? "");
  const useCatalog = verticalPackForNiche(niche).capabilities.usesServiceCatalog;
  const serviceCatalog = useCatalog
    ? await listServicesForOrg(supabase, organizationId)
    : [];

  const pricingConflict = lintCatalogPricingVsRules(
    businessRules,
    serviceCatalog,
  )[0];
  if (pricingConflict) {
    return { ok: false, message: pricingConflict.message };
  }

  const knowledgeLintBlock = firstBlockingKnowledgeLint(
    snapshotFromLists({
      openingHours,
      serviceArea,
      servicesOffered: servicesDepartments,
      servicesNotOffered,
      businessRules,
      faqs,
      serviceCatalog,
    }),
    { surface: "dashboard" },
  );
  if (knowledgeLintBlock) {
    return { ok: false, message: knowledgeLintBlock.message };
  }

  const compileCheck = compileCaraPromptWithMeta({
    businessName,
    assistantDisplayName,
    businessType: String(orgMeta?.agent_business_type ?? "").trim(),
    locationAddress: locationAddress || undefined,
    baseTown: baseTown || undefined,
    locationCounty: locationCounty || undefined,
    locationEircode: locationEircode || undefined,
    businessRules,
    caraConduct,
    faqs: faqs.map((f) => ({ question: f.question, answer: f.answer })),
    quotePricesOnCalls: orgMeta?.quote_prices_on_calls === true,
    serviceCatalog: serviceCatalog.length > 0 ? serviceCatalog : undefined,
  });
  if (compileCheck.compileMeta.droppedFaqCount > 0) {
    return {
      ok: false,
      message: `Cara's instructions are too long — ${compileCheck.compileMeta.droppedFaqCount} FAQ${compileCheck.compileMeta.droppedFaqCount === 1 ? "" : "s"} would be left out of live calls. Shorten or remove FAQs before saving.`,
    };
  }

  const knowledgePatch = buildCaraAgentKnowledgeOrgUpdate({
    businessName,
    faqs,
    openingHours,
    businessHours: serializeBusinessHours(businessHours, {
      open24_7,
      hoursNote,
      bankHolidays: payload.bankHolidays,
    }),
    serviceArea,
    serviceAreaExclusions,
    servicesOffered: servicesDepartments,
    servicesNotOffered,
    detailsToCollect,
    detailsCollectMode,
    captureFields: payload.captureFields ?? [],
    businessRules,
    rawBusinessDescription: payload.rawBusinessDescription,
    rebuildKnowledgeSummary: false,
    clearOnboardingRawParagraphs: true,
  });
  if (!knowledgePatch.ok) return knowledgePatch;

  const update: Record<string, unknown> = {
    assistant_display_name: assistantDisplayName,
    greeting,
    agent_location_address: locationAddress || null,
    agent_location_eircode: locationEircode || null,
    agent_base_town: baseTown || null,
    agent_location_county: locationCounty || null,
    agent_service_area: serviceArea || null,
    agent_service_area_exclusions: serviceAreaExclusions || null,
    agent_cara_conduct: caraConduct,
    agent_cara_rules: [],
    ...knowledgePatch.update,
  };

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", organizationId);

  if (error) {
    if (
      isMissingPostgresColumn(error, "agent_cara_conduct") ||
      isMissingPostgresColumn(error, "agent_cara_rules")
    ) {
      return {
        ok: false,
        message: databaseUpdateRequiredMessage("agent_cara_conduct"),
      };
    }
    return { ok: false, message: error.message };
  }

  await regenerateCaraCustomPrompt(supabase, organizationId);

  await recordCaraKnowledgeEvent(supabase, {
    organizationId,
    eventType: "edited",
    title: "Knowledge updated in Business setup",
    source: "business_setup",
    actorId: user.id,
    payload: {
      faq_count: faqs.length,
      rule_count: businessRules.length,
    },
  });

  revalidateCaraSetup();
  return { ok: true };
}
