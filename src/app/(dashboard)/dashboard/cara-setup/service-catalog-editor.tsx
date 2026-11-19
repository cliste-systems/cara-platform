"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Field } from "@/components/dashboard/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatServiceCatalogLine,
  formatServiceDuration,
  formatServicePriceEur,
  findCatalogNameConflict,
  type ServiceCatalogDraft,
  type ServiceCatalogItem,
} from "@/lib/service-catalog-format";
import { ServicePolicyPresetsEditor } from "@/components/agent-knowledge/service-policy-presets-editor";
import { formatBookingImportSuccessMessage } from "@/lib/booking-menu-import-shared";
import { cn } from "@/lib/utils";

import {
  deleteServiceCatalogItem,
  importBookingMenuForServices,
  saveServiceCatalog,
  upsertServiceCatalogItem,
} from "./service-catalog-actions";

type Props = {
  initialServices: ServiceCatalogItem[];
  servicesCopy: {
    bookingImportLabel?: string;
    bookingImportHint?: string;
    bookingImportPlaceholder?: string;
    primaryPlaceholder?: string;
  };
  onServicesChange?: (services: ServiceCatalogItem[]) => void;
};

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400";

function emptyDraft(): ServiceCatalogDraft {
  return {
    name: "",
    category: null,
    price: 0,
    durationMinutes: 0,
    description: null,
    aiVoiceNotes: null,
    policyFlags: [],
    source: "manual",
  };
}

export function ServiceCatalogEditor({
  initialServices,
  servicesCopy,
  onServicesChange,
}: Props) {
  const [services, setServices] = useState(initialServices);
  const [importUrl, setImportUrl] = useState("");
  const [importing, startImport] = useTransition();
  const [pending, startSave] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "info">("info");
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<ServiceCatalogDraft>(emptyDraft());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<ServiceCatalogDraft[] | null>(
    null,
  );
  const [reviewBookingUrl, setReviewBookingUrl] = useState("");
  const [reviewMergedCount, setReviewMergedCount] = useState(0);

  const [previousServices, setPreviousServices] = useState(initialServices);
  if (previousServices !== initialServices) {
    setPreviousServices(initialServices);
    setServices(initialServices);
  }

  const updateServices = useCallback(
    (next: ServiceCatalogItem[]) => {
      setServices(next);
      onServicesChange?.(next);
    },
    [onServicesChange],
  );

  const handleImport = () => {
    setStatus(null);
    startImport(async () => {
      const result = await importBookingMenuForServices(importUrl);
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      if (result.regulated) {
        const message =
          "That link looks like a regulated business — we can't import it. Add services manually.";
        setStatus(message);
        return;
      }
      if (!Array.isArray(result.drafts) || result.drafts.length === 0) {
        const message =
          "We couldn't find any services on that page. Add them manually, or try a different booking link.";
        setStatus(message);
        return;
      }
      setReviewDrafts(result.drafts);
      setReviewBookingUrl(result.bookingUrl);
      setReviewMergedCount(result.mergedCount);
    });
  };

  const confirmImport = () => {
    if (!reviewDrafts?.length) return;
    setStatus(null);
    startSave(async () => {
      const result = await saveServiceCatalog({
        services: reviewDrafts,
        replaceExisting: true,
        bookingUrl: reviewBookingUrl,
        importSource: "booking_import",
      });
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      updateServices(result.services);
      const mergedCount = reviewMergedCount;
      setReviewDrafts(null);
      setReviewBookingUrl("");
      setReviewMergedCount(0);
      setImportUrl("");
      setStatusKind("success");
      setStatus(
        formatBookingImportSuccessMessage(result.services.length, mergedCount),
      );
    });
  };

  const openEdit = (item?: ServiceCatalogItem) => {
    setEditDraft(
      item
        ? {
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            durationMinutes: item.durationMinutes,
            description:
              item.source === "booking_import" ? null : item.description,
            aiVoiceNotes: item.aiVoiceNotes,
            policyFlags: item.policyFlags ?? [],
            source: item.source,
          }
        : emptyDraft(),
    );
    setEditOpen(true);
  };

  const saveEdit = () => {
    setStatus(null);
    const trimmedName = editDraft.name.trim();
    if (!trimmedName) return;

    const conflict = findCatalogNameConflict(
      trimmedName,
      services,
      editDraft.id,
      {
        price: editDraft.price,
        durationMinutes: editDraft.durationMinutes,
      },
    );
    if (conflict) {
      setStatus(
        `"${trimmedName}" is too similar to "${conflict}". Keep one name in your menu.`,
      );
      return;
    }

    startSave(async () => {
      const result = await upsertServiceCatalogItem(editDraft);
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      updateServices(result.services);
      setEditOpen(false);
      setStatus("Service saved.");
    });
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startSave(async () => {
      const result = await deleteServiceCatalogItem(id);
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      updateServices(result.services);
    });
  };

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  return (
    <div className="space-y-4">
      {servicesCopy.bookingImportLabel ? (
        <div className="rounded-lg border border-slate-200 px-4 py-4">
          <p className="text-[13px] font-medium text-slate-900">
            {servicesCopy.bookingImportLabel}
          </p>
          {servicesCopy.bookingImportHint ? (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              {servicesCopy.bookingImportHint}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="url"
              inputMode="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleImport();
                }
              }}
              placeholder={servicesCopy.bookingImportPlaceholder}
              disabled={importing || pending}
              className={cn(INPUT_CLASS, "min-w-0 flex-1")}
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || pending || !importUrl.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0b1220] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              Import
            </button>
          </div>
        </div>
      ) : null}

      {status ? (
        <p
          className={cn(
            "text-[12.5px]",
            statusKind === "success"
              ? "font-medium text-[#35443f]"
              : "text-slate-600",
          )}
          role="status"
        >
          {status}
        </p>
      ) : null}

      {reviewDrafts && reviewDrafts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[13px] font-medium text-slate-900">
            Review imported services ({reviewDrafts.length})
          </p>
          <p className="text-[12px] leading-relaxed text-slate-500">
            Check names, prices, and durations before saving.
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-[12.5px] text-slate-600">
            {reviewDrafts.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                {formatServiceCatalogLine({
                  name: s.name,
                  price: s.price,
                  durationMinutes: s.durationMinutes,
                })}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={confirmImport}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-[#0b1220] px-3 text-[12.5px] font-medium text-white disabled:opacity-50"
            >
              Save to menu
            </button>
            <button
              type="button"
              onClick={() => setReviewDrafts(null)}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-900">Service menu</p>
        <button
          type="button"
          onClick={() => openEdit()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700"
        >
          <Plus className="size-3.5" aria-hidden />
          Add service
        </button>
      </div>

      {sortedServices.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          No services yet — import from a booking link or add them manually.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {sortedServices.map((service) => (
            <li
              key={service.id}
              className="px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => openEdit(service)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-[14px] font-medium text-slate-900">
                  {service.name}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {[
                    formatServiceDuration(service.durationMinutes),
                    formatServicePriceEur(service.price),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Tap to add price and duration"}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(service.id)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-[#f3f6f4] hover:text-[#11181d]"
                aria-label={`Delete ${service.name}`}
              >
                <Trash2 className="size-4" />
              </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="px-5 pt-5 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {editDraft.id ? "Edit service" : "Add service"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(24rem,60vh)] space-y-3 overflow-y-auto px-5 py-4">
            <Field label="Service name" htmlFor="svc-name">
              <input
                id="svc-name"
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder={servicesCopy.primaryPlaceholder}
                className={INPUT_CLASS}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (€)" htmlFor="svc-price">
                <input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={editDraft.price || ""}
                  onChange={(e) =>
                    setEditDraft((d) => ({
                      ...d,
                      price: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="45"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Duration (mins)" htmlFor="svc-duration">
                <input
                  id="svc-duration"
                  type="number"
                  min={0}
                  step={5}
                  value={editDraft.durationMinutes || ""}
                  onChange={(e) =>
                    setEditDraft((d) => ({
                      ...d,
                      durationMinutes: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="45"
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <ServicePolicyPresetsEditor
              flags={editDraft.policyFlags ?? []}
              onChange={(policyFlags) =>
                setEditDraft((d) => ({ ...d, policyFlags }))
              }
              disabled={pending}
            />
          </div>
          <DialogFooter className="-mx-0 -mb-0 rounded-b-xl border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending || !editDraft.name.trim()}
              className="rounded-lg bg-[#0b1220] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this service?"
        description="Cara will no longer mention it on calls."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
