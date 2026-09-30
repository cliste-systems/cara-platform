import { requireAdminPermission } from "@/lib/admin-session";
import { CreditCard, ExternalLink } from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import { createAdminClient } from "@/utils/supabase/admin";

import { InvoiceCreateForm } from "./invoice-create-form";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  account_id: string | null;
  stripe_invoice_id: string;
  number: string | null;
  status: string;
  collection_method: string | null;
  currency: string;
  amount_remaining: number;
  amount_paid: number;
  hosted_invoice_url: string | null;
  due_date: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  status: string;
  currency: string;
  amount_received: number;
  failure_message: string | null;
  captured_at: string | null;
  created_at: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value / 100);
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function PlatformIncomePage() {
  await requireAdminPermission("billing");
  const admin = createAdminClient();
  const [paymentsResult, invoicesResult, syncResult, accountsResult] = await Promise.all([
    admin.from("billing_payments").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("billing_invoices").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("stripe_webhook_events").select("status, received_at, last_error").order("received_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("accounts").select("id, name, platform_customer_id").not("platform_customer_id", "is", null).order("name", { ascending: true }),
  ]);

  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const invoices = (invoicesResult.data ?? []) as InvoiceRow[];
  const loadError = paymentsResult.error?.message ?? invoicesResult.error?.message ?? accountsResult.error?.message ?? null;
  const successful = payments.filter((row) => row.status === "succeeded");
  const collectedByCurrency = successful.reduce<Record<string, number>>((acc, row) => {
    acc[row.currency] = (acc[row.currency] ?? 0) + row.amount_received;
    return acc;
  }, {});
  const outstandingByCurrency = invoices.filter((row) => ["open", "past_due"].includes(row.status)).reduce<Record<string, number>>((acc, row) => {
    acc[row.currency] = (acc[row.currency] ?? 0) + row.amount_remaining;
    return acc;
  }, {});
  const failed = payments.filter((row) => row.status === "requires_payment_method" || row.status === "requires_action" || row.status === "canceled").length;
  const latestSync = syncResult.data?.received_at ? date(syncResult.data.received_at) : "No webhook received";

  return (
    <AdminPageShell
      icon={CreditCard}
      title="Platform income"
      description="Live Stripe collections, outstanding invoices, recurring billing signals, and payment attention for Cliste services."
      maxWidth="6xl"
    >
      {loadError ? <p className="mb-4 text-sm text-red-700" role="alert">Could not load platform income: {loadError}</p> : null}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        This page reads Stripe records synchronized through webhooks. Totals are separated by currency.
      </div>
      <AdminStatsGrid>
        <AdminStatCard label="Collected" value={Object.entries(collectedByCurrency).map(([currency, amount]) => money(amount, currency)).join(" · ") || "€0.00"} />
        <AdminStatCard label="Outstanding" value={Object.entries(outstandingByCurrency).map(([currency, amount]) => money(amount, currency)).join(" · ") || "€0.00"} />
        <AdminStatCard label="Open invoices" value={String(invoices.filter((row) => ["open", "past_due"].includes(row.status)).length)} />
        <AdminStatCard label="Needs attention" value={String(failed)} />
      </AdminStatsGrid>

      <AdminSectionCard title="Create an invoice" description="Creates a Stripe draft using the payer, amount, currency, and terms you enter. Review it before finalizing or sending." padded>
        <InvoiceCreateForm accounts={(accountsResult.data ?? []) as { id: string; name: string; platform_customer_id: string }[]} />
        <p className="mt-4 text-xs text-slate-500">No tax is added automatically. Confirm the payer’s tax treatment and any applicable Stripe Tax registration before issuing a real invoice.</p>
      </AdminSectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSectionCard title="Recent collections" description="Successful PaymentIntents counted once by received amount." padded>
          <div className="space-y-3">
            {successful.slice(0, 8).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{row.stripe_payment_intent_id ?? "Payment"}</p><p className="text-xs text-slate-500">{date(row.captured_at ?? row.created_at)}</p></div>
                <span className="shrink-0 font-medium text-emerald-700">{money(row.amount_received, row.currency)}</span>
              </div>
            ))}
            {!successful.length ? <p className="text-sm text-slate-500">No synchronized successful payments yet.</p> : null}
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="Invoices and attention" description={`Latest webhook: ${latestSync}. Overdue and failed collection states stay visible.`} padded>
          <div className="space-y-3">
            {invoices.slice(0, 8).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{row.number ?? row.stripe_invoice_id}</p><p className="text-xs text-slate-500">{row.status} · due {date(row.due_date)}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-2"><div className="flex items-center gap-2">{row.hosted_invoice_url ? <a href={row.hosted_invoice_url} target="_blank" rel="noreferrer" aria-label="Open hosted invoice"><ExternalLink className="size-4 text-slate-400" /></a> : null}<span className="font-medium text-slate-900">{money(row.amount_remaining, row.currency)}</span></div><InvoiceActions invoiceId={row.stripe_invoice_id} accountId={row.account_id} status={row.status} collectionMethod={row.collection_method} /></div>
              </div>
            ))}
            {!invoices.length ? <p className="text-sm text-slate-500">No synchronized invoices yet.</p> : null}
          </div>
        </AdminSectionCard>
      </div>

    </AdminPageShell>
  );
}
