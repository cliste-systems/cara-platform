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
  bookingImportToCatalogDraftsWithStats,
  importBookingMenuFromUrl,
  type BookingMenuImportService,
} from "@/lib/booking-menu-import";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { AGENT_CONFIG_REVALIDATE_PATHS } from "@/lib/dashboard-routes";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import {
  buildCaraCapabilitiesFromPromptExtras,
  lintCatalogPricingVsRules,
} from "@/lib/call-handling-boundary";
import { voiceNoteBlockForCatalogDrafts } from "@/lib/service-policy-presets";
import {
  catalogHasExtractedPrices,
  resolveQuotePricesOnCalls,
  type ServiceCatalogDraft,
  type ServiceCatalogItem,
} from "@/lib/service-catalog-format";
import {
  deleteServiceForOrg,
  listServicesForOrg,
  replaceServiceCatalogForOrg,
  syncCatalogBoundaryForOrg,
  upsertServiceForOrg,
} from "@/lib/service-catalog";
import { verticalPackForNiche } from "@/lib/verticals";

const BOOKING_ROUTE_KEYWORDS = "book, booking, appointment, schedule";

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

function revalidateServiceCatalog() {
  for (const path of AGENT_CONFIG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isValidHttpUrl(withScheme) ? withScheme : null;
}

function upsertBookingLinkInRouting(
  routingLinks: ReturnType<typeof parseRoutingLinks>,
  url: string,
  niche: string | null,
  businessType: string | null,
) {
  const verticalCopy = dashboardVerticalCopy(niche, businessType);
  const template = ROUTE_TEMPLATE_BY_ID.get("booking-inquiry");
  if (!template) return routingLinks;

  const routes = ensureAccountRoutes(routesFromStoredLinks(routingLinks));
  const existingIndex = routes.findIndex((r) => r.templateId === "booking-inquiry");
  const nextRoutes =
    existingIndex >= 0
      ? routes.map((route, i) =>
          i === existingIndex
            ? {
                ...route,
                url,
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
            url,
            active: true,
            keywords: BOOKING_ROUTE_KEYWORDS,
            description: verticalCopy.routing.starterBookDescription,
            name: "Book an appointment",
          },
        ]);

  return serializeRoutes(nextRoutes).map((link) => normalizeRoutingLink(link));
}

export type ImportBookingMenuResult =
  | {
      ok: true;
      services: BookingMenuImportService[];
      drafts: ServiceCatalogDraft[];
      bookingUrl: string;
      regulated: boolean;
      mergedCount: number;
    }
  | { ok: false; message: string };

export async function importBookingMenuForServices(
  rawUrl: string,
): Promise<ImportBookingMenuResult> {
  await requireDashboardAdmin();
  const result = await importBookingMenuFromUrl(rawUrl);
  if (!result.ok) return result;
  const services = result.data.services;
  const { drafts, mergedCount } = bookingImportToCatalogDraftsWithStats(services);
  return {
    ok: true,
    services,
    drafts,
    bookingUrl: result.data.bookingUrl,
    regulated: result.data.regulated,
    mergedCount,
  };
}

export type SaveServiceCatalogPayload = {
  services: ServiceCatalogDraft[];
  replaceExisting?: boolean;
  bookingUrl?: string;
  importSource?: "booking_import" | "manual";
};

export type SaveServiceCatalogResult =
  | { ok: true; services: ServiceCatalogItem[] }
  | { ok: false; message: string };

export async function saveServiceCatalog(
  payload: SaveServiceCatalogPayload,
): Promise<SaveServiceCatalogResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: org } = await supabase
    .from("organizations")
    .select("niche, agent_business_type, routing_links, cara_handle_options, fallback_number")
    .eq("id", organizationId)
    .maybeSingle();

  if (!verticalPackForNiche(String(org?.niche ?? "")).capabilities.usesServiceCatalog) {
    return { ok: false, message: "Service catalog is only available for salon businesses." };
  }

  const caps = buildCaraCapabilitiesFromPromptExtras(
    routingSummariesFromStoredLinks(org?.routing_links),
    String(org?.fallback_number ?? ""),
  );
  const voiceNoteBlock = voiceNoteBlockForCatalogDrafts(payload.services, caps);
  if (voiceNoteBlock) {
    return { ok: false, message: voiceNoteBlock };
  }

  try {
    const services = await replaceServiceCatalogForOrg(
      supabase,
      organizationId,
      payload.services,
      {
        replaceExisting: payload.replaceExisting === true,
        source: payload.importSource ?? "manual",
        importedAt:
          payload.importSource === "booking_import"
            ? new Date().toISOString()
            : undefined,
      },
    );

    const quotePricesOnCalls = resolveQuotePricesOnCalls(
      services,
      (
        await supabase
          .from("organizations")
          .select("quote_prices_on_calls")
          .eq("id", organizationId)
          .maybeSingle()
      ).data?.quote_prices_on_calls,
    );

    const businessRules = parseAgentBusinessRules(
      (
        await supabase
          .from("organizations")
          .select("agent_business_rules")
          .eq("id", organizationId)
          .maybeSingle()
      ).data?.agent_business_rules,
    );
    const pricingConflict = lintCatalogPricingVsRules(
      businessRules,
      services,
    )[0];
    if (pricingConflict) {
      return { ok: false, message: pricingConflict.message };
    }

    const orgUpdate: Record<string, unknown> = {
      quote_prices_on_calls: quotePricesOnCalls,
      updated_at: new Date().toISOString(),
    };

    const bookingUrl = normalizeLinkUrl(String(payload.bookingUrl ?? ""));
    if (bookingUrl) {
      orgUpdate.routing_links = upsertBookingLinkInRouting(
        parseRoutingLinks(org?.routing_links ?? null),
        bookingUrl,
        String(org?.niche ?? ""),
        String(org?.agent_business_type ?? ""),
      );
      const handleOptions = Array.isArray(org?.cara_handle_options)
        ? (org.cara_handle_options as string[])
        : [];
      if (!handleOptions.includes("send_link")) {
        orgUpdate.cara_handle_options = [...handleOptions, "send_link"];
      }
    }

    const { error: orgError } = await supabase
      .from("organizations")
      .update(orgUpdate)
      .eq("id", organizationId);

    if (orgError) return { ok: false, message: orgError.message };

    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateServiceCatalog();
    return { ok: true, services };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not save services.",
    };
  }
}

export async function upsertServiceCatalogItem(
  draft: ServiceCatalogDraft,
): Promise<SaveServiceCatalogResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: org } = await supabase
    .from("organizations")
    .select("niche, routing_links, fallback_number")
    .eq("id", organizationId)
    .maybeSingle();

  if (!verticalPackForNiche(String(org?.niche ?? "")).capabilities.usesServiceCatalog) {
    return { ok: false, message: "Service catalog is only available for salon businesses." };
  }

  const caps = buildCaraCapabilitiesFromPromptExtras(
    routingSummariesFromStoredLinks(org?.routing_links),
    String(org?.fallback_number ?? ""),
  );
  const voiceNoteBlock = voiceNoteBlockForCatalogDrafts([draft], caps);
  if (voiceNoteBlock) {
    return { ok: false, message: voiceNoteBlock };
  }

  try {
    await upsertServiceForOrg(supabase, organizationId, draft);
    await syncCatalogBoundaryForOrg(supabase, organizationId);
    await regenerateCaraCustomPrompt(supabase, organizationId);
    const services = await listServicesForOrg(supabase, organizationId);
    revalidateServiceCatalog();
    return { ok: true, services };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not save service.",
    };
  }
}

export async function deleteServiceCatalogItem(
  serviceId: string,
): Promise<SaveServiceCatalogResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  try {
    await deleteServiceForOrg(supabase, organizationId, serviceId);
    await syncCatalogBoundaryForOrg(supabase, organizationId);
    await regenerateCaraCustomPrompt(supabase, organizationId);
    const services = await listServicesForOrg(supabase, organizationId);
    revalidateServiceCatalog();
    return { ok: true, services };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not delete service.",
    };
  }
}

export async function updateQuotePricesOnCalls(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardAdmin();
  const services = await listServicesForOrg(supabase, organizationId);

  if (enabled && !catalogHasExtractedPrices(services)) {
    return {
      ok: false,
      message: "Add prices to your service menu before enabling phone quotes.",
    };
  }

  const businessRules = parseAgentBusinessRules(
    (
      await supabase
        .from("organizations")
        .select("agent_business_rules")
        .eq("id", organizationId)
        .maybeSingle()
    ).data?.agent_business_rules,
  );
  if (enabled) {
    const conflict = lintCatalogPricingVsRules(businessRules, services)[0];
    if (conflict) {
      return { ok: false, message: conflict.message };
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      quote_prices_on_calls: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  await regenerateCaraCustomPrompt(supabase, organizationId);
  revalidateServiceCatalog();
  return { ok: true };
}
