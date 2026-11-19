import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  ensureFallbackRoute,
  routesFromStoredLinks,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  defaultBankHolidayConfig,
  emptyWeekSchedule,
  isBusinessHoursUnset,
  parseBusinessHoursBundle,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";
import { defaultBusinessDescription } from "@/lib/onboarding-business-type";
import { parseCaraGoal } from "@/lib/cara-goal";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { parseStoredLocation } from "@/lib/location-fields";
import { parsePlainTextOpeningHours } from "@/lib/parse-plain-text-hours";
import { listServicesForOrg } from "@/lib/service-catalog";
import { normalizeServiceAreaCountyItems } from "@/lib/service-area-boundary";
import { verticalPackForNiche } from "@/lib/verticals";
import { createClient } from "@/utils/supabase/server";

import { aboutTextForStep } from "./train-cara-about-text";
import { parseHandleOptions } from "./cara-handle-routes";
import {
  resolveTrainCaraStepIndex,
  shouldShowTrainCaraIntro,
} from "./train-cara-step-resume";
import { parseStoredOnboardingUiCopy } from "@/lib/onboarding-ui-copy";
import { resolveCaptureFieldsForOrg } from "@/lib/agent-capture-fields-backfill";
import { sanitizeServicesOfferedRaw } from "@/lib/service-offered-raw";
import { TrainCaraFlow } from "./train-cara-flow";

export const dynamic = "force-dynamic";

export default async function OnboardingKnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string | string[] }>;
}) {
  const session = await requireOnboardingSession();

  guardOnboardingPage(session, "/onboarding/knowledge");

  const params = (await searchParams) ?? {};
  const urlStepId = Array.isArray(params.step) ? params.step[0] : params.step;

  const supabase = await createClient();
  const [{ data: org }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, address, storefront_eircode, niche, agent_business_type, agent_location_address, agent_base_town, agent_location_county, agent_location_eircode, raw_business_description, business_knowledge_summary, business_hours, agent_opening_hours, agent_service_area, agent_services_departments, agent_services_departments_raw, agent_services_not_offered, agent_services_not_offered_raw, agent_details_to_collect, agent_faqs, agent_capture_fields, cara_handle_options, cara_goal, routing_links, fallback_number, notification_email, notification_phone, onboarding_ui_copy, train_cara_step",
      )
      .eq("id", session.organizationId)
      .maybeSingle(),
  ]);

  const niche = (org?.niche as string | null) ?? "";
  const handleOptions = parseHandleOptions(org?.cara_handle_options);
  const storedLinks = parseRoutingLinks(
    (org?.routing_links as unknown) ?? null,
  );
  const verticalPack = verticalPackForNiche(niche);
  const routes = ensureFallbackRoute(
    storedLinks.length > 0 ? routesFromStoredLinks(storedLinks) : [],
  );

  const preferredTemplate = verticalPack.capabilities.defaultRouteTemplate;
  const preferredLink = routes.find(
    (route) => route.templateId === preferredTemplate && route.url.trim(),
  );
  const linkUrl =
    preferredLink?.url.trim() ||
    routes.find((r) => r.outcome === "send_link")?.url?.trim() ||
    "";
  const whatsappContact =
    routes.find((r) => r.outcome === "whatsapp")?.whatsapp ?? "";
  const routeEmail = routes.find((r) => r.outcome === "email")?.email ?? "";
  const transferPhone = (org?.fallback_number as string | null) ?? "";

  const about = aboutTextForStep(
    (org?.raw_business_description as string | null) ?? "",
  );

  const classifiedBusinessType = defaultBusinessDescription({
    niche: (org?.niche as string | null) ?? null,
    agentBusinessType: (org?.agent_business_type as string | null) ?? null,
  });
  const servicesOffered =
    (org?.agent_services_departments as string | null) ?? "";
  const servicesOfferedRaw =
    (org?.agent_services_departments_raw as string | null)?.trim() ?? "";
  const servicesNotOffered =
    (org?.agent_services_not_offered as string | null) ?? "";
  const servicesNotOfferedRaw =
    (org?.agent_services_not_offered_raw as string | null)?.trim() ?? "";
  const openingHoursLegacy = (org?.agent_opening_hours as string | null) ?? "";
  const serviceArea = (org?.agent_service_area as string | null) ?? "";
  const hoursUnset = isBusinessHoursUnset(org?.business_hours);
  const hoursBundle = hoursUnset
    ? { schedule: emptyWeekSchedule(), meta: {} }
    : parseBusinessHoursBundle(org?.business_hours);

  let openingHoursSchedule = hoursBundle.schedule;
  let open24_7 = hoursBundle.meta.open24_7 === true;
  const bankHolidays =
    hoursBundle.meta.bankHolidays ?? defaultBankHolidayConfig();
  let hoursNeverConfigured = hoursUnset;

  if (hoursUnset && openingHoursLegacy.trim()) {
    const parsed = parsePlainTextOpeningHours(openingHoursLegacy);
    if (parsed) {
      openingHoursSchedule = parsed.schedule;
      open24_7 = /\bopen\s*24\s*\/\s*7\b/i.test(openingHoursLegacy);
      hoursNeverConfigured = false;
    }
  }

  const location = parseStoredLocation({
    address:
      (org?.agent_location_address as string | null)?.trim() ||
      (org?.address as string | null)?.trim() ||
      "",
    baseTown: (org?.agent_base_town as string | null)?.trim() ?? "",
    county: (org?.agent_location_county as string | null)?.trim() ?? "",
  });
  const locationEircode =
    (org?.agent_location_eircode as string | null)?.trim() ||
    (org?.storefront_eircode as string | null)?.trim() ||
    "";
  const serviceAreaItems = normalizeServiceAreaCountyItems(
    parseAgentKnowledgeList(serviceArea),
  );
  const hoursPrefilled =
    Boolean(openingHoursLegacy.trim()) ||
    (!hoursUnset && weekScheduleHasOpenDay(openingHoursSchedule));
  const locationPrefilled = Boolean(
    location.street.trim() ||
      location.town.trim() ||
      location.county.trim() ||
      locationEircode.trim(),
  );
  const caraGoal = parseCaraGoal(org?.cara_goal);
  const detailsToCollect =
    (org?.agent_details_to_collect as string | null)?.trim() ?? "";
  const captureFields = resolveCaptureFieldsForOrg({
    rawFields: org?.agent_capture_fields,
    detailsText: detailsToCollect,
    businessType: classifiedBusinessType,
    niche,
    caraGoal,
  });
  const faqs = parseAgentFaqs(org?.agent_faqs);
  const onboardingUiCopy = parseStoredOnboardingUiCopy(org?.onboarding_ui_copy);

  const savedStepId = (org?.train_cara_step as string | null) ?? null;

  const showIntro = shouldShowTrainCaraIntro({ savedStepId });

  const initialStepIndex = resolveTrainCaraStepIndex({
    urlStepId,
    savedStepId,
  });

  const serviceCatalog = verticalPack.capabilities.usesServiceCatalog
    ? await listServicesForOrg(supabase, session.organizationId)
    : [];

  const servicesOfferedRawForStep =
    serviceCatalog.length > 0
      ? sanitizeServicesOfferedRaw({
          raw: servicesOfferedRaw,
          catalogNames: serviceCatalog.map((item) => item.name),
          offeredChips: servicesOffered,
        })
      : servicesOfferedRaw;

  return (
    <OnboardingStepShell variant="training" contentOnly>
      <TrainCaraFlow
        initial={{
          businessName: (org?.name as string | null) ?? "",
          about,
          servicesOffered,
          servicesOfferedRaw: servicesOfferedRawForStep,
          servicesNotOffered,
          servicesNotOfferedRaw,
          openingHoursSchedule,
          open24_7,
          bankHolidays,
          hoursNeverConfigured,
          locationAddress: location.street,
          baseTown: location.town,
          locationCounty: location.county,
          locationEircode,
          serviceAreaItems,
          hoursPrefilled,
          locationPrefilled,
          captureFields,
          faqs,
          businessType: classifiedBusinessType,
          niche,
          caraGoal,
          serviceCatalog,
          handleOptions,
          routes,
          linkLabel: "",
          linkUrl,
          emailAddress:
            routeEmail || ((org?.notification_email as string | null) ?? ""),
          whatsappContact,
          meetingLink: "",
          transferPhone,
          onboardingUiCopy,
          showIntro,
          initialStepIndex,
        }}
      />
    </OnboardingStepShell>
  );
}
