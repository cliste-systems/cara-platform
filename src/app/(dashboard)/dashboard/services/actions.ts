"use server";
import { revalidatePath } from "next/cache";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { listServicesForOrg } from "@/lib/service-catalog";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { serviceDetails, validateService } from "@/lib/service-details";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import { AGENT_CONFIG_REVALIDATE_PATHS } from "@/lib/dashboard-routes";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
import { sanitizePromptFreeText } from "@/lib/service-policy-presets";

export async function publishServices(input: {
  version: string;
  service?: ServiceCatalogItem;
  excluded?: string;
  quotePrices?: boolean;
}) {
  const { supabase, organizationId } = await requireDashboardAdmin();
  try {
    const { data: org, error } = await supabase
      .from("organizations")
      .select(
        "updated_at,niche,agent_services_not_offered,quote_prices_on_calls",
      )
      .eq("id", organizationId)
      .single();
    if (error || !org) throw error;
    if (org.niche === "retail")
      return {
        ok: false as const,
        message: "Use the retail catalogue for this business.",
      };
    if (org.updated_at !== input.version)
      return {
        ok: false as const,
        message:
          "Business information changed in another tab. Reload this page before saving. Your draft is still here.",
      };
    const services = await listServicesForOrg(supabase, organizationId);
    if (input.service) {
      const draft = input.service;
      const validation = validateService(draft);
      if (validation) return { ok: false as const, message: validation };
      const unsafe = detectPromptInjectionViolation(
        [
          draft.name,
          draft.category,
          draft.description,
          draft.aiVoiceNotes,
          draft.details?.priceNotes,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (unsafe) return { ok: false as const, message: unsafe.message };
      const existing = services.find((s) => s.id === draft.id);
      if (!existing && services.length >= 120)
        return {
          ok: false as const,
          message:
            "Your catalogue is full. Contact us for help adding more services.",
        };
      if (
        services.some(
          (s) =>
            s.id !== draft.id &&
            s.details?.status !== "archived" &&
            s.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
        )
      )
        return {
          ok: false as const,
          message:
            "A service with this name already exists. Edit the existing service instead.",
        };
      const clean: ServiceCatalogItem = {
        ...draft,
        name: sanitizePromptFreeText(draft.name.trim()),
        category: draft.category?.trim().slice(0, 80) || null,
        description: sanitizePromptFreeText(draft.description ?? ""),
        aiVoiceNotes: sanitizePromptFreeText(draft.aiVoiceNotes ?? ""),
        source: existing?.source ?? "manual",
        policyFlags: existing?.policyFlags ?? [],
        details: {
          ...serviceDetails(draft),
          priceNotes: sanitizePromptFreeText(draft.details?.priceNotes ?? ""),
        },
      };
      const i = services.findIndex((s) => s.id === draft.id);
      if (i < 0) services.push(clean);
      else services[i] = clean;
    }
    const excluded = parseAgentKnowledgeList(
      input.excluded ?? org.agent_services_not_offered ?? "",
    ).join("\n");
    if (excluded.length > 6000)
      return {
        ok: false as const,
        message: "Keep the exclusions list under 6,000 characters.",
      };
    const unsafeExclusions = detectPromptInjectionViolation(excluded);
    if (unsafeExclusions)
      return { ok: false as const, message: unsafeExclusions.message };
    const excludedNames = new Set(
      parseAgentKnowledgeList(excluded).map((s) => s.toLowerCase()),
    );
    if (
      services.some(
        (s) =>
          serviceDetails(s).status !== "archived" &&
          excludedNames.has(s.name.toLowerCase()),
      )
    )
      return {
        ok: false as const,
        message:
          "A service is listed both in your catalogue and exclusions. Archive that service or remove the exclusion before saving.",
      };
    const quote = input.quotePrices ?? org.quote_prices_on_calls ?? true;
    const boundary = services
      .filter((s) => serviceDetails(s).status !== "archived")
      .map((s) => s.name)
      .join("\n");
    const compiled = await regenerateCaraCustomPrompt(
      supabase,
      organizationId,
      {
        dryRun: true,
        services,
        orgPatch: {
          agent_services_departments: boundary,
          agent_services_not_offered: excluded,
          quote_prices_on_calls: quote,
        },
      },
    );
    if (!compiled.ok || !compiled.prompt)
      return {
        ok: false as const,
        message: compiled.ok
          ? "Cara’s call information could not be updated. Please try again."
          : compiled.message,
      };
    const { data: version, error: saveError } = await supabase.rpc(
      "publish_service_catalog",
      {
        p_organization_id: organizationId,
        p_expected_updated_at: input.version,
        p_services: services,
        p_excluded: excluded,
        p_quote_prices: quote,
        p_prompt: compiled.prompt,
        p_warnings: compiled.warnings ?? null,
      },
    );
    if (saveError)
      console.error(
        "Service publish failed",
        saveError.code,
        saveError.message,
      );
    if (saveError)
      return {
        ok: false as const,
        message:
          saveError.code === "40001"
            ? "Business information changed in another tab. Reload before saving. Your draft is still here."
            : "We couldn’t update your services. Your current call information is unchanged. Please try again.",
      };
    for (const path of [
      ...AGENT_CONFIG_REVALIDATE_PATHS,
      "/dashboard/services",
      "/dashboard",
    ])
      revalidatePath(path);
    return {
      ok: true as const,
      services,
      version: String(version),
      excluded,
      quotePrices: quote,
    };
  } catch (error) {
    console.error("publish services", error);
    return {
      ok: false as const,
      message:
        "We couldn’t update your services. Please try again. Your draft is still here.",
    };
  }
}
