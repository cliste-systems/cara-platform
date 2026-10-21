import Link from "next/link";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { FirstCallWelcome } from "@/components/dashboard/first-call-welcome";
import { loadFirstCallSetup } from "@/lib/load-first-call-setup";
import { usesSimpleSignup } from "@/lib/public-signup-flow";
import { DashboardHomeLive } from "@/components/dashboard/dashboard-home-live";
import {
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_HOME_CONTENT_COLUMN,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { loadDashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { ALL_LOCATIONS_VIEW_COOKIE } from "@/lib/account-locations";
import { parseDashboardMetricRange } from "@/lib/dashboard-metric-range";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type DashboardHomePageProps = {
  searchParams?: Promise<{ range?: string; welcome?: string }>;
};

export default async function DashboardHomePage({
  searchParams,
}: DashboardHomePageProps) {
  const session = await requireDashboardSession();
  const cookieStore = await cookies();
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";

  const sp = searchParams ? await searchParams : {};
  const metricRange = parseDashboardMetricRange(sp.range);
  const orgRow = await getCachedDashboardOrganizationRow();

  const setup = usesSimpleSignup(session.user) || sp.welcome === "1" ? await loadFirstCallSetup(session) : null;

  const snapshot = await loadDashboardHomeSnapshot({
    session,
    metricRange,
    viewAllLocations,
    niche: orgRow?.niche,
    agentBusinessType: orgRow?.agent_business_type,
    organizationSlug: orgRow?.slug,
  });

  return (
    <div
      className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "min-h-0")}
      data-dashboard-fill
      data-dashboard-home
    >
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        {setup?.canManage ? <FirstCallWelcome state={setup} initialOpen={sp.welcome === "1" || !setup.welcomeSeen} /> : null}
        {setup?.canManage && !setup.servicesReady ? (
          <section className="flex shrink-0 flex-col gap-3 rounded-xl border border-[#d9e2dd] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#11181d]">Add your services</h2>
              <p className="mt-1 text-xs leading-5 text-[#6b7c75]">Tell Cara what you offer. Until then, she’ll take a message for service enquiries.</p>
            </div>
            <Link href={DASHBOARD_ROUTES.businessServices} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#d9e2dd] px-5 text-sm font-medium text-[#11181d] hover:bg-[#f3f6f4]">Set up services</Link>
          </section>
        ) : null}
        <DashboardHomeLive
          metricRange={metricRange}
          organizationId={session.organizationId}
          initialSnapshot={snapshot}
          enterClassName="min-h-0 flex-1 lg:h-full"
          heroClassName="shrink-0 lg:h-[220px] lg:max-h-[220px] lg:min-h-[200px]"
          cardsClassName="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
