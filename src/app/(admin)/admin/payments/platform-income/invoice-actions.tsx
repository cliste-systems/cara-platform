"use client";

import { useState, useTransition } from "react";

import { finalizePlatformInvoice, sendPlatformInvoice } from "./actions";

export function InvoiceActions({ invoiceId, accountId, status, collectionMethod }: { invoiceId: string; accountId: string | null; status: string; collectionMethod: string | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (!accountId) return null;
  const run = (action: typeof finalizePlatformInvoice | typeof sendPlatformInvoice, suffix: string) => {
    const data = new FormData();
    data.set("invoice_id", invoiceId);
    data.set("account_id", accountId);
    data.set("operation_id", `${invoiceId}-${suffix}`);
    startTransition(async () => setMessage((await action(data)).message));
  };
  return <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
    {status === "draft" ? <button type="button" disabled={pending} onClick={() => run(finalizePlatformInvoice, "finalize")} className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 disabled:opacity-50">Finalize</button> : null}
    {status === "open" && collectionMethod === "send_invoice" ? <button type="button" disabled={pending} onClick={() => run(sendPlatformInvoice, "send")} className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 disabled:opacity-50">Send / resend</button> : null}
    {message ? <span className="text-slate-500">{message}</span> : null}
  </div>;
}
