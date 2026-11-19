import { requireDashboardSession } from "@/lib/dashboard-session";
import { hasAccountOwnerAccess } from "@/lib/account-owner-access";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_VIEWPORT_LAYOUT,
} from "@/components/dashboard/dashboard-surface";

import { AgentConfigLintProvider } from "../cara-setup/agent-config-lint-context";
import { CaraSetupFormProvider } from "../cara-setup/cara-setup-form-context";
import { FaqsWorkspaceShell } from "../cara-setup/faqs-workspace-shell";
import { loadCaraSetupPageData } from "../cara-setup/load-cara-setup";

export const dynamic = "force-dynamic";

export default async function FaqsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session=await requireDashboardSession();
  const canManage=await hasAccountOwnerAccess(session.supabase,{userId:session.user.id,accountId:session.accountId,profileRole:session.profile.role});
  const { initial, businessFiles, promptExtras } = await loadCaraSetupPageData();

  return (
    <div className={DASHBOARD_VIEWPORT_LAYOUT}>
      <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
        <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
          <CaraSetupFormProvider canManage={canManage}
            initial={initial}
            businessFiles={businessFiles}
            promptExtras={promptExtras}
          >
            <AgentConfigLintProvider>
              <FaqsWorkspaceShell>{children}</FaqsWorkspaceShell>
            </AgentConfigLintProvider>
          </CaraSetupFormProvider>
        </div>
      </div>
    </div>
  );
}
