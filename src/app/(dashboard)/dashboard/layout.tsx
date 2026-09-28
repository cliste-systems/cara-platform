import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { HideStripeTestingAssistant } from "@/components/billing/hide-stripe-testing-assistant";
import { DashboardLiveRefresh } from "@/components/dashboard-live-refresh";

import { DashboardVerticalProvider } from "./dashboard-vertical-context";
import { DashboardNavSeenSync } from "./dashboard-nav-seen-sync";

/** Layout reads httpOnly “seen” cookies; must not be statically cached across navigations. */
export const dynamic = "force-dynamic";
import {
  ALL_LOCATIONS_VIEW_COOKIE,
  locationLabelForVertical,
} from "@/lib/account-locations";
import { loadAccountBilling, loadAccountLocations } from "@/lib/account-session";
import { buildDashboardAccountSummary } from "@/lib/dashboard-account-summary";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { navItemsForVertical } from "@/lib/dashboard-nav-items";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { verticalPackForNiche } from "@/lib/verticals";
import { userNeedsPassword } from "@/lib/invite-onboarding";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  fetchDashboardNavBadges,
  type DashboardNavBadgeMap,
} from "@/lib/dashboard-nav-badges";
import {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  DASHBOARD_CARA_TRAINING_SEEN_COOKIE,
  parseSeenAtCookie,
} from "@/lib/dashboard-nav-seen-cookies";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { DashboardChromeBar } from "./dashboard-chrome-bar";
import {
  DashboardSidebar,
  type DashboardSidebarNavItem,
} from "./dashboard-sidebar";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { dashboardVersionDisplay } from "@/lib/dashboard-versions";

import { DASHBOARD_CONTENT_COLUMN, DASHBOARD_INTERACTIVE_CURSOR, DASHBOARD_REBUILD_SHELL } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

import { DashboardViewportLock } from "./dashboard-viewport-lock";

const navItems: {
  href: string;
  label: string;
  section: "core" | "account";
  activePrefix?: string;
  activeAliases?: string[];
}[] = [
  { href: DASHBOARD_ROUTES.home, label: "Home", section: "core" },
  { href: DASHBOARD_ROUTES.activity, label: "Activity", section: "core" },
  { href: DASHBOARD_ROUTES.calls, label: "Calls", section: "core" },
  { href: DASHBOARD_ROUTES.caraKnowledge, label: "Cara's Knowledge", section: "core", activePrefix: "/dashboard/cara-knowledge" },
  { href: DASHBOARD_ROUTES.routing, label: "Call flow", section: "core" },
  {
    href: DASHBOARD_ROUTES.usage,
    label: "Usage",
    section: "account",
    activeAliases: ["/dashboard/billing"],
  },
  { href: DASHBOARD_ROUTES.support, label: "Support", section: "account" },
  {
    href: DASHBOARD_ROUTES.legalDataRequests,
    label: "Legal",
    section: "account",
    activeAliases: ["/dashboard/privacy"],
  },
  { href: DASHBOARD_ROUTES.locations, label: "Locations", section: "account" },
  { href: DASHBOARD_ROUTES.team, label: "Team", section: "account" },
  {
    href: DASHBOARD_ROUTES.businessProfile,
    label: "Profile",
    section: "account",
    activePrefix: DASHBOARD_ROUTES.businessProfile,
  },
  { href: DASHBOARD_ROUTES.settings, label: "Settings", section: "account" },
];

function toNavItem(
  item: (typeof navItems)[number],
  badges: DashboardNavBadgeMap,
): DashboardSidebarNavItem {
  const badgeHref =
    item.href === DASHBOARD_ROUTES.caraKnowledge
      ? DASHBOARD_ROUTES.caraKnowledgeNeedsInput
      : item.href;
  const n = badges[badgeHref] ?? badges[item.href];
  return {
    href: item.href,
    label: item.label,
    ...(item.activeAliases ? { activeAliases: item.activeAliases } : {}),
    ...(item.activePrefix ? { activePrefix: item.activePrefix } : {}),
    ...(typeof n === "number" && n > 0 ? { badge: n } : {}),
  };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireDashboardSession();

  const { supabase, organizationId, profile, user, accountId } = session;

  const [cookieStore, orgRow, locations, accountBilling] = await Promise.all([
    cookies(),
    getCachedDashboardOrganizationRow(),
    loadAccountLocations(accountId),
    loadAccountBilling(accountId),
  ]);
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";
  const navSeenAt = {
    callHistory: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_CALL_HISTORY_SEEN_COOKIE)?.value,
    ),
    actionInbox: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_ACTION_INBOX_SEEN_COOKIE)?.value,
    ),
    caraTraining: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_CARA_TRAINING_SEEN_COOKIE)?.value,
    ),
  };

  // Gate the dashboard on SaaS lifecycle status. Newly-signed-up salons
  // still in the wizard (or suspended ones) should not see live bookings.
  // Legacy rows created before migration 027 default to status='active' so
  // existing dashboards are unaffected.
  const lifecycleStatus =
    (accountBilling?.status as string | undefined) ??
    (orgRow?.status as string | undefined) ??
    "active";
  if (
    !session.isLocalPreview &&
    (lifecycleStatus === "pending_verification" ||
      lifecycleStatus === "onboarding")
  ) {
    redirect("/onboarding");
  }
  if (lifecycleStatus === "suspended") {
    redirect("/dashboard/usage?suspended=1");
  }

  const navBadges: DashboardNavBadgeMap = await fetchDashboardNavBadges(
    supabase,
    organizationId,
    navSeenAt,
  );

  const needsPassword = userNeedsPassword(user);

  const vertical = verticalPackForNiche(orgRow?.niche);
  const resolvedNavItems = navItemsForVertical(navItems, vertical);

  const coreNav = resolvedNavItems
    .filter((i) => i.section === "core")
    .map((item) => toNavItem(item, navBadges));
  const accountNav = resolvedNavItems
    .filter((i) => i.section === "account")
    .map((item) => toNavItem(item, navBadges));
  const mobileNavItems: DashboardSidebarNavItem[] = [
    ...coreNav,
    ...accountNav,
  ];

  const accountSummary = buildDashboardAccountSummary(profile, user, {
    name: accountBilling?.name ?? orgRow?.name ?? null,
    slug: orgRow?.slug ?? null,
  });
  const locationLabel = locationLabelForVertical(vertical.id);
  const accountName =
    resolveOrganizationDisplayName(
      accountBilling?.name ?? orgRow?.name,
      orgRow?.slug,
    ) || "Your business";
  const versionDisplay = dashboardVersionDisplay({
    experienceLabel: vertical.selection.label,
    packVersion: vertical.packVersion,
  });

  return (
    <>
      <DashboardViewportLock />
      <HideStripeTestingAssistant />
      <DashboardVerticalProvider
        niche={orgRow?.niche}
        businessType={orgRow?.agent_business_type}
        businessName={accountName}
        storePhoneE164={
          orgRow?.store_public_number?.trim() ||
          orgRow?.phone_number?.trim() ||
          null
        }
      >
        <div
          className={cn(
            "fixed inset-0 z-10 flex w-full max-w-[100vw] flex-col overflow-hidden bg-[#f3f6f4] text-[#11181d] lg:flex-row",
            DASHBOARD_INTERACTIVE_CURSOR,
          )}
        >
          {!DASHBOARD_REBUILD_SHELL ? (
            <DashboardSidebar
              coreNav={coreNav}
              accountNav={accountNav}
              needsPassword={needsPassword}
              account={accountSummary}
              locations={locations}
              activeOrganizationId={organizationId}
              viewAllLocations={viewAllLocations}
              locationLabel={locationLabel}
              accountName={accountName}
            />
          ) : null}

          <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f3f6f4] lg:h-full">
            {!DASHBOARD_REBUILD_SHELL ? (
              <DashboardChromeBar versionDisplay={versionDisplay} />
            ) : null}
            {!DASHBOARD_REBUILD_SHELL ? (
              <div className="shrink-0 border-b border-[#d9e2dd] bg-[#f3f6f4] py-3 lg:hidden">
                <div className={DASHBOARD_CONTENT_COLUMN}>
                  <DashboardMobileNav
                    items={mobileNavItems}
                    accountNav={accountNav}
                  />
                </div>
              </div>
            ) : null}
            {!DASHBOARD_REBUILD_SHELL && needsPassword ? (
              <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/90 px-4 py-3 text-xs leading-snug text-amber-950 lg:hidden">
                Finish setup: choose a password for this account.{" "}
                <Link
                  href="/dashboard/set-password"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Set password
                </Link>
              </div>
            ) : null}
            <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-y-none bg-[#f3f6f4]">
              <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-y-auto bg-[#f3f6f4] px-6 py-6 sm:px-8 has-[data-dashboard-fill]:min-h-0 has-[data-dashboard-fill]:overflow-hidden has-[data-dashboard-fill]:p-0 [scrollbar-gutter:stable]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </DashboardVerticalProvider>
      <DashboardNavSeenSync />
      <DashboardLiveRefresh organizationId={organizationId} />
    </>
  );
}
