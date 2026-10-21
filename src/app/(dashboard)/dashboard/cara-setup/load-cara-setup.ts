import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { parseAgentCaraRules } from "@/lib/agent-cara-rules";
import { parseCaraConduct, inferCaraConductFromLegacyRules } from "@/lib/agent-cara-conduct";
import {
  emptyWeekSchedule,
  isBusinessHoursUnset,
  defaultBankHolidayConfig,
  parseBusinessHoursBundle,
} from "@/lib/business-hours";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { buildCaraSetupPromptInputFromOrg } from "@/lib/cara-prompt-from-org";
import { listServicesForOrg } from "@/lib/service-catalog";
import { parseStoredLocation } from "@/lib/location-fields";
import { normalizeServiceAreaCountyItems } from "@/lib/service-area-boundary";
import { parseDetailsCollectMode } from "@/lib/details-collect-mode";
import { recoverHoursNoteFromSources } from "@/lib/parse-plain-text-hours";
import { parseStoredServiceCatalogSupplement } from "@/lib/service-catalog-supplement";
import { verticalIdForNiche, verticalPackForNiche } from "@/lib/verticals";
import { assistantNameLabel, VOICE_ASSISTANT_DEFAULT_NAME } from "@/lib/voice-greeting";
import { resolveCaptureFieldsForOrg } from "@/lib/agent-capture-fields-backfill";
import { detailLabelsFromCaptureFields } from "@/lib/sync-capture-fields";
import { parseCaraGoal } from "@/lib/cara-goal";

import { listBusinessFiles } from "../agent-setup/business-files-actions";
import { parseAgentFaqs } from "../agent-setup/agent-faqs";
import type { AgentSetupInitial } from "../agent-setup/agent-setup-helpers";
import type { BusinessFileListItem } from "@/lib/business-files";

import type { CaraSetupPromptInput } from "@/lib/compile-cara-prompt";

export type CaraSetupPageData = {
  initial: AgentSetupInitial;
  businessFiles: BusinessFileListItem[];
  /** Routing + transfer fields for prompt preview (from Call Flow). */
  promptExtras: Pick<
    CaraSetupPromptInput,
    "routes" | "fallbackNote" | "transferNumber" | "businessScope"
  >;
};

export async function loadCaraSetupPageData(): Promise<CaraSetupPageData> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, address, storefront_eircode, niche, phone_number, quote_prices_on_calls, assistant_display_name, greeting, custom_prompt, business_classification, agent_business_type, agent_faqs, agent_opening_hours, agent_service_area, agent_service_area_exclusions, agent_base_town, agent_services_departments, agent_services_not_offered, agent_service_catalog_supplement, agent_details_to_collect, agent_details_collect_mode, agent_capture_fields, agent_business_rules, agent_cara_rules, agent_cara_conduct, agent_location_address, agent_location_eircode, agent_location_county, business_hours, business_knowledge_summary, raw_business_description, cara_goal, routing_links, fallback_number, call_routing_mode, prompt_compile_warnings",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const assistant = assistantNameLabel(
    String(org?.assistant_display_name ?? "").trim() ||
      VOICE_ASSISTANT_DEFAULT_NAME,
  );

  const businessFiles = await listBusinessFiles();
  const hoursUnset = isBusinessHoursUnset(org?.business_hours);
  const hoursBundle = hoursUnset
    ? { schedule: emptyWeekSchedule(), meta: {} }
    : parseBusinessHoursBundle(org?.business_hours);

  const servicesOffered = (org?.agent_services_departments as string | null) ?? "";
  const servicesNotOffered =
    (org?.agent_services_not_offered as string | null) ?? "";
  const openingHoursLegacy = (org?.agent_opening_hours as string | null) ?? "";
  const serviceArea = (org?.agent_service_area as string | null) ?? "";
  const serviceAreaExclusions =
    (org?.agent_service_area_exclusions as string | null) ?? "";
  const faqs = parseAgentFaqs(org?.agent_faqs);
  const businessType = (org?.agent_business_type as string | null) ?? "";
  const businessRules = parseAgentBusinessRules(org?.agent_business_rules);
  const caraRules = parseAgentCaraRules(org?.agent_cara_rules);
  const caraConduct =
    org?.agent_cara_conduct != null
      ? parseCaraConduct(org.agent_cara_conduct)
      : inferCaraConductFromLegacyRules(caraRules);
  const niche = String((org?.niche as string | null) ?? "");
  const caraGoal = parseCaraGoal(org?.cara_goal);
  const detailsText = (org?.agent_details_to_collect as string | null) ?? "";
  const captureFields = resolveCaptureFieldsForOrg({
    rawFields: org?.agent_capture_fields,
    detailsText,
    businessType,
    niche,
    caraGoal,
  });

  const promptFromOrg = buildCaraSetupPromptInputFromOrg(org);

  const verticalId = verticalIdForNiche(niche);
  const serviceCatalog = await listServicesForOrg(supabase, organizationId);
  const serviceCatalogSupplement = parseStoredServiceCatalogSupplement(
    org?.agent_service_catalog_supplement,
  );
  const useSalonCatalog =
    verticalPackForNiche(niche).capabilities.usesServiceCatalog ||
    serviceCatalog.length > 0;
  return {
    businessFiles,
    promptExtras: {
      businessScope: promptFromOrg.businessScope,
      routes: promptFromOrg.routes,
      fallbackNote: promptFromOrg.fallbackNote,
      transferNumber: promptFromOrg.transferNumber,
    },
    initial: {
      businessName: (org?.name as string | null) ?? "",
      assistantDisplayName: assistant,
      greeting: (org?.greeting as string | null) ?? "",
      businessType,
      niche,
      verticalId,
      faqs,
      openingHoursSchedule: hoursBundle.schedule,
      openingHoursLegacy: hoursUnset ? openingHoursLegacy : "",
      hoursNeverConfigured: hoursUnset,
      open24_7: hoursBundle.meta.open24_7 === true,
      hoursNote: recoverHoursNoteFromSources(
        hoursBundle.meta.hoursNote,
        openingHoursLegacy,
        businessRules,
      ),
      bankHolidays:
        hoursBundle.meta.bankHolidays ?? defaultBankHolidayConfig(),
      serviceAreaItems: normalizeServiceAreaCountyItems(
        parseAgentKnowledgeList(serviceArea),
      ),
      serviceAreaExclusionItems: parseAgentKnowledgeList(serviceAreaExclusions),
      servicesItems: useSalonCatalog
        ? serviceCatalog.map((s) => s.name)
        : parseAgentKnowledgeList(servicesOffered),
      servicesNotOfferedItems: parseAgentKnowledgeList(servicesNotOffered),
      serviceCatalog: useSalonCatalog ? serviceCatalog : [],
      serviceCatalogSupplement: serviceCatalogSupplement ?? undefined,
      detailsToCollectItems: detailLabelsFromCaptureFields(captureFields),
      detailsCollectMode: parseDetailsCollectMode(org?.agent_details_collect_mode),
      businessRules,
      caraRules,
      caraConduct,
      captureFields,
      rawBusinessDescription:
        (org?.raw_business_description as string | null)?.trim() ?? "",
      ...(() => {
        const loc = parseStoredLocation({
          address:
            (org?.agent_location_address as string | null)?.trim() ||
            (org?.address as string | null)?.trim() ||
            "",
          baseTown: (org?.agent_base_town as string | null)?.trim() ?? "",
          county: (org?.agent_location_county as string | null)?.trim() ?? "",
        });
        return {
          locationAddress: loc.street,
          baseTown: loc.town,
          locationCounty: loc.county,
        };
      })(),
      locationEircode:
        (org?.agent_location_eircode as string | null)?.trim() ||
        (org?.storefront_eircode as string | null)?.trim() ||
        "",
      quotePricesOnCalls: org?.quote_prices_on_calls === true,
      clistePhoneNumber: String(org?.phone_number ?? "").trim(),
    },
  };
}
