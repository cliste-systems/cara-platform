"use server";
import { headers } from "next/headers";
import { buildSecurityEventContext, logSecurityEvent } from "@/lib/security-events";
import { revalidatePath } from "next/cache";
import { requireAdminPermission, requireAdminStaffContext } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { clientSlug } from "@/lib/admin-client-account";

export async function saveBillingOrganisation(form: FormData): Promise<{ ok: boolean; message: string }> {
  await requireAdminPermission("customers");
  await requireAdminPermission("billing");
  const staff = await requireAdminStaffContext();
  const field = (key: string) => String(form.get(key) ?? "").trim();
  const name = field("name"), email = field("email").toLowerCase(), address = field("address");
  if (!name || name.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !address || address.length > 2000) return { ok: false, message: "Enter the legal name, invoice email and billing address." };
  const id = field("id");
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { ok: false, message: "Invalid organisation." };
  if (field("contact").length > 200 || field("vat").length > 64) return { ok: false, message: "The billing contact or VAT number is too long." };
  const admin = createAdminClient();
  const values = { name, billing_email: email, billing_address: address, billing_contact_name: field("contact") || null, billing_vat_number: field("vat") || null, updated_at: new Date().toISOString() };
  const result = id
    ? await admin.from("accounts").update(values).eq("id", id).select("id").single()
    : await admin.from("accounts").insert({ ...values, slug: `${clientSlug(name) || "organisation"}-${crypto.randomUUID().slice(0, 8)}`, status: "active", launch_status: "not_started", plan_tier: "pro", billing_method: "manual_invoice" }).select("id").single();
  if (result.error) return { ok: false, message: "The organisation could not be saved. Please try again." };
  await logSecurityEvent(buildSecurityEventContext(await headers()), { eventType: id ? "admin_billing_organisation_updated" : "admin_billing_organisation_created", outcome: "success", actorUserId: staff.user_id, actorEmail: staff.email, metadata: { account_id: result.data.id } });
  revalidatePath("/admin/organisations");
  revalidatePath("/admin/customers", "layout");
  return { ok: true, message: id ? "Organisation updated." : "Organisation created. You can now select it when adding a client." };
}
