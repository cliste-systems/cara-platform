"use server";

import { revalidatePath } from "next/cache";

import {
  createRouteFromTemplate,
  ensureAccountRoutes,
  isFallbackRoute,
  routeKeywords,
  routesFromStoredLinks,
  serializeRoutes,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { normalizeRoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-owner-copy";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { ROUTE_TEMPLATE_BY_ID } from "@/app/(dashboard)/dashboard/routing/route-templates";
import { isValidHttpUrl } from "@/app/(dashboard)/dashboard/routing/routing-validation";
import {
  bookingImportToCatalogDrafts,
  importBookingMenuFromUrl,
  type BookingMenuImportService,
} from "@/lib/booking-menu-import";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { buildCaraCapabilitiesFromPromptExtras } from "@/lib/call-handling-boundary";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { voiceNoteBlockForCatalogDrafts } from "@/lib/service-policy-presets";
import { requireOnboardingAdminSession, requireOnboardingSession } from "@/lib/onboarding-session";
import {
  catalogHasExtractedPrices,
  type ServiceCatalogDraft,
  type ServiceCatalogItem,
} from "@/lib/service-catalog-format";
import {
  deleteServiceForOrg,
  listServicesForOrg,
  replaceServiceCatalogForOrg,
  syncCatalogBoundaryForOrg,
  syncServiceNamesToBoundary,
  upsertServiceForOrg,
} from "@/lib/service-catalog";
import { verticalPackForNiche } from "@/lib/verticals";
import { createAdminClient } from "@/utils/supabase/admin";

const BOOKING_ROUTE_KEYWORDS = "book, booking, appointment, schedule";

export type OnboardingImportBookingMenuResult =
  | {
      ok: true;
      services: BookingMenuImportService[];
      bookingUrl: string;
      regulated: boolean;
      quality: "high" | "low";
      qualityMessage?: string;
      mergedCount: number;
    }
  | { ok: false; message: string };

export async function importBookingMenuForTrainCara(
  rawUrl: string,
): Promise<OnboardingImportBookingMenuResult> {
  await requireOnboardingAdminSession();
  const result = await importBookingMenuFromUrl(rawUrl);
  if (!result.ok) return result;
  return {
    ok: true,
    services: result.data.services,
    bookingUrl: result.data.bookingUrl,
    regulated: result.data.regulated,
    quality: result.data.quality,
    qualityMessage: result.data.qualityMessage,
    mergedCount: result.data.mergedCount,
  };
}

export type ApplyBookingMenuImportResult =
  | { ok: true; services: ServiceCatalogItem[]; servicesOffered: string }
  | { ok: false; message: string };

function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isValidHttpUrl(withScheme) ? withScheme : null;
}

function routingSummariesFromStoredLinks(
  links: unknown,
): RoutingActionSummary[] {
  const routes = routesFromStoredLinks(parseRoutingLinks(links ?? null));
  return routes
    .filter(
      (route) => route.active && !isFallbackRoute(route) && routeKeywords(route),
    )
    .map((route) => ({
      trigger: routeKeywords(route)!,
      action: "follow the saved route",
    }));
}

export async function applyBookingMenuImportForTrainCara(input: {
  services: BookingMenuImportService[];
  bookingUrl: string;
}): Promise<ApplyBookingMenuImportResult> {
  const session = await requireOnboardingAdminSession();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("niche, agent_business_type, routing_links, cara_handle_options")
    .eq("id", session.organizationId)
    .maybeSingle();

  if (!verticalPackForNiche(String(org?.niche ?? "")).capabilities.bookingMenuImport) {
    return { ok: false, message: "Booking menu import is only for salon businesses." };
  }

  try {
    const drafts = bookingImportToCatalogDrafts(input.services);
    const saved = await replaceServiceCatalogForOrg(
      admin,
      session.organizationId,
      drafts,
      {
        replaceExisting: true,
        source: "booking_import",
        importedAt: new Date().toISOString(),
      },
    );

    const quotePricesOnCalls = catalogHasExtractedPrices(saved);
    const orgUpdate: Record<string, unknown> = {
      quote_prices_on_calls: quotePricesOnCalls,
      agent_services_departments_raw: null,
      agent_service_catalog_supplement: null,
      updated_at: new Date().toISOString(),
    };

    const bookingUrl = normalizeLinkUrl(input.bookingUrl);
    if (bookingUrl) {
      const verticalCopy = dashboardVerticalCopy(
        String(org?.niche ?? ""),
        String(org?.agent_business_type ?? ""),
      );
      const template = ROUTE_TEMPLATE_BY_ID.get("booking-inquiry");
      if (template) {
        const routes = ensureAccountRoutes(
          routesFromStoredLinks(parseRoutingLinks(org?.routing_links ?? null)),
        );
        const existingIndex = routes.findIndex(
          (r) => r.templateId === "booking-inquiry",
        );
        const nextRoutes =
          existingIndex >= 0
            ? routes.map((route, i) =>
                i === existingIndex
                  ? {
                      ...route,
                      url: bookingUrl,
                      active: true,
                      keywords: BOOKING_ROUTE_KEYWORDS,
                      description: verticalCopy.routing.starterBookDescription,
                      name: route.name.trim() || "Book an appointment",
                    }
                  : route,
              )
            : ensureAccountRoutes([
                ...routes.filter((r) => r.templateId !== "booking-inquiry"),
                {
                  ...createRouteFromTemplate(template),
                  url: bookingUrl,
                  active: true,
                  keywords: BOOKING_ROUTE_KEYWORDS,
                  description: verticalCopy.routing.starterBookDescription,
                  name: "Book an appointment",
                },
              ]);
        orgUpdate.routing_links = serializeRoutes(nextRoutes).map((link) =>
          normalizeRoutingLink(link),
        );
        const handleOptions = Array.isArray(org?.cara_handle_options)
          ? (org.cara_handle_options as string[])
          : [];
        if (!handleOptions.includes("send_link")) {
          orgUpdate.cara_handle_options = [...handleOptions, "send_link"];
        }
      }
    }

    const { error } = await admin
      .from("organizations")
      .update(orgUpdate)
      .eq("id", session.organizationId);

    if (error) return { ok: false, message: error.message };

    await regenerateCaraCustomPrompt(admin, session.organizationId);
    revalidatePath("/onboarding/knowledge");

    return {
      ok: true,
      services: saved,
      servicesOffered: syncServiceNamesToBoundary(saved),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not save imported services.",
    };
  }
}

export async function loadTrainCaraServiceCatalog(): Promise<ServiceCatalogItem[]> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();
  return listServicesForOrg(admin, session.organizationId);
}

export type TrainCaraCatalogMutationResult =
  | { ok: true; services: ServiceCatalogItem[]; servicesOffered: string }
  | { ok: false; message: string };

async function assertSalonCatalogAccess(
  organizationId: string,
): Promise<
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      niche: string;
      routingLinks: unknown;
      fallbackNumber: string;
    }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("niche, routing_links, fallback_number")
    .eq("id", organizationId)
    .maybeSingle();

  if (!verticalPackForNiche(String(org?.niche ?? "")).capabilities.usesServiceCatalog) {
    return { ok: false, message: "Service catalog is only available for salon businesses." };
  }

  return {
    ok: true,
    admin,
    niche: String(org?.niche ?? ""),
    routingLinks: org?.routing_links ?? null,
    fallbackNumber: String(org?.fallback_number ?? ""),
  };
}

export async function upsertServiceCatalogItemForTrainCara(
  draft: ServiceCatalogDraft,
): Promise<TrainCaraCatalogMutationResult> {
  const session = await requireOnboardingAdminSession();
  const access = await assertSalonCatalogAccess(session.organizationId);
  if (!access.ok) return access;

  const caps = buildCaraCapabilitiesFromPromptExtras(
    routingSummariesFromStoredLinks(access.routingLinks),
    access.fallbackNumber,
  );
  const voiceNoteBlock = voiceNoteBlockForCatalogDrafts([draft], caps);
  if (voiceNoteBlock) {
    return { ok: false, message: voiceNoteBlock };
  }

  try {
    await upsertServiceForOrg(access.admin, session.organizationId, draft);
    await syncCatalogBoundaryForOrg(access.admin, session.organizationId);
    await regenerateCaraCustomPrompt(access.admin, session.organizationId);
    const services = await listServicesForOrg(access.admin, session.organizationId);
    revalidatePath("/onboarding/knowledge");
    return {
      ok: true,
      services,
      servicesOffered: syncServiceNamesToBoundary(services),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not save service.",
    };
  }
}

export async function deleteServiceCatalogItemForTrainCara(
  serviceId: string,
): Promise<TrainCaraCatalogMutationResult> {
  const session = await requireOnboardingAdminSession();
  const access = await assertSalonCatalogAccess(session.organizationId);
  if (!access.ok) return access;

  try {
    await deleteServiceForOrg(access.admin, session.organizationId, serviceId);
    await syncCatalogBoundaryForOrg(access.admin, session.organizationId);
    await regenerateCaraCustomPrompt(access.admin, session.organizationId);
    const services = await listServicesForOrg(access.admin, session.organizationId);
    revalidatePath("/onboarding/knowledge");
    return {
      ok: true,
      services,
      servicesOffered: syncServiceNamesToBoundary(services),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not delete service.",
    };
  }
}
