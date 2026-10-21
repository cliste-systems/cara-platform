import { Loader2 } from "lucide-react";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";

import { DASHBOARD_HOME_CONTENT_COLUMN, DASHBOARD_PAGE_SHELL_FILL_WHITE } from "@/components/dashboard/dashboard-surface";

/** Shown in the main column while a dashboard route’s RSC tree resolves. */
export default function DashboardLoading() {
  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <div
          className="flex min-h-[min(60vh,32rem)] flex-1 flex-col items-center justify-center gap-3 py-16"
          role="status"
          aria-live="polite"
          aria-label="Loading dashboard"
        >
          <ClisteLogoMark size={40} />
          <p className="flex items-center gap-2 text-sm text-[#637075]"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Opening your Cara workspace…</p>
        </div>
      </div>
    </div>
  );
}
