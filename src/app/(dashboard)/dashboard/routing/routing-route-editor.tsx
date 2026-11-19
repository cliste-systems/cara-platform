"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  PhoneForwarded,
  Sparkles,
} from "lucide-react";

import { CaptureFieldsChipEditor } from "@/components/agent-knowledge/capture-fields-chip-editor";
import type { CaraCaptureField } from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import { DashboardSelect } from "@/components/dashboard/dashboard-select";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessFileListItem } from "@/lib/business-files";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { cn } from "@/lib/utils";

import {
  applyBookingFulfilmentMethod,
  BOOKING_FULFILMENT_OPTIONS,
  defaultBookingCaptureFields,
  inferBookingFulfilmentMethod,
  syncBookingRouteFromCaptureFields,
  type BookingFulfilmentMethod,
} from "./booking-fulfilment";
import {
  caraLocationDisplay,
  fillLocationLinksFromCara,
  hasCaraLocation,
  locationLinksNeedFill,
  switchRouteActionType,
  type RoutingCaraContext,
} from "./routing-cara-context";
import {
  isFallbackRoute,
  isSpeakToPersonBuiltin,
  routeActionType,
  routeTemplateUsesLinkDelivery,
  type RouteLinkDelivery,
  type SavedRoute,
} from "./route-models";
import {
  ROUTE_ACTION_TYPES,
  type RouteActionType,
  type SuggestRouteNameFn,
} from "./route-templates";
import type { RoutingSetupContext } from "./routing-setup-context";
import { isValidHttpUrl, type RouteLintWarning } from "./routing-validation";

type RoutingRouteEditorProps = {
  route: SavedRoute;
  sendableFiles: BusinessFileListItem[];
  caraContext: RoutingCaraContext;
  setupContext: RoutingSetupContext;
  /** Names already used by other routes (for distinct AI suggestions). */
  otherNames?: string[];
  lintWarnings?: RouteLintWarning[];
  onChange: (route: SavedRoute) => void;
  onSave: () => void;
  onCancel: () => void;
  onSuggestName?: SuggestRouteNameFn;
  isNew?: boolean;
  /** Only link / file / transfer destination controls (embedded in route creator). */
  destinationOnly?: boolean;
  bookingFulfilmentMethod?: BookingFulfilmentMethod;
  bookingCaptureFields?: CaraCaptureField[];
  onBookingCaptureFieldsChange?: (fields: CaraCaptureField[]) => void;
};

const ACTION_ICON: Record<RouteActionType, typeof Link2> = {
  send_link: Link2,
  send_file: FileText,
  directions: MapPin,
  take_message: MessageSquareText,
  email: Mail,
  whatsapp: MessageCircle,
  transfer: PhoneCall,
};

export function RoutingRouteEditor({
  route,
  sendableFiles,
  caraContext,
  setupContext,
  otherNames = [],
  lintWarnings = [],
  onChange,
  onSave,
  onCancel,
  onSuggestName,
  isNew = false,
  destinationOnly = false,
  bookingFulfilmentMethod,
  bookingCaptureFields,
  onBookingCaptureFieldsChange,
}: RoutingRouteEditorProps) {
  const patch = (partial: Partial<SavedRoute>) => onChange({ ...route, ...partial });
  const fallback = isFallbackRoute(route);
  const builtinSpeak = isSpeakToPersonBuiltin(route);
  const activeType = routeActionType(route);
  const canSave = fallback || builtinSpeak || route.name.trim().length > 0;
  const isBookingRoute = route.templateId === "booking-inquiry";
  const resolvedBookingMethod =
    bookingFulfilmentMethod ??
    (isBookingRoute ? inferBookingFulfilmentMethod(route) : "link");
  const [internalCaptureFields, setInternalCaptureFields] = useState<
    CaraCaptureField[]
  >(() =>
    defaultBookingCaptureFields(
      setupContext.niche,
      setupContext.businessType,
      setupContext.captureFields.length > 0
        ? setupContext.captureFields
        : undefined,
    ),
  );

  const bookingKey = JSON.stringify([isBookingRoute, route.id, route.outcome, route.description, setupContext.niche, setupContext.businessType, setupContext.captureFields]);
  const [lastBookingKey, setLastBookingKey] = useState<typeof bookingKey | undefined>(undefined);
  if (lastBookingKey !== bookingKey) {
    setLastBookingKey(bookingKey);
    if (isBookingRoute) {
      setInternalCaptureFields(
        defaultBookingCaptureFields(
          setupContext.niche,
          setupContext.businessType,
          setupContext.captureFields.length > 0
            ? setupContext.captureFields
            : undefined,
        ),
      );
    }
  }

  const activeCaptureFields = bookingCaptureFields ?? internalCaptureFields;
  const handleCaptureFieldsChange =
    onBookingCaptureFieldsChange ??
    ((fields: CaraCaptureField[]) => {
      setInternalCaptureFields(fields);
      if (resolvedBookingMethod !== "link") {
        onChange(
          syncBookingRouteFromCaptureFields(route, resolvedBookingMethod, fields),
        );
      }
    });

  const showBookingLinkFields =
    isBookingRoute &&
    (resolvedBookingMethod === "link" || resolvedBookingMethod === "both");
  const showBookingCaptureFields =
    isBookingRoute &&
    (resolvedBookingMethod === "callback" || resolvedBookingMethod === "both");

  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  const selectedFileName =
    sendableFiles.find((f) => f.id === route.businessFileId)?.fileName ?? "";

  if (destinationOnly) {
    return (
      <div className="space-y-3">
        {route.templateId === "location" ? (
          <LocationRouteFields
            route={route}
            caraContext={caraContext}
            onChange={onChange}
          />
        ) : null}

        {showBookingLinkFields ? (
          <>
            {resolvedBookingMethod === "both" ? (
              <p className="text-[12px] font-medium text-[#0b1220]">
                Which booking link?
              </p>
            ) : null}
            <LinkDeliveryFields
              route={route}
              onChange={onChange}
              label="Send booking link via"
            />
            <SendDestinationField
              files={sendableFiles}
              url={route.url}
              fileId={route.businessFileId}
              onSelectLink={(url) =>
                patch({ url, businessFileId: null, outcome: "send_link" })
              }
              onSelectFile={(id) =>
                patch({
                  businessFileId: id,
                  url: "",
                  outcome: "send_file",
                  templateId: "brochure",
                })
              }
            />
          </>
        ) : null}

        {showBookingCaptureFields ? (
          <div className="space-y-2">
            {resolvedBookingMethod === "both" ? (
              <p className="text-[12px] font-medium text-[#0b1220]">
                What should Cara note down?
              </p>
            ) : null}
            <CaptureFieldsChipEditor
              captureFields={activeCaptureFields}
              onCaptureFieldsChange={handleCaptureFieldsChange}
              businessType={setupContext.businessType}
              niche={setupContext.niche}
            />
            <p className="text-[11px] text-slate-500">
              Name and phone are always collected. This is a booking request — not
              a confirmed appointment.
            </p>
          </div>
        ) : null}

        {route.outcome === "send_link" &&
        route.templateId !== "location" &&
        route.templateId !== "booking-inquiry" ? (
          <SendDestinationField
            files={sendableFiles}
            url={route.url}
            fileId={route.businessFileId}
            onSelectLink={(url) =>
              patch({ url, businessFileId: null, outcome: "send_link" })
            }
            onSelectFile={(id) =>
              patch({
                businessFileId: id,
                url: "",
                outcome: "send_file",
                templateId: "brochure",
              })
            }
          />
        ) : null}

        {route.outcome === "send_file" && route.templateId !== "location" ? (
          <SendDestinationField
            files={sendableFiles}
            url={route.url}
            fileId={route.businessFileId}
            onSelectLink={(url) =>
              patch({ url, businessFileId: null, outcome: "send_link" })
            }
            onSelectFile={(id) =>
              patch({
                businessFileId: id,
                url: "",
                outcome: "send_file",
                templateId: "brochure",
              })
            }
          />
        ) : null}

        {route.outcome === "transfer" ? (
          <TransferRouteFields route={route} setup={setupContext} onChange={onChange} />
        ) : null}
      </div>
    );
  }

  const handleSuggest = async () => {
    if (!onSuggestName || suggesting) return;
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const res = await onSuggestName({
        actionType: activeType,
        url:
          activeType === "send_link" || activeType === "directions"
            ? route.url.trim()
            : undefined,
        fileName: activeType === "send_file" ? selectedFileName : undefined,
        currentName: route.name,
        existingNames: otherNames,
      });
      if (res.ok) {
        patch({ name: res.name });
      } else {
        setSuggestNote("Couldn't suggest a name just now — type one in.");
      }
    } catch {
      setSuggestNote("Couldn't suggest a name just now — type one in.");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-[#0b1220]/15 bg-slate-50/60 p-4 sm:p-5">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {isNew ? "New action" : "Edit action"}
      </p>

      <div className="mt-3 space-y-4">
        {!fallback && !builtinSpeak ? (
          <div className="space-y-1.5">
            <Label className="text-[12px] text-slate-600">What should Cara do?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROUTE_ACTION_TYPES.map((meta) => {
                const Icon = ACTION_ICON[meta.id];
                const selected = meta.id === activeType;
                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() =>
                      onChange(switchRouteActionType(route, meta.id, caraContext))
                    }
                    aria-pressed={selected}
                    title={meta.description}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-[#0b1220] bg-[#0b1220] text-white"
                        : "border-slate-200 bg-white text-[#0b1220] hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="text-[12.5px] font-medium leading-tight">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : builtinSpeak ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
            Built-in handling when callers ask for a person. Configure transfer in
            Settings; toggle opening-hours behaviour below.
          </p>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
            This is your safety net. When a caller asks for something you haven&apos;t
            set up, Cara takes a message so nothing is lost. You can edit the note;
            it can&apos;t be removed.
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="route-name" className="text-[13px] font-semibold text-[#0b1220]">
              What does the caller say?{" "}
              {!fallback ? <span className="text-red-500">*</span> : null}
            </Label>
            {!fallback && onSuggestName ? (
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0b1220] underline-offset-2 hover:underline disabled:opacity-50"
              >
                <Sparkles
                  className={cn("size-3.5", suggesting && "animate-pulse")}
                  aria-hidden
                />
                {suggesting ? "Thinking…" : "Suggest"}
              </button>
            ) : null}
          </div>

          {!fallback && !builtinSpeak ? (
            <div className="rounded-xl border border-[#0b1220]/15 bg-slate-900/[0.03] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <MessageSquareText
                  className="mt-0.5 size-4 shrink-0 text-[#0b1220]"
                  aria-hidden
                />
                <div className="space-y-1">
                  <p className="text-[12px] leading-relaxed text-[#0b1220]">
                    <span className="font-semibold">
                      This is the most important box on the page.
                    </span>{" "}
                    Write the actual thing a caller asks for, in their own words —
                    the way they&apos;d say it out loud on the phone. It is{" "}
                    <span className="font-medium">not</span> a title or a label for
                    you. Cara listens for this to decide what to do.
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Say it like a caller would:{" "}
                    <span className="font-medium text-[#0b1220]">
                      &ldquo;book an appointment&rdquo;
                    </span>
                    ,{" "}
                    <span className="font-medium text-[#0b1220]">
                      &ldquo;how much is a haircut&rdquo;
                    </span>
                    ,{" "}
                    <span className="font-medium text-[#0b1220]">
                      &ldquo;where are you based&rdquo;
                    </span>
                    . Avoid vague titles like{" "}
                    <span className="font-medium">&ldquo;Promo&rdquo;</span> or{" "}
                    <span className="font-medium">&ldquo;Link 1&rdquo;</span> — Cara
                    won&apos;t know when to use them, and the call will fall through
                    to a message.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <Input
            id="route-name"
            value={route.name}
            onChange={(e) => patch({ name: e.target.value })}
            className={DASHBOARD_INPUT_CLASS}
            placeholder='e.g. "Can I book an appointment?"'
            disabled={fallback}
            maxLength={48}
          />
          <p className="text-[11px] text-slate-500">
            {suggestNote ??
              "One topic per action. If a caller wouldn't say it out loud, Cara can't match it."}
          </p>

          {lintWarnings.length > 0 ? (
            <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
              {lintWarnings.map((w) => (
                <li
                  key={w.id}
                  className="text-[11.5px] leading-relaxed text-amber-950"
                >
                  {w.message}{" "}
                  {w.href ? (
                    <Link
                      href={w.href}
                      className="font-semibold underline underline-offset-2"
                    >
                      {w.linkLabel ?? "Review"}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {isBookingRoute && !destinationOnly ? (
          <div className="space-y-1.5">
            <Label className="text-[12px] text-slate-600">
              How should booking be fulfilled?
            </Label>
            <DashboardSelect
              value={resolvedBookingMethod}
              aria-label="Booking fulfilment method"
              options={BOOKING_FULFILMENT_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onValueChange={(value) =>
                onChange(
                  applyBookingFulfilmentMethod(
                    route,
                    value as BookingFulfilmentMethod,
                    activeCaptureFields,
                  ),
                )
              }
            />
          </div>
        ) : null}

        {route.templateId === "location" ? (
          <LocationRouteFields
            route={route}
            caraContext={caraContext}
            onChange={onChange}
          />
        ) : null}

        {showBookingLinkFields ? (
          <>
            <LinkDeliveryFields
              route={route}
              onChange={onChange}
              label="Send booking link via"
            />
            <SendDestinationField
              files={sendableFiles}
              url={route.url}
              fileId={route.businessFileId}
              onSelectLink={(url) =>
                patch({ url, businessFileId: null, outcome: "send_link" })
              }
              onSelectFile={(id) =>
                patch({
                  businessFileId: id,
                  url: "",
                  outcome: "send_file",
                  templateId: "brochure",
                })
              }
            />
          </>
        ) : null}

        {showBookingCaptureFields ? (
          <div className="space-y-2">
            <Label className="text-[12px] text-slate-600">
              What should Cara note down?
            </Label>
            <CaptureFieldsChipEditor
              captureFields={activeCaptureFields}
              onCaptureFieldsChange={handleCaptureFieldsChange}
              businessType={setupContext.businessType}
              niche={setupContext.niche}
            />
            <p className="text-[11px] text-slate-500">
              Name and phone are always collected. This is a booking request — not
              a confirmed appointment.
            </p>
          </div>
        ) : null}

        {route.outcome === "send_link" &&
        route.templateId !== "location" &&
        route.templateId !== "booking-inquiry" ? (
          <SendDestinationField
            files={sendableFiles}
            url={route.url}
            fileId={route.businessFileId}
            onSelectLink={(url) =>
              patch({ url, businessFileId: null, outcome: "send_link" })
            }
            onSelectFile={(id) =>
              patch({
                businessFileId: id,
                url: "",
                outcome: "send_file",
                templateId: "brochure",
              })
            }
          />
        ) : null}

        {route.outcome === "send_file" && route.templateId !== "location" ? (
          <SendDestinationField
            files={sendableFiles}
            url={route.url}
            fileId={route.businessFileId}
            onSelectLink={(url) =>
              patch({ url, businessFileId: null, outcome: "send_link" })
            }
            onSelectFile={(id) =>
              patch({
                businessFileId: id,
                url: "",
                outcome: "send_file",
                templateId: "brochure",
              })
            }
          />
        ) : null}

        {route.outcome === "transfer" ? (
          <TransferRouteFields route={route} setup={setupContext} onChange={onChange} />
        ) : null}

        {route.outcome === "action_inbox" && route.templateId !== "booking-inquiry" ? (
          <div className="space-y-1.5">
            <Label htmlFor="route-note" className="text-[12px] text-slate-600">
              What should Cara capture? (optional)
            </Label>
            <Textarea
              id="route-note"
              value={route.note}
              rows={2}
              onChange={(e) => patch({ note: e.target.value })}
              className={cn(DASHBOARD_INPUT_CLASS, "min-h-[4rem]")}
              placeholder="e.g. Their name, number, and what they need."
            />
            <p className="text-[11px] text-slate-500">Creates a follow-up in your Action Inbox.</p>
          </div>
        ) : null}

        {route.outcome === "email" ? (
          <EmailRouteField
            value={route.email}
            caraContext={caraContext}
            onChange={(email) => patch({ email })}
          />
        ) : null}

        {route.outcome === "whatsapp" ? (
          <WhatsAppRouteField
            value={route.whatsapp}
            caraContext={caraContext}
            onChange={(whatsapp) => patch({ whatsapp })}
          />
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={DASHBOARD_PRIMARY_BUTTON_CLASS}
        >
          {isNew ? "Add to flow" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={DASHBOARD_SECONDARY_BUTTON_CLASS}
        >
          Cancel
        </Button>
        {!canSave ? (
          <span className="text-[11px] text-slate-500">Add a name to continue.</span>
        ) : null}
      </div>
    </div>
  );
}

function CaraSetupPrompt({
  message,
  href = DASHBOARD_ROUTES.businessProfile,
  linkLabel = "Cara Setup",
}: {
  message: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950">
      {message}{" "}
      <Link href={href} className="font-semibold underline underline-offset-2">
        {linkLabel}
      </Link>{" "}
      to continue.
    </div>
  );
}

function LinkDeliveryFields({
  route,
  onChange,
  label,
}: {
  route: SavedRoute;
  onChange: (route: SavedRoute) => void;
  label: string;
}) {
  if (!routeTemplateUsesLinkDelivery(route.templateId)) return null;

  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] text-slate-600">{label}</Label>
      <DashboardSelect
        value={route.linkDelivery ?? "sms"}
        aria-label={label}
        options={[
          { value: "sms", label: "Text message (SMS)" },
          { value: "email", label: "Email" },
          { value: "both", label: "Text or email — Cara asks which they prefer" },
        ]}
        onValueChange={(value) =>
          onChange({ ...route, linkDelivery: value as RouteLinkDelivery })
        }
      />
    </div>
  );
}

function LocationRouteFields({
  route,
  caraContext,
  onChange,
}: {
  route: SavedRoute;
  caraContext: RoutingCaraContext;
  onChange: (route: SavedRoute) => void;
}) {
  const hasLocation = hasCaraLocation(caraContext);
  const display = caraLocationDisplay(caraContext);

  if (!hasLocation) {
    return <CaraSetupPrompt message="Add your business address in" />;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[12px] text-slate-600">Address (from Cara Setup)</Label>
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-[#0b1220]">
          {display}
        </p>
        <p className="text-[11px] text-slate-500">
          Cara says this address on the call, then sends a maps link by text or
          email — your choice below. Update the address in{" "}
          <Link href={DASHBOARD_ROUTES.businessProfile} className="font-medium underline">
            Cara Setup
          </Link>
          .
        </p>
      </div>

      <LinkDeliveryFields
        route={route}
        onChange={onChange}
        label="Send maps link via"
      />

      {locationLinksNeedFill(route) ? (
        <Button
          type="button"
          variant="outline"
          className={DASHBOARD_SECONDARY_BUTTON_CLASS}
          onClick={() => onChange(fillLocationLinksFromCara(route, caraContext))}
        >
          Use address for maps link
        </Button>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="route-url" className="text-[12px] text-slate-600">
          Maps link to send
        </Label>
        <Input
          id="route-url"
          value={route.url}
          type="url"
          placeholder="https://maps.google.com/…"
          onChange={(e) => onChange({ ...route, url: e.target.value })}
          className={DASHBOARD_INPUT_CLASS}
        />
        <p className="text-[11px] text-slate-500">
          Prefilled from your address — edit if you use a different maps link.
        </p>
      </div>
    </div>
  );
}

function EmailRouteField({
  value,
  caraContext,
  onChange,
}: {
  value: string;
  caraContext: RoutingCaraContext;
  onChange: (email: string) => void;
}) {
  const preset = caraContext.notificationEmail.trim();

  return (
    <div className="space-y-3">
      {!value.trim() && !preset ? (
        <CaraSetupPrompt
          message="Add a notification email in"
          href={DASHBOARD_ROUTES.settings}
          linkLabel="Settings"
        />
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="route-email" className="text-[12px] text-slate-600">
          Email address
        </Label>
        <Input
          id="route-email"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={DASHBOARD_INPUT_CLASS}
          placeholder={preset || "you@business.ie"}
        />
        {preset ? (
          <p className="text-[11px] text-slate-500">
            Prefilled from Settings. Cara can collect details and your team gets notified.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WhatsAppRouteField({
  value,
  caraContext,
  onChange,
}: {
  value: string;
  caraContext: RoutingCaraContext;
  onChange: (whatsapp: string) => void;
}) {
  const preset = caraContext.notificationPhone.trim();

  return (
    <div className="space-y-3">
      {!value.trim() && !preset ? (
        <CaraSetupPrompt
          message="Add a notification phone in"
          href={DASHBOARD_ROUTES.settings}
          linkLabel="Settings"
        />
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="route-wa" className="text-[12px] text-slate-600">
          WhatsApp number or link
        </Label>
        <Input
          id="route-wa"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={DASHBOARD_INPUT_CLASS}
          placeholder={preset ? "https://wa.me/…" : "+353…"}
        />
        {preset ? (
          <p className="text-[11px] text-slate-500">
            Prefilled from your notification phone in Settings.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SendDestinationField({
  files,
  url,
  fileId,
  onSelectLink,
  onSelectFile,
}: {
  files: BusinessFileListItem[];
  url: string;
  fileId: string | null;
  onSelectLink: (url: string) => void;
  onSelectFile: (id: string) => void;
}) {
  const [linkMode, setLinkMode] = useState(() => !fileId && url.trim().length > 0);

  const selectedKey = fileId
    ? `file:${fileId}`
    : linkMode || url.trim()
      ? "link:custom"
      : "";

  const destinationOptions = [
    ...files.map((f) => ({
      value: `file:${f.id}` as const,
      label: f.fileName,
    })),
    { value: "link:custom" as const, label: "Paste a link…" },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[12px] text-slate-600">What Cara can text</Label>
        <DashboardSelect
          value={selectedKey}
          placeholder="Choose a link or file…"
          aria-label="What Cara can text"
          options={destinationOptions}
          onValueChange={(v) => {
            if (v.startsWith("file:")) {
              setLinkMode(false);
              onSelectFile(v.slice(5));
            } else if (v === "link:custom") {
              setLinkMode(true);
              onSelectLink(url);
            } else {
              setLinkMode(false);
              onSelectLink("");
            }
          }}
        />
      </div>

      {linkMode || (url.trim() && !fileId) ? (
        <div className="space-y-1.5">
          <Label htmlFor="route-url" className="text-[12px] text-slate-600">
            Link to send
          </Label>
          <Input
            id="route-url"
            value={url}
            type="url"
            placeholder="https://…"
            onChange={(e) => onSelectLink(e.target.value)}
            className={cn(
              DASHBOARD_INPUT_CLASS,
              url.trim() && !isValidHttpUrl(url) && "border-amber-400",
            )}
          />
          {url.trim() && !isValidHttpUrl(url) ? (
            <p className="text-[11px] text-amber-800">
              Enter a full https:// address — broken links fail on live calls.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              On landlines or when SMS quota is used up, Cara takes a message
              instead of failing silently.
            </p>
          )}
        </div>
      ) : null}

      {files.length === 0 && !url.trim() ? (
        <p className="text-[11px] text-slate-500">
          Upload sendable files in{" "}
          <Link
            href={DASHBOARD_ROUTES.businessFiles}
            className="font-medium underline underline-offset-2"
          >
            Files
          </Link>
          , or paste a web link above.
        </p>
      ) : null}
    </div>
  );
}

function TransferRouteFields({
  route,
  setup,
  onChange,
}: {
  route: SavedRoute;
  setup: RoutingSetupContext;
  onChange: (route: SavedRoute) => void;
}) {
  if (!setup.transferAllowed) {
    return (
      <CaraSetupPrompt
        message="Add a transfer number in"
        href={DASHBOARD_ROUTES.settings}
        linkLabel="Settings"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="flex items-start gap-2">
          <PhoneForwarded className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <div className="space-y-1">
            <p className="text-[12.5px] text-[#0b1220]">
              Cara puts callers through to{" "}
              <span className="font-semibold">{setup.transferNumber}</span>
            </p>
            <p className="text-[11px] leading-relaxed text-slate-600">
              She says she&apos;ll try to connect — if there&apos;s no answer or
              the line is busy, she takes a message instead of ringing out in
              silence.
            </p>
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={route.transferDuringHoursOnly === true}
          onChange={(e) =>
            onChange({ ...route, transferDuringHoursOnly: e.target.checked })
          }
          className="mt-0.5 size-4 rounded border-slate-300"
        />
        <span className="text-[12px] leading-relaxed text-slate-700">
          <span className="font-medium text-[#0b1220]">Only during opening hours</span>
          {" — "}
          after hours, go straight to taking a message.
        </span>
      </label>
    </div>
  );
}
