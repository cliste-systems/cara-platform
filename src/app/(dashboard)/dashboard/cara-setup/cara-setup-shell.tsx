"use client";

import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { caraNavChildLabel } from "@/lib/dashboard-cara-nav";
import {WorkspaceSectionNav} from "@/components/dashboard/workspace-section-nav";
import {FormFeedback} from "@/components/ui/form-feedback";

import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();
  const pathname = usePathname();
  const sectionTitle = caraNavChildLabel(pathname) ?? "Cara";

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <ClistePageHeader
          tone="cara"
          icon={Bot}
          title={sectionTitle}
          description="How Cara answers and handles calls."
          actions={
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Button
                type="button"
                onClick={form.save}
                disabled={form.pending || !form.canManage || !form.isDirty}
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              >
                {form.pending ? "Saving…" : "Save changes"}
              </Button>
              {form.isDirty ? (
                <p className="text-[12px] font-medium text-[#353D42]">
                  Unsaved changes
                </p>
              ) : null}
            </div>
          }
        />
        <FormFeedback message={form.status?.kind === "error" ? form.status.message : null} />

        {form.niche !== "retail" && <WorkspaceSectionNav group="business"/>}
        <DashboardFormScrollRegion
          className="min-h-0 flex-1"
          scrollClassName="divide-y divide-[#dfe7e2] bg-[#fbfcfb]"
        >
          <fieldset disabled={!form.canManage || form.pending} className="min-w-0">{children}</fieldset>
        </DashboardFormScrollRegion>
      </div>
    </CaraSetupUnsavedGuard>
  );
}
