"use client";

import {BusinessClassificationEditor} from "@/components/dashboard/business-classification-editor";
import type {BusinessClassification} from "@/lib/business-classification";
import { Briefcase, Clock, Sparkles } from "lucide-react";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useCaraSetupForm } from "./cara-setup-form-context";
import { useDashboardVertical } from "../dashboard-vertical-context";
import { ABOUT_PLACEHOLDER } from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { signupSegmentLabel } from "@/lib/signup-segment-label";

export function BusinessProfileTab({classification=null,canManage=false}:{classification?:BusinessClassification|null;canManage?:boolean}) {
  const form = useCaraSetupForm();
  const { copy, vertical } = useDashboardVertical();
  const isRetail = vertical.id === "retail";
  const storeNameLabel = isRetail ? "Store name" : "Business name";
  const businessTypeLabel = signupSegmentLabel({
    niche: form.niche,
    businessType: form.businessType,
  });
  const clistePhone = form.clistePhoneNumber.trim();
  const clistePhoneDisplay = clistePhone
    ? formatE164ForDisplay(clistePhone) || clistePhone
    : null;

  return (
    <DashboardAnimatedStack embedded>
      <SectionCard
        flat
        icon={Sparkles}
        title="About your business"
        description="What Cara should know when she describes who you are and what you do."
        className="w-full scroll-mt-4"
        id="cara-business-about"
      >
        <Field
          label="Business description"
          htmlFor="cara-business-description"
          hint="Same notes you gave during setup — Cara weaves this into her phone guidance."
          className="w-full"
        >
          <Textarea
            id="cara-business-description"
            value={form.rawBusinessDescription}
            onChange={(event) => form.setRawBusinessDescription(event.target.value)}
            placeholder={ABOUT_PLACEHOLDER}
            rows={5}
            className={cn(
              DASHBOARD_INPUT_CLASS,
              "min-h-[8rem] w-full resize-y py-2.5 leading-relaxed",
            )}
          />
        </Field>
      </SectionCard>

      <SectionCard
        flat
        icon={Briefcase}
        title={copy.caraSetup.generalBasicsTitle}
        description="Name, type, location, Eircode, and your Cliste line — the facts callers ask about most."
        className="scroll-mt-4"
        id="cara-business-basics"
      >
        <Field
          label={storeNameLabel}
          htmlFor="cara-store-name"
          hint="How Cara introduces your business on calls. Contact support if it needs updating."
        >
          <div
            id="cara-store-name"
            className={cn(
              "flex min-h-10 items-center rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-[13px]",
              form.businessName.trim()
                ? "font-medium text-[#0b1220]"
                : "text-slate-500",
            )}
            aria-readonly="true"
          >
            {form.businessName.trim() || "Not set"}
          </div>
        </Field>
        {isRetail?<Field label="Business type" htmlFor="cara-business-type" hint="Your retail setup is managed by our team."><div id="cara-business-type" className="text-sm text-[#11181d]">{businessTypeLabel.trim()||"Retail"}</div></Field>:<div className="space-y-3"><h3 className="text-sm font-medium text-[#353D42]">Business type</h3><BusinessClassificationEditor initial={classification} canManage={canManage}/></div>}
        <Field
          label="Cliste number"
          htmlFor="cara-cliste-number"
          hint={
            clistePhoneDisplay
              ? "Assigned to your account — it can't be changed here. Contact support if you have any questions."
              : "Assigned after onboarding — it can't be changed here. Contact support if you have any questions."
          }
        >
          <div
            id="cara-cliste-number"
            className={cn(
              "flex min-h-10 items-center rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-[13px] tabular-nums",
              clistePhoneDisplay
                ? "font-medium text-[#0b1220]"
                : "text-slate-500",
            )}
            aria-readonly="true"
          >
            {clistePhoneDisplay ?? "Not assigned yet"}
          </div>
        </Field>
        <Field
          label="Street"
          htmlFor="cara-location-street"
          hint="Street address — Cara uses this when callers ask where you are."
        >
          <Input
            id="cara-location-street"
            value={form.locationAddress}
            placeholder="e.g. 14 Grafton Street"
            onChange={(e) => form.setLocationAddress(e.target.value)}
            className={DASHBOARD_INPUT_CLASS}
            autoComplete="street-address"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.75rem]">
          <Field
            label="Town"
            htmlFor="cara-location-town"
            hint={copy.caraSetup.locationHint}
          >
            <Input
              id="cara-location-town"
              value={form.baseTown}
              placeholder="e.g. Dublin 2"
              onChange={(e) => form.setBaseTown(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="address-level2"
            />
          </Field>
          <Field
            label="County"
            htmlFor="cara-location-county"
            hint="County or city — helps Cara answer location questions."
          >
            <Input
              id="cara-location-county"
              value={form.locationCounty}
              placeholder="e.g. Dublin"
              onChange={(e) => form.setLocationCounty(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="address-level1"
            />
          </Field>
          <Field
            label="Eircode"
            htmlFor="cara-location-eircode"
            hint="Optional but helps callers find you."
            className="sm:col-span-2 lg:col-span-1"
          >
            <Input
              id="cara-location-eircode"
              value={form.locationEircode}
              placeholder="e.g. D06 X2P6"
              onChange={(e) =>
                form.setLocationEircode(e.target.value.toUpperCase())
              }
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="postal-code"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        flat
        icon={Clock}
        title="Opening hours"
        description="When you're open — Cara uses this when callers ask about times."
        className="scroll-mt-4"
        id="cara-opening-hours"
      >
        <OpeningHoursEditor
          value={form.openingHoursSchedule}
          onChange={form.setOpeningHoursSchedule}
          open24_7={form.open24_7}
          onOpen24_7Change={form.setOpen24_7}
          bankHolidays={form.bankHolidays}
          onBankHolidaysChange={form.setBankHolidays}
          hoursNeverConfigured={form.hoursNeverConfigured}
          variant="dashboard"
        />
      </SectionCard>
    </DashboardAnimatedStack>
  );
}
