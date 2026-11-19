"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Field } from "@/components/dashboard/field";
import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import {
  ONBOARDING_FIELD_HINT,
} from "@/components/onboarding/onboarding-ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CaraGoal } from "@/lib/cara-goal";
import type { BookingMenuImportService } from "@/lib/booking-menu-import-shared";
import { formatBookingImportSuccessMessage } from "@/lib/booking-menu-import-shared";
import {
  formatServiceCatalogLine,
  formatServiceDuration,
  formatServicePriceEur,
  type ServiceCatalogDraft,
  type ServiceCatalogItem,
} from "@/lib/service-catalog-format";
import { ServicePolicyPresetsEditor } from "@/components/agent-knowledge/service-policy-presets-editor";
import { verticalPackForNiche } from "@/lib/verticals";
import { cn } from "@/lib/utils";

import {
  CaraTrainingStepShell,
  ExpandableTrainingTextarea,
  SERVICES_PLAIN_ENGLISH_TEXTAREA,
  TRAINING_SURFACE,
} from "./cara-training-step-shell";
import type { ServicesStepCopy } from "./train-cara-services-copy";
import {
  applyBookingMenuImportForTrainCara,
  deleteServiceCatalogItemForTrainCara,
  importBookingMenuForTrainCara,
  upsertServiceCatalogItemForTrainCara,
} from "./train-cara-catalog-actions";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400";

const SERVICES_TOOLBAR_LINK_BOX =
  "flex h-10 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50/80 px-3";

const SERVICES_TOOLBAR_INPUT =
  "h-10 min-w-0 flex-1 rounded-lg border border-slate-200/90 bg-white px-3 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 disabled:opacity-50";

const SERVICES_TOOLBAR_OUTLINE_BTN =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 disabled:opacity-50";

const SERVICES_TOOLBAR_PRIMARY_BTN =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0b1220] px-3 text-[13px] font-medium text-white disabled:opacity-50";

function ServicesCollapsibleSection({
  open,
  onToggle,
  title,
  summary,
  disabled,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) {
      setHeight(0);
      return;
    }

    const measure = () => setHeight(node.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children, open]);

  return (
    <div className={cn(TRAINING_SURFACE, "overflow-hidden")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-50/80 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-slate-900">{title}</span>
          {!open && summary ? (
            <span className="mt-0.5 block truncate text-[12px] text-slate-500">
              {summary}
            </span>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? height : 0 }}
        transition={reduceMotion ? { duration: 0 } : onboardingSpring}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="space-y-2 px-4 pb-3">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

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

type Props = {
  title: string;
  subtitle: string;
  helper?: string;
  niche: string;
  caraGoal: CaraGoal;
  servicesCopy: ServicesStepCopy;
  catalog: ServiceCatalogItem[];
  servicesOfferedRaw: string;
  bookingLinkUrl?: string;
  onCatalogChange: (services: ServiceCatalogItem[], servicesOffered: string) => void;
  onServicesOfferedRawChange: (value: string) => void;
  onSkip?: () => void;
  disabled?: boolean;
};

export function TrainCaraServicesStep({
  title,
  subtitle,
  helper,
  niche,
  caraGoal,
  servicesCopy,
  catalog,
  servicesOfferedRaw,
  bookingLinkUrl = "",
  onCatalogChange,
  onServicesOfferedRawChange,
  onSkip,
  disabled = false,
}: Props) {
  const usesServiceCatalog = verticalPackForNiche(niche).capabilities
    .usesServiceCatalog;

  if (usesServiceCatalog) {
    return (
      <SalonServicesStep
        title={title}
        subtitle={subtitle}
        caraGoal={caraGoal}
        servicesCopy={servicesCopy}
        catalog={catalog}
        bookingLinkUrl={bookingLinkUrl}
        onCatalogChange={onCatalogChange}
        onSkip={onSkip}
        disabled={disabled}
      />
    );
  }

  return (
    <GenericServicesStep
      title={title}
      subtitle={subtitle}
      helper={helper}
      caraGoal={caraGoal}
      servicesCopy={servicesCopy}
      servicesOfferedRaw={servicesOfferedRaw}
      onServicesOfferedRawChange={onServicesOfferedRawChange}
      onSkip={onSkip}
      disabled={disabled}
    />
  );
}

function FaqOnlySkipHint({
  caraGoal,
  onSkip,
  disabled,
}: {
  caraGoal: CaraGoal;
  onSkip?: () => void;
  disabled?: boolean;
}) {
  if (caraGoal !== "faq_only" || !onSkip) return null;

  return (
    <p className="text-center text-[12px] leading-relaxed text-slate-500">
      Skip if callers only ask general questions —{" "}
      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        className="font-medium text-[#0b1220] underline-offset-2 hover:underline disabled:opacity-50"
      >
        Skip for now
      </button>
    </p>
  );
}

function SalonServicesStep({
  title,
  subtitle,
  caraGoal,
  servicesCopy,
  catalog,
  bookingLinkUrl = "",
  onCatalogChange,
  onSkip,
  disabled,
}: Omit<
  Props,
  "niche" | "servicesOfferedRaw" | "onServicesOfferedRawChange" | "helper"
>) {
  const savedLink = bookingLinkUrl.trim();
  const hasImportedMenu = catalog.length > 0;
  const [connectedLink, setConnectedLink] = useState(savedLink);
  const [editingLink, setEditingLink] = useState(false);
  const [importUrl, setImportUrl] = useState(savedLink);
  const showConnectedLink =
    hasImportedMenu && Boolean(connectedLink) && !editingLink;

  const savedLinkKey = JSON.stringify([savedLink, editingLink]);
  const [lastSavedLinkKey, setLastSavedLinkKey] = useState<typeof savedLinkKey | undefined>(undefined);
  if (lastSavedLinkKey !== savedLinkKey) {
    setLastSavedLinkKey(savedLinkKey);
    setConnectedLink(savedLink);
    if (!editingLink) {
      setImportUrl(savedLink);
    }
  }
  const [importing, startImport] = useTransition();
  const [pending, startSave] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [review, setReview] = useState<{
    services: BookingMenuImportService[];
    bookingUrl: string;
    quality?: "high" | "low";
    qualityMessage?: string;
    mergedCount: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<ServiceCatalogDraft>(emptyDraft());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [linkPanelOpen, setLinkPanelOpen] = useState(() => !hasImportedMenu);

  const busy = disabled || importing || pending;

  const importPanelKey = JSON.stringify([hasImportedMenu, editingLink]);
  const [lastImportPanelKey, setLastImportPanelKey] = useState<typeof importPanelKey | undefined>(undefined);
  if (lastImportPanelKey !== importPanelKey) {
    setLastImportPanelKey(importPanelKey);
    if (hasImportedMenu && !editingLink) {
      setLinkPanelOpen(false);
    }
  }

  function openLinkPanel() {
    setLinkPanelOpen(true);
  }

  function toggleLinkPanel() {
    if (linkPanelOpen) {
      setLinkPanelOpen(false);
      setEditingLink(false);
      return;
    }
    openLinkPanel();
  }

  const bookingImportLabel =
    servicesCopy.bookingImportLabel?.trim() || "Import from booking link";
  const bookingImportPlaceholder =
    servicesCopy.bookingImportPlaceholder?.trim() ||
    "fresha.com/… or booksy.com/…";
  const bookingImportHint =
    servicesCopy.bookingImportHint?.trim() ||
    "Paste Fresha, Phorest, or Booksy — we’ll pull your service menu.";

  const linkPanelSummary =
    connectedLink ||
    importUrl.trim() ||
    bookingImportPlaceholder;

  const sortedCatalog = useMemo(
    () => [...catalog].sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  function handleImport() {
    setMessage(null);
    startImport(async () => {
      const result = await importBookingMenuForTrainCara(importUrl);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (result.regulated) {
        setMessage(
          "That link looks like a regulated business — add your services manually instead.",
        );
        return;
      }
      setReview({
        services: result.services,
        bookingUrl: result.bookingUrl,
        quality: result.quality,
        qualityMessage: result.qualityMessage,
        mergedCount: result.mergedCount,
      });
    });
  }

  function confirmImport() {
    if (!review) return;
    setMessage(null);
    startSave(async () => {
      const result = await applyBookingMenuImportForTrainCara(review);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const mergedCount = review.mergedCount;
      onCatalogChange(result.services, result.servicesOffered);
      setReview(null);
      const nextLink = review.bookingUrl || importUrl;
      setConnectedLink(nextLink);
      setImportUrl(nextLink);
      setEditingLink(false);
      setMessage(
        formatBookingImportSuccessMessage(result.services.length, mergedCount),
      );
    });
  }

  function openEdit(item?: ServiceCatalogItem) {
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
  }

  function saveEdit() {
    setMessage(null);

    startSave(async () => {
      const result = await upsertServiceCatalogItemForTrainCara(editDraft);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onCatalogChange(result.services, result.servicesOffered);
      setEditOpen(false);
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startSave(async () => {
      const result = await deleteServiceCatalogItemForTrainCara(id);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onCatalogChange(result.services, result.servicesOffered);
    });
  }

  return (
    <CaraTrainingStepShell
      title={title}
      subtitle={subtitle}
      compact
    >
      <div className="w-full space-y-3">
        <ServicesCollapsibleSection
          open={linkPanelOpen}
          onToggle={toggleLinkPanel}
          title={bookingImportLabel}
          summary={linkPanelSummary}
          disabled={busy}
        >
          {showConnectedLink ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className={SERVICES_TOOLBAR_LINK_BOX}>
                <span className="min-w-0 truncate text-[13px] font-medium text-slate-900">
                  {connectedLink}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  openLinkPanel();
                  setEditingLink(true);
                  setImportUrl(connectedLink);
                }}
                disabled={busy}
                className={cn(SERVICES_TOOLBAR_OUTLINE_BTN, "sm:shrink-0")}
              >
                Change link
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                placeholder={bookingImportPlaceholder}
                disabled={busy}
                className={SERVICES_TOOLBAR_INPUT}
                aria-label={bookingImportLabel}
              />
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={busy || !importUrl.trim()}
                  className={SERVICES_TOOLBAR_PRIMARY_BTN}
                >
                  {importing ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  Import
                </button>
                {editingLink && connectedLink ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLink(false);
                      setImportUrl(connectedLink);
                    }}
                    disabled={busy}
                    className={SERVICES_TOOLBAR_OUTLINE_BTN}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <p className={cn(ONBOARDING_FIELD_HINT, "!mt-0")}>{bookingImportHint}</p>
        </ServicesCollapsibleSection>

        {message ? (
          <p className="text-[13px] text-slate-600" role="status">
            {message}
          </p>
        ) : null}

        {review ? (
          <div
            className={cn(
              TRAINING_SURFACE,
              "space-y-2 p-4",
            )}
          >
            <p className="text-[13px] font-medium text-slate-900">
              Review imported services ({review.services.length})
            </p>
            {review.quality === "low" && review.qualityMessage ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
                {review.qualityMessage}
              </p>
            ) : null}
            <ul className="max-h-28 space-y-1 overflow-y-auto text-[12.5px] text-slate-600">
              {review.services.map((s, i) => (
                <li key={`${s.name}-${i}`}>
                  {formatServiceCatalogLine({
                    name: s.name,
                    price: s.price ?? 0,
                    durationMinutes: s.durationMinutes ?? 0,
                  })}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={confirmImport}
                disabled={busy}
                className={cn(
                  SERVICES_TOOLBAR_PRIMARY_BTN,
                  "h-9 rounded-lg px-3 text-[12.5px]",
                )}
              >
                Use these services
              </button>
              <button
                type="button"
                onClick={() => setReview(null)}
                className={cn(
                  SERVICES_TOOLBAR_OUTLINE_BTN,
                  "h-9 rounded-lg px-3 text-[12.5px]",
                )}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200/90 bg-white/80">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <p className="text-[13px] font-medium text-slate-900">
              {servicesCopy.catalogListLabel}
              {catalog.length > 0 ? ` (${catalog.length})` : ""}
            </p>
            <button
              type="button"
              onClick={() => openEdit()}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700 disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden />
              Add service
            </button>
          </div>
          {sortedCatalog.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] leading-relaxed text-slate-500">
              No services yet — import from a booking link or add them manually.
            </p>
          ) : (
            <ul className="max-h-[min(16rem,35vh)] divide-y divide-slate-100 overflow-y-auto">
              {sortedCatalog.map((service) => (
                <li
                  key={service.id}
                  className="flex items-start justify-between gap-2 px-4 py-2.5 hover:bg-slate-50/80"
                >
                  <button
                    type="button"
                    onClick={() => openEdit(service)}
                    disabled={busy}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[13.5px] font-medium text-slate-900">
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
                    disabled={busy}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Delete ${service.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FaqOnlySkipHint caraGoal={caraGoal} onSkip={onSkip} disabled={busy} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="px-5 pt-5 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {editDraft.id ? "Edit service" : "Add service"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(24rem,60vh)] space-y-3 overflow-y-auto px-5 py-4">
            <Field label="Service name" htmlFor="train-svc-name">
              <input
                id="train-svc-name"
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder={servicesCopy.primaryPlaceholder}
                className={INPUT_CLASS}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (€)" htmlFor="train-svc-price">
                <input
                  id="train-svc-price"
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
              <Field label="Duration (mins)" htmlFor="train-svc-duration">
                <input
                  id="train-svc-duration"
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
                  placeholder="60"
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
              className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending || !editDraft.name.trim()}
              className="rounded-lg bg-[#0b1220] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete service?"
        description="This removes the service from Cara's menu."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      />
    </CaraTrainingStepShell>
  );
}

function GenericServicesStep({
  title,
  subtitle,
  helper,
  caraGoal,
  servicesCopy,
  servicesOfferedRaw,
  onServicesOfferedRawChange,
  onSkip,
  disabled,
}: Omit<Props, "niche" | "catalog" | "onCatalogChange" | "bookingLinkUrl">) {
  return (
    <CaraTrainingStepShell
      title={title}
      subtitle={subtitle}
      compact
    >
      <div className="w-full space-y-3">
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-slate-600">
            {servicesCopy.plainEnglishLabel}
          </p>
          <ExpandableTrainingTextarea
            value={servicesOfferedRaw}
            onChange={onServicesOfferedRawChange}
            placeholder={servicesCopy.primaryPlaceholder}
            aria-label={servicesCopy.plainEnglishLabel}
            disabled={disabled}
            collapsedHeight={SERVICES_PLAIN_ENGLISH_TEXTAREA.collapsedHeight}
            expandedHeight={SERVICES_PLAIN_ENGLISH_TEXTAREA.expandedHeight}
          />
          {helper ? (
            <p className="text-[11px] leading-relaxed text-slate-400">{helper}</p>
          ) : null}
        </div>

        <FaqOnlySkipHint caraGoal={caraGoal} onSkip={onSkip} disabled={disabled} />
      </div>
    </CaraTrainingStepShell>
  );
}
