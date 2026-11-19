import { cookies, headers } from "next/headers";
import { isLocalSetupTestEnabled } from "@/lib/onboarding-dev";
import { withLocalAnalyticsSample } from "@/lib/dashboard-analytics-sample";
import { NextResponse } from "next/server";

import { ALL_LOCATIONS_VIEW_COOKIE } from "@/lib/account-locations";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { loadDashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { parseDashboardMetricRange } from "@/lib/dashboard-metric-range";
import { requireDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireDashboardSession();
  const cookieStore = await cookies();
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";

  const { searchParams } = new URL(request.url);
  const metricRange = parseDashboardMetricRange(searchParams.get("range") ?? undefined);
  const orgRow = await getCachedDashboardOrganizationRow();

  const snapshot = await loadDashboardHomeSnapshot({
    session,
    metricRange,
    viewAllLocations,
    niche: orgRow?.niche,
    agentBusinessType: orgRow?.agent_business_type,
    organizationSlug: orgRow?.slug,
  });

  return NextResponse.json(orgRow?.niche !== "retail" && isLocalSetupTestEnabled(await headers()) ? withLocalAnalyticsSample(snapshot) : snapshot);
}
