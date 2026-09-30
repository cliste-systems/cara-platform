"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { requireAdminPermission } from "@/lib/admin-session";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

const INCOME_PATH = "/admin/payments/platform-income";
const OPERATION_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

type ActionResult = { ok: boolean; message: string; invoiceId?: string };

async function assertAdmin() {
  await requireAdminPermission("billing");
}

function amountInMinorUnits(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim().replace(",", ".");
  const amount = Number(value);
  if (!value || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a positive invoice amount.");
  }
  const minor = Math.round(amount * 100);
  if (minor < 1) throw new Error("Invoice amount is too small.");
  return minor;
}

function operationId(formData: FormData) {
  const value = String(formData.get("operation_id") ?? "").trim();
  if (!OPERATION_ID_RE.test(value)) throw new Error("Invalid operation reference.");
  return value;
}

async function writeInvoiceProjection(invoice: Stripe.Invoice, accountId: string) {
  const admin = createAdminClient();
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  const { error } = await admin.from("billing_invoices").upsert(
    {
      account_id: accountId,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: invoice.metadata?.cliste_subscription_id ?? null,
      livemode: invoice.livemode,
      status: invoice.status ?? "draft",
      collection_method: invoice.collection_method,
      currency: invoice.currency,
      amount_due: invoice.amount_due ?? 0,
      amount_paid: invoice.amount_paid ?? 0,
      amount_remaining: invoice.amount_remaining ?? 0,
      subtotal: invoice.subtotal ?? 0,
      total: invoice.total ?? 0,
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      number: invoice.number,
      attempted: invoice.attempted ?? false,
      last_finalization_error: invoice.last_finalization_error?.message ?? null,
      metadata: invoice.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_invoice_id,livemode" },
  );
  if (error) throw new Error(`Invoice created in Stripe but could not be synchronized: ${error.message}`);
}

export async function createPlatformInvoice(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const opId = operationId(formData);
  const accountId = String(formData.get("account_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toLowerCase();
  const collectionMethod = String(formData.get("collection_method") ?? "").trim();
  const daysUntilDue = Number(String(formData.get("days_until_due") ?? "30").trim());
  if (!accountId || !description) return { ok: false, message: "Payer and line description are required." };
  if (!/^[a-z]{3}$/.test(currency)) return { ok: false, message: "Choose a valid currency." };
  if (collectionMethod !== "send_invoice" && collectionMethod !== "charge_automatically") return { ok: false, message: "Choose a valid collection method." };
  if (collectionMethod === "send_invoice" && (!Number.isInteger(daysUntilDue) || daysUntilDue < 0 || daysUntilDue > 120)) return { ok: false, message: "Payment terms must be between 0 and 120 days." };

  let amount: number;
  try { amount = amountInMinorUnits(formData.get("amount")); } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Invalid amount." }; }

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin.from("accounts").select("id, name, platform_customer_id").eq("id", accountId).maybeSingle();
  if (accountError) return { ok: false, message: accountError.message };
  if (!account?.platform_customer_id) return { ok: false, message: "This account has no Stripe customer yet. Set up its billing profile before invoicing." };

  const request = { account_id: accountId, amount, currency, description, collection_method: collectionMethod, days_until_due: collectionMethod === "send_invoice" ? daysUntilDue : null };
  const { data: existing } = await admin.from("billing_operations").select("status, stripe_object_id").eq("operation_id", opId).maybeSingle();
  if (existing?.status === "succeeded" && existing.stripe_object_id) return { ok: true, message: "Invoice already created.", invoiceId: existing.stripe_object_id };
  const { error: operationError } = await admin.from("billing_operations").upsert({ operation_id: opId, operation_type: "create_invoice", account_id: accountId, status: "started", request, error: null, updated_at: new Date().toISOString() }, { onConflict: "operation_id" });
  if (operationError) return { ok: false, message: operationError.message };

  try {
    const stripe = getStripeClient();
    const metadata = { cliste_account_id: accountId, cliste_operation_id: opId };
    await stripe.invoiceItems.create({ customer: account.platform_customer_id, amount, currency, description, metadata }, { idempotencyKey: `${opId}:line-item` });
    const invoice = await stripe.invoices.create({
      customer: account.platform_customer_id,
      collection_method: collectionMethod,
      ...(collectionMethod === "send_invoice" ? { days_until_due: daysUntilDue } : {}),
      auto_advance: false,
      pending_invoice_items_behavior: "include",
      metadata,
    }, { idempotencyKey: `${opId}:invoice` });
    await writeInvoiceProjection(invoice, accountId);
    await admin.from("billing_operations").update({ status: "succeeded", stripe_object_id: invoice.id, updated_at: new Date().toISOString() }).eq("operation_id", opId);
    revalidatePath(INCOME_PATH);
    return { ok: true, message: `Draft invoice ${invoice.number ?? invoice.id} created. Review it before finalizing.`, invoiceId: invoice.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe invoice creation failed.";
    await admin.from("billing_operations").update({ status: "failed", error: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq("operation_id", opId);
    return { ok: false, message };
  }
}

export async function finalizePlatformInvoice(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "").trim();
  const opId = operationId(formData);
  if (!invoiceId || !accountId) return { ok: false, message: "Invoice reference is required." };
  try {
    const invoice = await getStripeClient().invoices.finalizeInvoice(invoiceId, { auto_advance: false }, { idempotencyKey: `${opId}:finalize` });
    await writeInvoiceProjection(invoice, accountId);
    revalidatePath(INCOME_PATH);
    return { ok: true, message: `Invoice ${invoice.number ?? invoice.id} finalized.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invoice finalization failed." };
  }
}

export async function sendPlatformInvoice(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "").trim();
  const opId = operationId(formData);
  if (!invoiceId || !accountId) return { ok: false, message: "Invoice reference is required." };
  try {
    const invoice = await getStripeClient().invoices.sendInvoice(invoiceId, {}, { idempotencyKey: `${opId}:send` });
    await writeInvoiceProjection(invoice, accountId);
    revalidatePath(INCOME_PATH);
    return { ok: true, message: `Invoice ${invoice.number ?? invoice.id} sent through Stripe.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invoice send failed." };
  }
}
