import Link from "next/link";
import { customerPlanLabel } from "@/lib/admin-customer-state";
import { setupOptionLabel } from "@/lib/setup-option-label";
import { AdminFormDialog } from "@/components/admin/admin-form-dialog";
import { AdminWorkspaceTabs } from "@/components/admin/admin-workspace-tabs";
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
  total: number;
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
  account_id: string | null;
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

export default async function PlatformIncomePage({searchParams}:{searchParams:Promise<{mode?:string}>}) {
  await requireAdminPermission("billing");
  const admin = createAdminClient();
  const live = (await searchParams).mode !== "test";
  const [paymentsResult, invoicesResult, syncResult, accountsResult, totalsResult] = await Promise.all([
    admin.from("billing_payments").select("*").eq("livemode", live).order("created_at", { ascending: false }).limit(50),
    admin.from("billing_invoices").select("*").eq("livemode", live).order("created_at", { ascending: false }).limit(50),
    admin.from("stripe_webhook_events").select("status, received_at, last_error").order("received_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("accounts").select("id, name, platform_customer_id, plan_tier, status, launch_tier, launch_scheduled_at, billing_contact_name, billing_email").order("name", { ascending: true }),
    admin.rpc("admin_billing_totals", {p_live:live}),
  ]);

  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const invoices = (invoicesResult.data ?? []) as InvoiceRow[];
  const loadError = paymentsResult.error?.message ?? invoicesResult.error?.message ?? accountsResult.error?.message ?? null;
  const successful = payments.filter(row=>row.status === "succeeded");
  const totals = (totalsResult.data ?? []) as {currency:string;gross:number;refunds:number;net:number;outstanding:number;open:number;failures:number}[];
  const totalLabel = (key:"net"|"outstanding"|"refunds") => totalsResult.error ? "Unavailable" : totals.length ? totals.map(row=>money(row[key],row.currency)).join(" · ") : "€0.00";
  const accounts = accountsResult.data ?? [];
  const accountName = (id:string|null)=>accounts.find(row=>row.id===id)?.name ?? "Unlinked customer";
  const latestSync = syncResult.data?.received_at ? date(syncResult.data.received_at) : "No webhook received";

  return (
    <AdminPageShell
      icon={CreditCard}
      title="Billing"
      description="Customer accounts, setup choices, invoices and collections."
      maxWidth="6xl"
      actions={<AdminFormDialog title="Create invoice" description="Create a draft invoice, then review it before issuing it.">
        <InvoiceCreateForm accounts={accounts.filter(row=>row.platform_customer_id).map(row=>({id:row.id,name:row.name,platform_customer_id:row.platform_customer_id!}))} />
        <p className="mt-4 text-xs text-slate-500">No tax is added automatically. Confirm the payer’s tax treatment and any applicable Stripe Tax registration before issuing a real invoice.</p>
      </AdminFormDialog>}
    >
      {loadError ? <p className="mb-4 text-sm text-red-700" role="alert">Could not load platform income: {loadError}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3"><nav aria-label="Billing sections" className="flex gap-5 text-sm"><span className="font-semibold">Customer billing</span><Link href="/admin/payments/platform-spend" className="text-slate-500 hover:underline">Platform costs</Link></nav><nav aria-label="Payment environment" className="flex gap-3 text-xs"><Link aria-current={live ? "page" : undefined} className={live ? "font-semibold" : "text-slate-500"} href="?mode=live">Live</Link><Link aria-current={!live ? "page" : undefined} className={!live ? "font-semibold" : "text-slate-500"} href="?mode=test">Test</Link></nav></div>
      {totalsResult.error ? <p role="alert" className="text-sm text-amber-800">Billing totals could not be loaded.</p> : null}
      {!live ? <p role="status" className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-900">Test payments · no real money collected. Account details below are shared across environments.</p> : null}
      <AdminStatsGrid columns={3} className="gap-2 [&>div]:px-3 [&_p:nth-child(2)]:text-[22px] sm:[&_p:nth-child(2)]:text-[28px]">
        <AdminStatCard label="Net collected" value={totalLabel("net")} />
        <AdminStatCard label="Outstanding" value={totalLabel("outstanding")} />
        <AdminStatCard label="Refunded" value={totalLabel("refunds")} />
      </AdminStatsGrid>
      <p className="text-xs text-slate-500">Full synced ledger · net collected deducts refunds. Currencies are shown separately.</p>
      <AdminWorkspaceTabs panels={[{id:"accounts",label:"Accounts & setup",content:<AdminSectionCard title="Customer accounts" description="Recorded account status and setup choice. Subscription details remain in Stripe." padded><div className="divide-y divide-slate-200">{accounts.filter(row=>!/^\[smoke test\]/i.test(row.name)).map(row=><div key={row.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0"><div className="min-w-0"><Link href={`/admin/organisations#${row.id}`} className="text-sm font-semibold hover:underline">{row.name}</Link><p className="mt-1 break-words text-xs text-slate-500">{row.billing_contact_name || "Contact not recorded"} · {row.billing_email || "Email not recorded"}</p></div><div className="text-xs leading-6 sm:text-right"><p>{customerPlanLabel(row.plan_tier)} · <span className="capitalize">{row.status}</span></p><p className="text-slate-500">{setupOptionLabel(row.launch_tier)}{row.launch_tier && row.launch_tier!=="diy" ? row.launch_scheduled_at ? ` · Scheduled ${date(row.launch_scheduled_at)}` : " · Booking not recorded" : ""}</p></div></div>)}{!accounts.length ? <p className="text-sm text-slate-500">No customer accounts recorded.</p> : null}</div></AdminSectionCard>},{ id: "invoices", label: "Invoices & attention", content: <AdminSectionCard title="Recent invoices" description={`Latest 50 ${live ? "live" : "test"} invoices. Latest webhook received: ${latestSync}.`} padded>
          <div className="space-y-3">
            {invoices.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{accountName(row.account_id)}</p><p className="mt-1 text-xs text-slate-500">{row.number ?? "Unnumbered invoice"}</p><p className="text-xs text-slate-500">{row.status} · due {date(row.due_date)}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-2"><div className="flex items-center gap-2">{row.hosted_invoice_url ? <a href={row.hosted_invoice_url} target="_blank" rel="noreferrer" aria-label="Open hosted invoice"><ExternalLink className="size-4 text-slate-400" /></a> : null}<span className="font-medium text-slate-900">{money(row.status === "paid" ? row.amount_paid : row.amount_remaining, row.currency)}<span className="ml-1 text-xs font-normal text-slate-500">{row.status === "paid" ? "paid" : "due"}</span></span></div><InvoiceActions invoiceId={row.stripe_invoice_id} accountId={row.account_id} status={row.status} collectionMethod={row.collection_method} /></div>
              </div>
            ))}
            {!invoices.length ? <p className="text-sm text-slate-500">No synchronized invoices yet.</p> : null}
          </div>
        </AdminSectionCard> }, { id: "collections", label: "Collections", content: <AdminSectionCard title="Recent collections" description="Latest 50 payment records. Full-ledger totals are shown above." padded>
          <div className="space-y-3">
            {successful.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{accountName(row.account_id)}</p><p className="text-xs text-slate-500">{date(row.captured_at ?? row.created_at)}</p></div>
                <span className="shrink-0 font-medium text-emerald-700">{money(row.amount_received, row.currency)}</span>
              </div>
            ))}
            {!successful.length ? <p className="text-sm text-slate-500">No synchronized successful payments yet.</p> : null}
          </div>
        </AdminSectionCard> },{id:"attention",label:"Payment attention",content:<AdminSectionCard title="Payments needing attention" description="From the latest 50 payment records. Canceled attempts are excluded." padded><div className="space-y-4">{payments.filter(row=>["requires_payment_method","requires_action"].includes(row.status)).map(row=><div key={row.id} className="border-b border-slate-200 pb-4"><p className="text-sm font-medium">{accountName(row.account_id)}</p><p className="mt-1 text-xs text-amber-800">{row.status === "requires_action" ? "Customer authentication required" : "Payment method needs attention"}</p>{row.failure_message ? <p className="mt-1 text-xs text-slate-500">{row.failure_message}</p> : null}</div>)}{!payments.some(row=>["requires_payment_method","requires_action"].includes(row.status)) ? <p className="text-sm text-slate-500">No payments need attention in these recent records.</p> : null}</div></AdminSectionCard>}]} />

    </AdminPageShell>
  );
}
