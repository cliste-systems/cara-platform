"use client";

import { WorkspaceSectionNav } from "@/components/dashboard/workspace-section-nav";
import { FormFeedback } from "@/components/ui/form-feedback";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { useDashboardHashScroll } from "@/hooks/use-dashboard-hash-scroll";
import { businessNavChildLabel } from "@/lib/dashboard-business-nav";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function BusinessSetupShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();
  const pathname = usePathname();
  useDashboardHashScroll(pathname);
  const sectionTitle = pathname === DASHBOARD_ROUTES.businessProfile && form.niche !== "retail" ? "Your business" : businessNavChildLabel(pathname) ?? "Business";
  const showFileCount = pathname.startsWith(DASHBOARD_ROUTES.businessFiles);

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <ClistePageHeader
          tone="business"
          icon={Briefcase}
          title={sectionTitle}
          description="What Cara should know about your business."
          summary={
            showFileCount && form.businessFiles.length > 0
              ? [
                  {
                    value: String(form.businessFiles.length),
                    label: form.businessFiles.length === 1 ? "file" : "files",
                  },
                ]
              : undefined
          }
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
