"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPermission } from "@/lib/admin-session";
import { adminPaymentsPlatformSpendPath } from "@/lib/admin-route-paths";
import {
  computeNextBillingDate,
  type PlatformBillingCycle,
  type PlatformVendorCostRow,
} from "@/lib/platform-spend";
import { syncAllPlatformSpendProviders } from "@/lib/platform-spend-sync";
import { createAdminClient } from "@/utils/supabase/admin";

const VENDOR_KEY_RE = /^[a-z0-9_-]{2,48}$/;

function parseAmountEuros(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  return Math.round(parsed * 100);
}

function parseBillingDay(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 28) {
    throw new Error("Billing day must be between 1 and 28.");
  }
  return parsed;
}

function parseBillingCycle(raw: FormDataEntryValue | null): PlatformBillingCycle {
  const value = String(raw ?? "").trim();
  if (value === "monthly" || value === "annual" || value === "usage") return value;
  throw new Error("Invalid billing cycle.");
}

async function assertAdmin() {
  await requireAdminPermission("billing");
}

function revalidatePlatformSpend() {
  revalidatePath(adminPaymentsPlatformSpendPath());
}

export async function refreshPlatformSpendApiData(): Promise<{
  ok: boolean;
  message: string;
}> {
  await assertAdmin();
  const admin = createAdminClient();
  const results = await syncAllPlatformSpendProviders();
  const errors: string[] = [];

  for (const result of results) {
    const patch: Record<string, unknown> = {
      last_synced_at: result.syncedAt,
      updated_at: new Date().toISOString(),
    };

    if (result.ok) {
      patch.last_synced_amount_cents = result.amountCents;
      patch.last_sync_error = null;
    } else {
      patch.last_sync_error = result.error;
      errors.push(`${result.vendorKey}: ${result.error}`);
    }

    const { error } = await admin
      .from("platform_vendor_costs")
      .update(patch)
      .eq("vendor_key", result.vendorKey);

    if (error) {
      errors.push(`${result.vendorKey}: ${error.message}`);
    }
  }

  revalidatePlatformSpend();

  if (errors.length > 0) {
    return {
      ok: false,
      message: errors.join(" · "),
    };
  }

  return { ok: true, message: "API spend refreshed." };
}

export async function upsertPlatformVendorCost(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const vendorKey = String(formData.get("vendor_key") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const billingCycle = parseBillingCycle(formData.get("billing_cycle"));
  const billingDay = parseBillingDay(formData.get("billing_day"));
  const amountCents =
    billingCycle === "usage" ? null : parseAmountEuros(formData.get("amount_eur"));
  const dashboardUrl = String(formData.get("dashboard_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  if (!displayName) {
    return { ok: false, message: "Display name is required." };
  }

  const admin = createAdminClient();
  const nextBillingDate = computeNextBillingDate(billingDay);
  const now = new Date().toISOString();

  if (id) {
    const { error } = await admin
      .from("platform_vendor_costs")
      .update({
        display_name: displayName,
        amount_cents: amountCents,
        billing_cycle: billingCycle,
        billing_day: billingDay,
        next_billing_date: nextBillingDate,
        dashboard_url: dashboardUrl,
        notes,
        active,
        updated_at: now,
      })
      .eq("id", id);

    if (error) return { ok: false, message: error.message };
    revalidatePlatformSpend();
    return { ok: true, message: "Vendor updated." };
  }

  if (!VENDOR_KEY_RE.test(vendorKey)) {
    return {
      ok: false,
      message: "Vendor key must be 2–48 lowercase letters, numbers, _ or -.",
    };
  }

  const { error } = await admin.from("platform_vendor_costs").insert({
    vendor_key: vendorKey,
    display_name: displayName,
    amount_cents: amountCents,
    billing_cycle: billingCycle,
    billing_day: billingDay,
    next_billing_date: nextBillingDate,
    dashboard_url: dashboardUrl,
    notes,
    active,
    source: "manual",
    api_provider: null,
    updated_at: now,
  });

  if (error) return { ok: false, message: error.message };
  revalidatePlatformSpend();
  return { ok: true, message: "Vendor added." };
}

export async function deletePlatformVendorCost(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing vendor id." };

  const admin = createAdminClient();
  const { data, error: loadError } = await admin
    .from("platform_vendor_costs")
    .select("source, api_provider")
    .eq("id", id)
    .maybeSingle();

  if (loadError) return { ok: false, message: loadError.message };
  if (!data) return { ok: false, message: "Vendor not found." };
  if (data.source === "api" || data.api_provider) {
    return {
      ok: false,
      message: "Built-in API vendors cannot be deleted. Deactivate instead.",
    };
  }

  const { error } = await admin.from("platform_vendor_costs").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePlatformSpend();
  return { ok: true, message: "Vendor removed." };
}

export type { PlatformVendorCostRow };
