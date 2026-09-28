"use client";

import { useState, useTransition } from "react";

import { createPlatformInvoice } from "./actions";

type AccountOption = { id: string; name: string; platform_customer_id: string };

export function InvoiceCreateForm({ accounts }: { accounts: AccountOption[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        data.set("operation_id", crypto.randomUUID());
        setMessage(null);
        startTransition(async () => {
          const result = await createPlatformInvoice(data);
          setOk(result.ok);
          setMessage(result.message);
          if (result.ok) form.reset();
        });
      }}
    >
      <input type="hidden" name="operation_id" />
      <label className="space-y-1 text-sm md:col-span-2">
        <span className="font-medium text-slate-700">Payer</span>
        <select name="account_id" required className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
          <option value="">Choose an existing Stripe-linked account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700">Amount</span>
        <input name="amount" inputMode="decimal" placeholder="0.00" required className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700">Currency</span>
        <select name="currency" defaultValue="eur" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="eur">EUR</option><option value="gbp">GBP</option><option value="usd">USD</option></select>
      </label>
      <label className="space-y-1 text-sm md:col-span-2">
        <span className="font-medium text-slate-700">Line description</span>
        <input name="description" placeholder="e.g. September platform subscription" required className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700">Collection</span>
        <select name="collection_method" defaultValue="send_invoice" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="send_invoice">Email invoice</option><option value="charge_automatically">Charge saved payment method</option></select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700">Payment terms (days)</span>
        <input name="days_until_due" type="number" min="0" max="120" defaultValue="30" className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <div className="md:col-span-2 flex items-center justify-between gap-4">
        <p className={`text-sm ${ok ? "text-emerald-700" : "text-red-700"}`} role={message ? "status" : undefined}>{message}</p>
        <button type="submit" disabled={pending || accounts.length === 0} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Creating draft…" : "Create draft invoice"}</button>
      </div>
      {!accounts.length ? <p className="text-sm text-amber-800 md:col-span-2">No accounts with Stripe customers are available yet.</p> : null}
    </form>
  );
}
