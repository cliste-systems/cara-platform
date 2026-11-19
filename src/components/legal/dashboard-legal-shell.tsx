"use client";

import { WorkspaceSectionNav } from "@/components/dashboard/workspace-section-nav";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { LegalPathProvider } from "@/components/legal/legal-path-context";
import { DashboardLegalTabs } from "@/components/legal/dashboard-legal-tabs";

type DashboardLegalShellProps = {
  children: ReactNode;
};

export function DashboardLegalShell({ children }: DashboardLegalShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <ClistePageHeader
        tone="account"
        icon={Shield}
        title="Privacy & legal"
        description="GDPR data requests for your customers, plus Cliste legal documents for your records."
      />

      <WorkspaceSectionNav group="account" />
      <div className="shrink-0">
        <DashboardLegalTabs />
      </div>

      <DashboardFormScrollRegion
        className="min-h-0 flex-1"
        scrollClassName="divide-y divide-[#dfe7e2] bg-[#fbfcfb]"
      >
        <LegalPathProvider variant="dashboard">{children}</LegalPathProvider>
      </DashboardFormScrollRegion>
    </div>
  );
}
