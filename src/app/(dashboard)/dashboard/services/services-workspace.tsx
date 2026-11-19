"use client";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { UnsavedDraftGuard } from "@/components/dashboard/unsaved-draft-guard";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  Plus,
  Search,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Field } from "@/components/dashboard/field";
import { DashboardSelect } from "@/components/dashboard/dashboard-select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DASHBOARD_PRIMARY_BUTTON_CLASS as primary,
  DASHBOARD_SECONDARY_BUTTON_CLASS as secondary,
} from "@/components/dashboard/dashboard-surface";
import {
  serviceDetails,
  SERVICE_PRICE_LABELS,
  validateService,
} from "@/lib/service-details";
import {
  formatServiceCatalogLine,
  type ServiceCatalogItem,
  type ServiceDetails,
  type ServicePriceMode,
} from "@/lib/service-catalog-format";
import { publishServices } from "./actions";

export function ServicesWorkspace({
  initialServices,
  initialVersion,
  initialExcluded,
  initialQuotePrices,
  canManage,
}: {
  initialServices: ServiceCatalogItem[];
  initialVersion: string;
  initialExcluded: string;
  initialQuotePrices: boolean;
  canManage: boolean;
}) {
  const [services, setServices] = useState(initialServices),
    [version, setVersion] = useState(initialVersion),
    [excluded, setExcluded] = useState(initialExcluded),
    [savedExcluded, setSavedExcluded] = useState(initialExcluded),
    [quote, setQuote] = useState(initialQuotePrices);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("active"),
    [draft, setDraft] = useState<ServiceCatalogItem | null>(null),
    [original, setOriginal] = useState(""),
    [error, setError] = useState<string | null>(null),
    [pending, startTransition] = useTransition(),
    [discard, setDiscard] = useState(false);
  const [page, setPage] = useState(1);
  const dirty =
    Boolean(draft && JSON.stringify(draft) !== original) ||
    excluded !== savedExcluded;

  const visible = useMemo(
    () =>
      services.filter(
        (s) =>
          (filter === "archived"
            ? serviceDetails(s).status === "archived"
            : serviceDetails(s).status !== "archived") &&
          `${s.name} ${s.category ?? ""} ${s.description ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [services, filter, search],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 10)));
  const edit = (service: ServiceCatalogItem) => {
    setDraft({ ...service, details: serviceDetails(service) });
    setOriginal(
      JSON.stringify({ ...service, details: serviceDetails(service) }),
    );
    setError(null);
  };
  const close = () => {
    if (dirty) {
      setDiscard(true);
      return;
    }
    setDraft(null);
    setError(null);
  };
  function save(service?: ServiceCatalogItem, quotePrices = quote) {
    setError(null);
    if (service) {
      const invalid = validateService(service);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    startTransition(async () => {
      try {
        const result = await publishServices({
          version,
          service,
          excluded,
          quotePrices,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setServices(result.services);
        setVersion(result.version);
        setSavedExcluded(result.excluded);
        setQuote(result.quotePrices);
        setDraft(null);
        setOriginal("");
      } catch {
        setError(
          "We couldn’t save your service. Your draft is still here. Please try again.",
        );
      }
    });
  }
  const detail = draft ? serviceDetails(draft) : null;
  const change = (patch: Partial<ServiceCatalogItem>) => {
    if (draft) setDraft({ ...draft, ...patch });
    setError(null);
  };
  const changeDetails = (patch: Partial<ServiceDetails>) => {
    if (draft) change({ details: { ...serviceDetails(draft), ...patch } });
  };
  const priced =
    detail && ["fixed", "from", "range", "hourly"].includes(detail.priceMode);
  const durationFactor =
    detail?.durationUnit === "day"
      ? 1440
      : detail?.durationUnit === "hour"
        ? 60
        : 1;
  const activeCount = services.filter(
    (s) => serviceDetails(s).status !== "archived",
  ).length;
  return (
    <div className="space-y-6 pb-6">
      <UnsavedDraftGuard dirty={dirty && !pending} />
      <ClistePageHeader tone="business" icon={BriefcaseBusiness} title="Services" description="What you offer, what it costs and what callers need to know." actions={
        canManage && (
          <Button
            className={primary}
            onClick={() =>
              edit({
                id: crypto.randomUUID(),
                name: "",
                category: null,
                price: 0,
                durationMinutes: 0,
                description: null,
                aiVoiceNotes: null,
                policyFlags: [],
                source: "manual",
                details: {
                  priceMode: "unset",
                  durationMode: "unset",
                  status: "available",
                },
              })
            }
          >
            <Plus className="size-4" />
            Add service
          </Button>
        )
      } />
      {!draft && <FormFeedback message={error} focusOnError />}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-xl border border-[#d9e2dd] bg-white">
          <div className="flex flex-wrap gap-3 border-b border-[#d9e2dd] p-4">
            <div className="relative min-w-40 flex-1">
              <Search
                aria-hidden
                className="absolute left-3 top-3 size-4 text-slate-500"
              />
              <Input
                aria-label="Search services"
                value={search}
                onChange={(e) => {setSearch(e.target.value); setPage(1);}}
                placeholder="Search services"
                className="min-h-11 pl-9"
              />
            </div>
            <DashboardSelect
              aria-label="Service list"
              value={filter}
              onValueChange={(value) => {setFilter(value); setPage(1);}}
              options={[
                { value: "active", label: `Current (${activeCount})` },
                { value: "archived", label: "Archived" },
              ]}
              className="w-auto min-w-36"
            />
          </div>
          <div className="divide-y divide-[#e3e9e5]">
            {visible.slice((currentPage - 1) * 10, currentPage * 10).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => edit(s)}
                className="group flex w-full items-start justify-between gap-3 px-5 py-5 text-left transition-colors hover:bg-[#f7f9f8]"
              >
                <div className="min-w-0">
                  <h2 className="line-clamp-2 break-words text-[15px] font-semibold">
                    {s.name}
                  </h2>
                  {s.category && (
                    <p className="mt-1 text-xs text-[#6b7c75]">{s.category}</p>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm text-[#5b6b65]">
                    {formatServiceCatalogLine(s)
                      .split(" — ")
                      .slice(1)
                      .join(" · ") || "Price and duration not listed"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#d9e2dd] px-2.5 py-1 text-[11px] text-[#5b6b65]">
                  {serviceDetails(s).status === "available"
                    ? "Offered"
                    : serviceDetails(s).status === "archived"
                      ? "Archived"
                      : "Paused"}
                </span>
              </button>
            ))}
          </div>
          {visible.length > 10 && <nav aria-label="Service pages" className="flex items-center justify-between gap-2 border-t border-[#d9e2dd] p-3"><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-xs text-[#5b6b65]">{currentPage} / {Math.ceil(visible.length / 10)}</span><Button variant="outline" disabled={currentPage * 10 >= visible.length} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}
          {visible.length === 0 && (
            <div className="px-6 py-12 text-center">
              <BriefcaseBusiness className="mx-auto mb-3 size-7 text-[#6b7c75]" />
              <h2 className="font-semibold">
                {search
                  ? "No matching services"
                  : filter === "archived"
                    ? "No archived services"
                    : "Add your first service"}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5b6b65]">
                {search
                  ? "Try another name or category."
                  : "Cara uses the services you approve here when answering callers."}
              </p>
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <section className="rounded-xl border border-[#d9e2dd] bg-white p-5">
            <h2 className="font-semibold">Prices on calls</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b6b65]">
              Use the prices and conditions you’ve supplied. Unlisted prices are
              never treated as free.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#353d42]"
                checked={quote}
                disabled={!canManage || pending}
                onChange={(e) => save(undefined, e.target.checked)}
              />
              Let Cara quote listed prices
            </label>
          </section>
          <section className="rounded-xl border border-[#d9e2dd] bg-white p-5">
            <Field
              label="What you don’t offer"
              htmlFor="service-exclusions"
              hint="One service per line. Cara will politely decline these."
            >
              <Textarea
                id="service-exclusions"
                value={excluded}
                disabled={!canManage || pending}
                onChange={(e) => setExcluded(e.target.value)}
                rows={4}
              />
            </Field>
            {canManage && excluded !== savedExcluded && (
              <Button
                className={`${primary} mt-4 w-full`}
                disabled={pending}
                onClick={() => save()}
              >
                {pending ? "Updating…" : "Save exclusions"}
              </Button>
            )}
          </section>
          <p className="px-1 text-xs leading-5 text-[#6b7c75]">
            Saved changes apply to future calls. Services do not create
            appointments or promise arrival times.
          </p>
        </aside>
      </div>
      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => {
          if (!open && !pending) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-[#d9e2dd] p-4 sm:p-5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to services"
              onClick={close}
              disabled={pending}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <DialogTitle className="line-clamp-2 break-words">{draft?.name || "New service"}</DialogTitle>
              <DialogDescription className="mt-1">
                Details Cara can use on calls
              </DialogDescription>
            </div>
          </div>
          {draft && detail && (
            <form
              id="service-editor"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                save(draft);
              }}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
            >
              <FormFeedback message={error} focusOnError />
              <fieldset
                disabled={!canManage || pending}
                className="space-y-5 [&_input]:min-h-11"
              >
                <Field label="Service name" htmlFor="service-name">
                  <Input
                    id="service-name"
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category (optional)" htmlFor="service-category">
                    <Input
                      id="service-category"
                      maxLength={80}
                      value={draft.category ?? ""}
                      onChange={(e) => change({ category: e.target.value })}
                    />
                  </Field>
                  <Field label="Availability" htmlFor="service-status">
                    <DashboardSelect
                      id="service-status"
                      value={detail.status!}
                      onValueChange={(status) => changeDetails({ status })}
                      options={[
                        { value: "available", label: "Offered" },
                        {
                          value: "unavailable",
                          label: "Temporarily unavailable",
                        },
                        { value: "archived", label: "Archived" },
                      ]}
                    />
                  </Field>
                </div>
                <Field label="What’s included" htmlFor="service-description">
                  <Textarea
                    id="service-description"
                    rows={3}
                    maxLength={500}
                    value={draft.description ?? ""}
                    onChange={(e) => change({ description: e.target.value })}
                  />
                </Field>
                <div className="border-t border-[#e3e9e5] pt-5">
                  <Field label="Pricing" htmlFor="service-pricing">
                    <DashboardSelect
                      id="service-pricing"
                      value={detail.priceMode}
                      onValueChange={(priceMode) =>
                        changeDetails({ priceMode })
                      }
                      options={Object.entries(SERVICE_PRICE_LABELS).map(
                        ([value, label]) => ({
                          value: value as ServicePriceMode,
                          label,
                        }),
                      )}
                    />
                  </Field>
                  {priced && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Field
                        label={
                          detail.priceMode === "range"
                            ? "From (€)"
                            : "Price (€)"
                        }
                        htmlFor="service-price"
                      >
                        <Input
                          id="service-price"
                          inputMode="decimal"
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.price || ""}
                          onChange={(e) =>
                            change({ price: Number(e.target.value) })
                          }
                        />
                      </Field>
                      {detail.priceMode === "range" && (
                        <Field label="To (€)" htmlFor="service-price-max">
                          <Input
                            id="service-price-max"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={detail.priceMax ?? ""}
                            onChange={(e) =>
                              changeDetails({
                                priceMax: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      )}
                      {detail.priceMode === "hourly" && (
                        <Field label="Per" htmlFor="service-price-unit">
                          <DashboardSelect
                            id="service-price-unit"
                            value={detail.priceUnit ?? "hour"}
                            onValueChange={(priceUnit) =>
                              changeDetails({ priceUnit })
                            }
                            options={[
                              { value: "hour", label: "Hour" },
                              { value: "day", label: "Day" },
                            ]}
                          />
                        </Field>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
                    <Field
                      label="Price conditions (optional)"
                      htmlFor="price-notes"
                      hint="Include any callout charge, minimum charge, exclusions or tax wording callers should hear."
                    >
                      <Textarea
                        id="price-notes"
                        rows={2}
                        maxLength={500}
                        value={detail.priceNotes ?? ""}
                        onChange={(e) =>
                          changeDetails({ priceNotes: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
                <div className="border-t border-[#e3e9e5] pt-5">
                  <Field label="Duration" htmlFor="service-duration-mode">
                    <DashboardSelect
                      id="service-duration-mode"
                      value={detail.durationMode!}
                      onValueChange={(durationMode) =>
                        changeDetails({ durationMode })
                      }
                      options={[
                        { value: "unset", label: "Not listed" },
                        { value: "exact", label: "Typical duration" },
                        { value: "estimate", label: "Estimated duration" },
                        { value: "range", label: "Duration range" },
                      ]}
                    />
                  </Field>
                  {detail.durationMode !== "unset" && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Field label="Time unit" htmlFor="duration-unit">
                        <DashboardSelect
                          id="duration-unit"
                          value={detail.durationUnit ?? "minute"}
                          onValueChange={(durationUnit) =>
                            changeDetails({ durationUnit })
                          }
                          options={[
                            { value: "minute", label: "Minutes" },
                            { value: "hour", label: "Hours" },
                            { value: "day", label: "Days" },
                          ]}
                        />
                      </Field>
                      <Field label="Duration" htmlFor="service-duration">
                        <Input
                          id="service-duration"
                          type="number"
                          inputMode="numeric"
                          step="any"
                          min="0"
                          value={draft.durationMinutes / durationFactor || ""}
                          onChange={(e) =>
                            change({
                              durationMinutes: Math.round(
                                Number(e.target.value) * durationFactor,
                              ),
                            })
                          }
                        />
                      </Field>
                      {detail.durationMode === "range" && (
                        <Field label="Up to" htmlFor="service-duration-max">
                          <Input
                            id="service-duration-max"
                            type="number"
                            inputMode="numeric"
                            step="any"
                            min="0"
                            value={
                              detail.durationMaxMinutes
                                ? detail.durationMaxMinutes / durationFactor
                                : ""
                            }
                            onChange={(e) =>
                              changeDetails({
                                durationMaxMinutes: Math.round(
                                  Number(e.target.value) * durationFactor,
                                ),
                              })
                            }
                          />
                        </Field>
                      )}
                    </div>
                  )}
                </div>
                <Field
                  label="Important notes for callers"
                  htmlFor="service-voice-notes"
                >
                  <Textarea
                    id="service-voice-notes"
                    maxLength={200}
                    rows={2}
                    value={draft.aiVoiceNotes ?? ""}
                    onChange={(e) => change({ aiVoiceNotes: e.target.value })}
                  />
                </Field>
                <Field
                  label="Private notes"
                  htmlFor="service-private-notes"
                  hint="For your team only. Cara never receives these notes."
                >
                  <Textarea
                    id="service-private-notes"
                    rows={2}
                    maxLength={1000}
                    value={detail.privateNotes ?? ""}
                    onChange={(e) =>
                      changeDetails({ privateNotes: e.target.value })
                    }
                  />
                </Field>
              </fieldset>
            </form>
          )}
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#d9e2dd] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {canManage && draft && (
              <>
                {services.some((s) => s.id === draft.id) && (
                  <Button
                    className={secondary}
                    disabled={pending}
                    onClick={() =>
                      save({
                        ...draft,
                        details: {
                          ...serviceDetails(draft),
                          status:
                            detail?.status === "archived"
                              ? "available"
                              : "archived",
                        },
                      })
                    }
                  >
                    {detail?.status === "archived" ? (
                      <RotateCcw className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                    {detail?.status === "archived" ? "Restore" : "Archive"}
                  </Button>
                )}
                <Button
                  type="submit"
                  form="service-editor"
                  className={`${primary} ml-auto flex-1 sm:flex-none`}
                  disabled={pending}
                >
                  {pending ? "Updating Cara…" : "Save service"}
                </Button>
              </>
            )}
          </footer>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogTitle>Discard these edits?</DialogTitle>
          <DialogDescription>
            Your saved service will stay as it is.
          </DialogDescription>
          <div className="flex gap-3">
            <Button className={secondary} onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
            <Button
              className={primary}
              onClick={() => {
                setDiscard(false);
                setDraft(null);
                setExcluded(savedExcluded);
                setError(null);
              }}
            >
              Discard edits
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
