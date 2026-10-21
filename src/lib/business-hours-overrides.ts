import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseBusinessHoursBundle,
  serializeBusinessHours,
  type WeekSchedule,
} from "@/lib/business-hours";

export type BusinessHoursOverrideRow = {
  id: string;
  organization_id: string;
  label: string;
  schedule: WeekSchedule;
  expires_at: string;
  created_at: string;
};

function isSchemaCacheError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("relation")
  );
}

export async function loadActiveBusinessHoursOverride(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BusinessHoursOverrideRow | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("business_hours_overrides")
    .select("id, organization_id, label, schedule, expires_at, created_at")
    .eq("organization_id", organizationId)
    .gt("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  const { schedule } = parseBusinessHoursBundle(data.schedule);
  return {
    id: String(data.id),
    organization_id: String(data.organization_id),
    label: String(data.label ?? ""),
    schedule,
    expires_at: String(data.expires_at),
    created_at: String(data.created_at),
  };
}

export async function loadBusinessHoursOverrides(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BusinessHoursOverrideRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("business_hours_overrides")
    .select("id, organization_id, label, schedule, expires_at, created_at")
    .eq("organization_id", organizationId)
    .gt("expires_at", now)
    .order("expires_at", { ascending: true });

  if (error) {
    if (isSchemaCacheError(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const { schedule } = parseBusinessHoursBundle(row.schedule);
    return {
      id: String(row.id),
      organization_id: String(row.organization_id),
      label: String(row.label ?? ""),
      schedule,
      expires_at: String(row.expires_at),
      created_at: String(row.created_at),
    };
  });
}

/** Merge an active temporary override into the org business_hours bundle for prompt compile. */
export function mergeHoursOverrideIntoBundle(
  businessHours: unknown,
  override: BusinessHoursOverrideRow | null,
): unknown {
  if (!override) return businessHours;
  const { meta } = parseBusinessHoursBundle(businessHours);
  return serializeBusinessHours(override.schedule, {
    ...meta,
    open24_7: meta.open24_7 === true,
    bankHolidays: meta.bankHolidays,
    hoursNote: override.label.trim() || meta.hoursNote,
  });
}
