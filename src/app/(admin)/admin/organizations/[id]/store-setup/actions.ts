"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSessionUser } from "@/lib/admin-session";
import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  composeAdminGreeting,
  parseAdminGreetingParts,
} from "@/lib/admin-store-readiness";
import {
  serializeBusinessHours,
  type BankHolidayConfig,
  type WeekSchedule,
} from "@/lib/business-hours";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import {
  DIVERT_CARRIERS,
  RETAIL_BANNERS,
  STORE_CONTACT_ROLES,
  SUPERVALU_DEPARTMENT_PRESETS,
  type DivertCarrier,
  type RetailBanner,
  type StoreContactRole,
} from "@/lib/retail-store-types";
import { buildRetailRoutePack } from "@/lib/retail-route-pack";
import {
  buildRetailPromptExtras,
  loadStoreDepartments,
  loadStorePhoneSystem,
} from "@/lib/load-store-phone-system";
import { mergeRetailRoutingLinks } from "@/lib/sync-department-routes";
import {
  loadLatestSupervaluOfferSyncMeta,
  syncSupervaluNationalOffers,
} from "@/lib/supervalu-offers-sync";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionResult = { ok: true } | { ok: false; message: string };

function revalidateOrg(orgId: string) {
  revalidatePath(`/admin/organizations/${orgId}`);
}

async function adminClient() {
  await requireAdminSessionUser();
  return createAdminClient();
}

export async function saveStoreIdentity(
  organizationId: string,
  payload: {
    name: string;
    storeCode: string;
    retailBanner: RetailBanner;
    agentLocationAddress: string;
    agentLocationEircode: string;
    agentLocationCounty: string;
    timezone: string;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  if (!(RETAIL_BANNERS as readonly string[]).includes(payload.retailBanner)) {
    return { ok: false, message: "Select a retail banner." };
  }

  const admin = await adminClient();
  const address = payload.agentLocationAddress.trim();
  const eircode = payload.agentLocationEircode.trim();

  const { error } = await admin
    .from("organizations")
    .update({
      name: payload.name.trim(),
      store_code: payload.storeCode.trim() || null,
      retail_banner: payload.retailBanner,
      agent_location_address: address || null,
      agent_location_eircode: eircode || null,
      agent_location_county: payload.agentLocationCounty.trim() || null,
      address: address || null,
      storefront_eircode: eircode || null,
      timezone: payload.timezone.trim() || "Europe/Dublin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function saveStoreNumbersDivert(
  organizationId: string,
  payload: {
    storePublicNumber: string;
    callRoutingMode: CallRoutingMode;
    transferNumber: string;
    divertCarrier: DivertCarrier;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  if (!(DIVERT_CARRIERS as readonly string[]).includes(payload.divertCarrier)) {
    return { ok: false, message: "Select a divert carrier." };
  }

  const mode = parseCallRoutingMode(payload.callRoutingMode);
  const transfer = callRoutingAllowsHumanTransfer(mode)
    ? payload.transferNumber.trim()
    : "";

  const admin = await adminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      store_public_number: payload.storePublicNumber.trim() || null,
      call_routing_mode: mode,
      fallback_number: transfer || null,
      divert_carrier: payload.divertCarrier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function assignStoreClisteNumber(
  organizationId: string,
): Promise<{ ok: true; e164: string } | { ok: false; message: string }> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  await requireAdminSessionUser();
  const result = await provisionOrganizationPhoneNumber(organizationId);
  if (!result.ok) return result;
  revalidateOrg(organizationId);
  return result;
}

export async function markDivertVerified(
  organizationId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const user = await requireAdminSessionUser();
  const admin = await adminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await admin
    .from("organizations")
    .update({
      divert_verified_at: new Date().toISOString(),
      divert_verified_by: profile?.id ?? user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function saveStoreContact(
  organizationId: string,
  payload: {
    id?: string;
    name: string;
    role: StoreContactRole;
    phoneE164: string;
    email: string;
    isNotificationTarget: boolean;
    canReceiveTransfers: boolean;
    active: boolean;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  if (!(STORE_CONTACT_ROLES as readonly string[]).includes(payload.role)) {
    return { ok: false, message: "Invalid role." };
  }

  const admin = await adminClient();
  const row = {
    organization_id: organizationId,
    name: payload.name.trim(),
    role: payload.role,
    phone_e164: payload.phoneE164.trim() || null,
    email: payload.email.trim() || null,
    is_notification_target: payload.isNotificationTarget,
    can_receive_transfers: payload.canReceiveTransfers,
    active: payload.active,
    updated_at: new Date().toISOString(),
  };

  if (payload.id) {
    const { error } = await admin
      .from("store_contacts")
      .update(row)
      .eq("id", payload.id)
      .eq("organization_id", organizationId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await admin.from("store_contacts").insert(row);
    if (error) return { ok: false, message: error.message };
  }

  revalidateOrg(organizationId);
  return { ok: true };
}

export async function deleteStoreContact(
  organizationId: string,
  contactId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();
  const { error } = await admin
    .from("store_contacts")
    .delete()
    .eq("id", contactId)
    .eq("organization_id", organizationId);
  if (error) return { ok: false, message: error.message };
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function saveStoreDepartment(
  organizationId: string,
  payload: {
    id?: string;
    name: string;
    phoneE164: string;
    extension?: string;
    transferEnabled: boolean;
    caraNote: string;
    handlesText?: string;
    isOffLicence?: boolean;
    isAnPost?: boolean;
    sortOrder: number;
    active: boolean;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const row = {
    organization_id: organizationId,
    name: payload.name.trim(),
    phone_e164: payload.phoneE164.trim() || null,
    extension: payload.extension?.trim() || null,
    transfer_enabled: payload.transferEnabled,
    cara_note: payload.caraNote.trim() || null,
    handles_text: payload.handlesText?.trim() || null,
    is_off_licence: payload.isOffLicence === true,
    is_an_post: payload.isAnPost === true,
    sort_order: payload.sortOrder,
    active: payload.active,
    updated_at: new Date().toISOString(),
  };

  if (payload.id) {
    const { error } = await admin
      .from("store_departments")
      .update(row)
      .eq("id", payload.id)
      .eq("organization_id", organizationId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await admin.from("store_departments").insert(row);
    if (error) return { ok: false, message: error.message };
  }

  const { syncStoreDepartmentsToOrg } = await import("@/lib/sync-store-departments");
  const sync = await syncStoreDepartmentsToOrg(admin, organizationId);
  if (!sync.ok) return sync;
  await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function seedSupervaluDepartments(
  organizationId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const { data: existing } = await admin
    .from("store_departments")
    .select("name")
    .eq("organization_id", organizationId);

  const existingNames = new Set(
    (existing ?? []).map((d) => String(d.name).toLowerCase()),
  );

  const toInsert = SUPERVALU_DEPARTMENT_PRESETS.filter(
    (name) => !existingNames.has(name.toLowerCase()),
  ).map((name, index) => ({
    organization_id: organizationId,
    name,
    sort_order: index,
    transfer_enabled: true,
    active: true,
  }));

  if (toInsert.length > 0) {
    const { error } = await admin.from("store_departments").insert(toInsert);
    if (error) return { ok: false, message: error.message };
  }

  await syncStoreRoutingLinks(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

async function syncStoreRoutingLinks(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  organizationId: string,
) {
  const { data: org } = await admin
    .from("organizations")
    .select("routing_links, retail_click_collect_url, call_routing_mode")
    .eq("id", organizationId)
    .maybeSingle();

  const departments = await loadStoreDepartments(admin, organizationId);
  const phoneSystem = await loadStorePhoneSystem(admin, organizationId);
  const { capability } = buildRetailPromptExtras({
    callRoutingMode: parseCallRoutingMode(org?.call_routing_mode),
    phoneSystem,
    departments,
  });

  const merged = mergeRetailRoutingLinks({
    departments,
    existingLinks: org?.routing_links,
    clickCollectUrl: String(org?.retail_click_collect_url ?? ""),
    capability,
  });

  await admin
    .from("organizations")
    .update({
      routing_links: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  await regenerateCaraCustomPrompt(admin, organizationId);
}

export async function saveStoreFacts(
  organizationId: string,
  payload: {
    retailFacilities: string[];
    retailDelivery: {
      enabled?: boolean;
      area?: string;
      cut_off?: string;
      min_spend?: string;
    };
    retailClickCollectUrl: string;
    retailLoyaltyProgram: string;
    quotePricesOnCalls: boolean;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      retail_facilities: payload.retailFacilities,
      retail_delivery: payload.retailDelivery,
      retail_click_collect_url: payload.retailClickCollectUrl.trim() || null,
      retail_loyalty_program: payload.retailLoyaltyProgram.trim() || null,
      quote_prices_on_calls: payload.quotePricesOnCalls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  await syncStoreRoutingLinks(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function saveStoreOpeningHours(
  organizationId: string,
  payload: {
    schedule: WeekSchedule;
    open24_7: boolean;
    bankHolidays: BankHolidayConfig;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const bundle = serializeBusinessHours(payload.schedule, {
    open24_7: payload.open24_7,
    bankHolidays: payload.bankHolidays,
  });

  const { error } = await admin
    .from("organizations")
    .update({
      business_hours: bundle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function seedRetailRoutePack(
  organizationId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("retail_click_collect_url, call_routing_mode")
    .eq("id", organizationId)
    .maybeSingle();

  const pack = buildRetailRoutePack({
    clickCollectUrl: String(org?.retail_click_collect_url ?? ""),
  });

  await syncStoreRoutingLinks(admin, organizationId);

  const { data: refreshed } = await admin
    .from("organizations")
    .select("routing_links")
    .eq("id", organizationId)
    .maybeSingle();

  const departments = await loadStoreDepartments(admin, organizationId);
  const phoneSystem = await loadStorePhoneSystem(admin, organizationId);
  const { capability } = buildRetailPromptExtras({
    callRoutingMode: parseCallRoutingMode(org?.call_routing_mode),
    phoneSystem,
    departments,
  });

  const merged = mergeRetailRoutingLinks({
    departments,
    existingLinks: refreshed?.routing_links ?? pack,
    clickCollectUrl: String(org?.retail_click_collect_url ?? ""),
    capability,
  });

  const { error } = await admin
    .from("organizations")
    .update({ routing_links: merged.length ? merged : pack })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function saveStoreGreeting(
  organizationId: string,
  payload: {
    businessName: string;
    greetingIntro: string;
    greetingClosing: string;
    assistantDisplayName: string;
    agentVoiceId: string;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const greeting = composeAdminGreeting(
    {
      organizationId,
      name: payload.businessName,
      slug: "",
      niche: "retail",
      accountId: null,
      storeCode: "",
      retailBanner: "",
      agentLocationAddress: "",
      agentLocationEircode: "",
      agentLocationCounty: "",
      timezone: "",
      phoneNumber: "",
      storePublicNumber: "",
      callRoutingMode: "cliste_number",
      fallbackNumber: "",
      divertCarrier: "",
      divertVerifiedAt: null,
      retailFacilities: [],
      retailDelivery: {},
      retailClickCollectUrl: "",
      retailLoyaltyProgram: "",
      quotePricesOnCalls: false,
      greeting: "",
      customPrompt: "",
      promptCompileWarnings: [],
      assistantDisplayName: payload.assistantDisplayName,
      agentVoiceId: payload.agentVoiceId,
      isActive: true,
      caraOnlineSince: null,
      businessHours: null,
      agentOpeningHours: "",
      routingLinks: [],
      departments: [],
      contacts: [],
    },
    payload.greetingIntro,
    payload.greetingClosing,
  );

  const { error } = await admin
    .from("organizations")
    .update({
      greeting,
      assistant_display_name: payload.assistantDisplayName.trim() || "Cara",
      agent_voice_id: payload.agentVoiceId.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function recompileStorePrompt(
  organizationId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();
  const result = await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return result.ok ? { ok: true } : result;
}

export async function activateRetailStore(
  organizationId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      is_active: true,
      cara_online_since: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function saveStoreExtraNotes(
  organizationId: string,
  notes: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) return { ok: false, message: "Invalid id." };
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      agent_extra_notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  await regenerateCaraCustomPrompt(admin, organizationId);
  revalidateOrg(organizationId);
  return { ok: true };
}

export async function refreshSupervaluWeeklyOffers(): Promise<
  | {
      ok: true;
      queued?: boolean;
      offerCount: number;
      organizationsUpdated: number;
      syncedAt: string;
      offerWeekStart: string;
      offerWeekEnd: string;
    }
  | { ok: false; message: string }
> {
  await requireAdminSessionUser();
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Admin client unavailable",
    };
  }

  const result = await syncSupervaluNationalOffers(admin);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/customers");
  return {
    ok: true,
    queued: result.queued,
    offerCount: result.offerCount,
    organizationsUpdated: result.organizationsUpdated,
    syncedAt: result.syncedAt,
    offerWeekStart: result.offerWeekStart,
    offerWeekEnd: result.offerWeekEnd,
  };
}

export async function loadSupervaluWeeklyOffersAdminMeta(): Promise<{
  syncedAt: string | null;
  offerCount: number;
  offerWeekStart: string | null;
  offerWeekEnd: string | null;
}> {
  await requireAdminSessionUser();
  const admin = await adminClient();
  return loadLatestSupervaluOfferSyncMeta(admin);
}

export { parseAdminGreetingParts };
