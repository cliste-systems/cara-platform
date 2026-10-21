"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminBadge } from "@/components/admin/admin-badge";
import {
  adminDestructiveButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextLinkClass,
} from "@/components/admin/admin-interactive";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
import {
  billingCycleLabel,
  billingDueStatus,
  effectiveAmountCents,
  formatPlatformSpendEur,
  type PlatformVendorCostRow,
} from "@/lib/platform-spend";

import {
  deletePlatformVendorCost,
  upsertPlatformVendorCost,
} from "./actions";

type FormState = { ok: boolean; message: string } | null;

function formatDateLabel(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatSyncedAt(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function amountLabel(row: PlatformVendorCostRow): string {
  const cents = effectiveAmountCents(row);
  if (cents == null) return "—";
  return formatPlatformSpendEur(cents);
}

function dueBadge(row: PlatformVendorCostRow) {
  const status = billingDueStatus(row.next_billing_date);
  if (status === "overdue") {
    return <AdminBadge tone="danger">Overdue</AdminBadge>;
  }
  if (status === "due_soon") {
    return <AdminBadge tone="warning">Due soon</AdminBadge>;
  }
  return null;
}

function VendorEditor({
  row,
  onClose,
}: {
  row: PlatformVendorCostRow | null;
  onClose: () => void;
}) {
  const [state, submit, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => upsertPlatformVendorCost(formData),
    null,
  );
  const isNew = row == null;
  const isApiVendor = row?.source === "api";

  return (
    <form action={submit} className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {isNew ? "Add vendor" : `Edit ${row.display_name}`}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Fixed subscriptions use EUR amounts. Usage vendors sync from APIs.
          </p>
        </div>
        <button type="button" onClick={onClose} className={adminSecondaryButtonClass}>
          Close
        </button>
      </div>

      {row ? <input type="hidden" name="id" value={row.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {isNew ? (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Vendor key</span>
            <input
              name="vendor_key"
              required
              placeholder="e.g. twilio"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600">Display name</span>
          <input
            name="display_name"
            required
            defaultValue={row?.display_name ?? ""}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-600">Billing cycle</span>
          <select
            name="billing_cycle"
            defaultValue={row?.billing_cycle ?? "monthly"}
            disabled={isApiVendor}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="usage">Usage-based</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-600">
            Amount (EUR)
          </span>
          <input
            name="amount_eur"
            inputMode="decimal"
            placeholder="e.g. 20.00"
            defaultValue={
              row?.amount_cents != null ? (row.amount_cents / 100).toFixed(2) : ""
            }
            disabled={row?.billing_cycle === "usage" || isApiVendor}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-600">
            Billing day (1–28)
          </span>
          <input
            name="billing_day"
            type="number"
            min={1}
            max={28}
            defaultValue={row?.billing_day ?? ""}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600">
            Billing dashboard URL
          </span>
          <input
            name="dashboard_url"
            type="url"
            defaultValue={row?.dashboard_url ?? ""}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600">Notes</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={row?.notes ?? ""}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={row?.active ?? true}
            className="size-4 rounded border-gray-300"
          />
          Active
        </label>
      </div>

      {state ? (
        <p
          className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={adminPrimaryButtonClass}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : null}
          {isNew ? "Add vendor" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function PlatformSpendVendorTable({
  rows,
}: {
  rows: PlatformVendorCostRow[];
}) {
  const [editing, setEditing] = useState<PlatformVendorCostRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [, deleteAction, deletePending] = useActionState<FormState, FormData>(
    async (_prev, formData) => deletePlatformVendorCost(formData),
    null,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {rows.length} vendor{rows.length === 1 ? "" : "s"} tracked
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
          className={adminSecondaryButtonClass}
        >
          <Plus className="size-3.5" aria-hidden />
          Add vendor
        </button>
      </div>

      <Dialog open={adding || Boolean(editing)} onOpenChange={open => { if (!open) { setAdding(false); setEditing(null); } }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto bg-white p-6 sm:max-w-2xl">
          <DialogHeader><DialogTitle>{adding ? "Add vendor" : "Edit vendor"}</DialogTitle><DialogDescription>Update the vendor’s cost and billing details.</DialogDescription></DialogHeader>
          <VendorEditor key={editing?.id || "new"} row={editing} onClose={() => { setAdding(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className={adminTableClass}>
          <thead className={adminTableHeadClass}>
            <tr>
              <th className={adminTableThClass}>Vendor</th>
              <th className={adminTableThClass}>Amount</th>
              <th className={adminTableThClass}>Cycle</th>
              <th className={adminTableThClass}>Next charge</th>
              <th className={adminTableThClass}>Source</th>
              <th className={adminTableThClass}>Actions</th>
            </tr>
          </thead>
          <tbody className={adminTableBodyClass}>
            {rows.map((row) => (
              <tr key={row.id} className={adminTableRowClass}>
                <td className={adminTableTdClass}>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{row.display_name}</span>
                      {!row.active ? (
                        <AdminBadge tone="neutral">Inactive</AdminBadge>
                      ) : null}
                      {dueBadge(row)}
                    </div>
                    {row.dashboard_url ? (
                      <a
                        href={row.dashboard_url}
                        target="_blank"
                        rel="noreferrer"
                        className={adminTextLinkClass}
                      >
                        Open billing
                      </a>
                    ) : null}
                    {row.last_sync_error ? (
                      <p className="text-xs text-red-600">{row.last_sync_error}</p>
                    ) : null}
                  </div>
                </td>
                <td className={adminTableTdClass}>
                  <div className="space-y-0.5">
                    <span>{amountLabel(row)}</span>
                    {row.source === "api" ? (
                      <p className="text-xs text-gray-500">
                        Synced {formatSyncedAt(row.last_synced_at)}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className={adminTableTdClass}>
                  {billingCycleLabel(row.billing_cycle)}
                </td>
                <td className={adminTableTdClass}>
                  {formatDateLabel(row.next_billing_date)}
                </td>
                <td className={adminTableTdClass}>
                  {row.source === "api" ? (
                    <AdminBadge tone="success">Live</AdminBadge>
                  ) : (
                    <AdminBadge tone="neutral">Manual</AdminBadge>
                  )}
                </td>
                <td className={adminTableTdClass}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditing(row);
                      }}
                      className={adminSecondaryButtonClass}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </button>
                    {row.source === "manual" && !row.api_provider ? (
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          disabled={deletePending}
                          className={adminDestructiveButtonClass}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
