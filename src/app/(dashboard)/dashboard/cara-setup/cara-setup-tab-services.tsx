"use client";

import { Ban, CheckCircle2 } from "lucide-react";

import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { dedupeServiceChips } from "@/lib/services-boundary";
import { verticalPackForNiche } from "@/lib/verticals";
import { cn } from "@/lib/utils";

import { CaraWhenUnsureCallout } from "./cara-when-unsure-callout";
import { ServiceCatalogEditor } from "./service-catalog-editor";
import { ServicesBoundaryChipEditor } from "./services-boundary-chip-editor";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupTabServices() {
  const form = useCaraSetupForm();
  const verticalCopy = dashboardVerticalCopy(form.niche, form.businessType);
  const servicesCopy = verticalCopy.caraSetup.services;
  const isSalon =
    verticalPackForNiche(form.niche).capabilities.usesServiceCatalog ||
    form.serviceCatalog.length > 0;
  const offerEmpty = isSalon
    ? form.serviceCatalog.length === 0
    : form.servicesItems.length === 0;

  return (
    <SectionCard
      flat
      title="Your services"
      description={
        isSalon
          ? "Add your services, with prices and durations if needed. Cara confirms only what you list; for anything else, she takes a message."
          : "Cara confirms the services you list here. For anything unlisted, she takes a message. Add exclusions for services she should decline."
      }
      bodyClassName="p-0"
      id="cara-services-boundary"
      className="scroll-mt-4"
    >
      {offerEmpty ? (
        <div className="border-b border-[#d9e2dd] bg-[#fbfcfb] px-5 py-3">
          <p className="text-[12.5px] leading-relaxed text-[#35443f]">
            {verticalCopy.caraSetup.servicesEmptyWarning}
          </p>
        </div>
      ) : null}

      {isSalon ? (
        <div className="border-b border-slate-200 px-5 py-5">
          <ServiceCatalogEditor
            initialServices={form.serviceCatalog}
            servicesCopy={{
              bookingImportLabel: servicesCopy.bookingImportLabel,
              bookingImportHint: servicesCopy.bookingImportHint,
              bookingImportPlaceholder: servicesCopy.bookingImportPlaceholder,
              primaryPlaceholder: servicesCopy.primaryPlaceholder,
            }}
            onServicesChange={(services) => {
              form.setServiceCatalog(services);
              form.setServicesItems(services.map((s) => s.name));
            }}
          />
        </div>
      ) : (
        <div className="grid items-start lg:grid-cols-2">
          <div
            id="cara-services-offered"
            className={cn(
              "min-w-0 scroll-mt-4 px-5 py-5",
              "border-b border-slate-200 lg:border-b-0 lg:border-r",
            )}
          >
            <div className="mb-4 flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] text-[#353D42]">
                <CheckCircle2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-slate-900">
                  What you offer
                </h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                  Categories callers might ask for — use broad labels, not every
                  phrase they might say.
                </p>
              </div>
            </div>
            <Field
              label="Add services"
              htmlFor="cara-services-offered"
              hint="Type a category, then comma — or press Enter or Add."
            >
              <ServicesBoundaryChipEditor
                kind="offered"
                inputId="cara-services-offered"
                value={form.servicesItems}
                onChange={(next) =>
                  form.setServicesItems(dedupeServiceChips(next))
                }
                otherList={form.servicesNotOfferedItems}
                onAddToOtherList={(item) =>
                  form.setServicesNotOfferedItems(
                    dedupeServiceChips([...form.servicesNotOfferedItems, item]),
                  )
                }
                placeholder={servicesCopy.primaryPlaceholder}
              />
            </Field>
          </div>

          <div id="cara-services-not-offered" className="min-w-0 scroll-mt-4 px-5 py-5">
            <div className="mb-4 flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Ban className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-slate-900">
                  What you don&apos;t offer
                </h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                  Specific things Cara must never promise — narrower beats broad
                  offers.
                </p>
              </div>
            </div>
            <Field
              label="Add exclusions"
              htmlFor="cara-services-not-offered"
              hint="Type an exclusion, then comma — or press Enter or Add."
            >
              <ServicesBoundaryChipEditor
                kind="excluded"
                inputId="cara-services-not-offered"
                value={form.servicesNotOfferedItems}
                onChange={(next) =>
                  form.setServicesNotOfferedItems(dedupeServiceChips(next))
                }
                otherList={form.servicesItems}
                placeholder={servicesCopy.secondaryPlaceholder}
              />
            </Field>
          </div>
        </div>
      )}

      {isSalon ? (
        <div
          id="cara-services-not-offered"
          className="min-w-0 scroll-mt-4 border-b border-slate-200 px-5 py-5"
        >
          <div className="mb-4 flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Ban className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-slate-900">
                What you don&apos;t offer
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                Specific treatments Cara must never promise.
              </p>
            </div>
          </div>
          <Field
            label="Add exclusions"
            htmlFor="cara-services-not-offered-salon"
            hint="Type an exclusion, then comma — or press Enter or Add."
          >
            <ServicesBoundaryChipEditor
              kind="excluded"
              inputId="cara-services-not-offered-salon"
              value={form.servicesNotOfferedItems}
              onChange={(next) =>
                form.setServicesNotOfferedItems(dedupeServiceChips(next))
              }
              otherList={form.serviceCatalog.map((s) => s.name)}
              placeholder={servicesCopy.secondaryPlaceholder}
            />
          </Field>
        </div>
      ) : null}

      <div className="border-t border-slate-200 px-5 py-4">
        <CaraWhenUnsureCallout />
      </div>
    </SectionCard>
  );
}
