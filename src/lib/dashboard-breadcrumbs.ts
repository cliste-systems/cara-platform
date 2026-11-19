import {
  accountNavChildLabel,
  isAccountNavPath,
} from "@/lib/dashboard-account-nav";
import {
  businessNavChildLabel,
  isBusinessNavPath,
} from "@/lib/dashboard-business-nav";
import {
  caraNavChildLabel,
  isCaraNavPath,
} from "@/lib/dashboard-cara-nav";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type DashboardBreadcrumb = {
  label: string;
  href?: string;
};

const WORKSPACE_SECTION = "Workspace";
const CARA_SECTION = "Cara";
const BUSINESS_SECTION = "Business";
const ACCOUNT_SECTION = "Account";

/** Workspace nav pages — longest prefix wins when matching. */
const WORKSPACE_PAGES: { prefix: string; label: string }[] = [
  { prefix: "/dashboard/services", label: "Services" },
  { prefix: DASHBOARD_ROUTES.caraKnowledge, label: "Cara's Knowledge" },
  { prefix: DASHBOARD_ROUTES.activity, label: "Activity" },
  { prefix: DASHBOARD_ROUTES.actionInbox, label: "Action Inbox" },
  { prefix: DASHBOARD_ROUTES.routing, label: "Call flow" },
  { prefix: DASHBOARD_ROUTES.calls, label: "Calls" },
  { prefix: "/dashboard/call-history", label: "Calls" },
  { prefix: DASHBOARD_ROUTES.home, label: "Overview" },
].sort((a, b) => b.prefix.length - a.prefix.length);

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return DASHBOARD_ROUTES.home;
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || DASHBOARD_ROUTES.home;
}

function sectionPage(
  section: string,
  sectionHref: string | undefined,
  page: string,
): DashboardBreadcrumb[] {
  return [
    { label: section, href: sectionHref },
    { label: page },
  ];
}

function workspacePageLabel(pathname: string): string | null {
  for (const { prefix, label } of WORKSPACE_PAGES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return label;
    }
  }
  return null;
}

function accountPageLabel(pathname: string): string {
  const fromNav = accountNavChildLabel(pathname);
  if (fromNav) return fromNav;

  if (pathname.startsWith(DASHBOARD_ROUTES.legalCallerNotice)) {
    return "Caller notice";
  }
  if (pathname === DASHBOARD_ROUTES.legalAccept) {
    return "Legal";
  }
  if (pathname === "/dashboard/set-password") {
    return "Set password";
  }

  return "Account";
}

export function dashboardBreadcrumbs(pathname: string): DashboardBreadcrumb[] {
  const path = normalizePathname(pathname);
  if (path === DASHBOARD_ROUTES.phoneSetup) return sectionPage(BUSINESS_SECTION, DASHBOARD_ROUTES.businessProfile, "Phone connection");

  if (path.startsWith(DASHBOARD_ROUTES.caraKnowledge)) {
    return [
      { label: WORKSPACE_SECTION, href: DASHBOARD_ROUTES.home },
      { label: "Cara's Knowledge" },
    ];
  }

  if (isCaraNavPath(path)) {
    const page = caraNavChildLabel(path) ?? "Cara";
    return sectionPage(CARA_SECTION, DASHBOARD_ROUTES.caraGreeting, page);
  }

  if (isBusinessNavPath(path)) {
    const page = businessNavChildLabel(path) ?? "Business";
    return sectionPage(BUSINESS_SECTION, DASHBOARD_ROUTES.businessProfile, page);
  }

  if (isAccountNavPath(path) || path === DASHBOARD_ROUTES.legalAccept) {
    const page = accountPageLabel(path);
    return sectionPage(ACCOUNT_SECTION, DASHBOARD_ROUTES.settings, page);
  }

  if (path === "/dashboard/set-password") {
    return sectionPage(ACCOUNT_SECTION, DASHBOARD_ROUTES.settings, "Set password");
  }

  const workspacePage = workspacePageLabel(path);
  if (workspacePage) {
    return sectionPage(WORKSPACE_SECTION, DASHBOARD_ROUTES.home, workspacePage);
  }

  // Legacy agent-config paths not yet redirected.
  if (path.startsWith(DASHBOARD_ROUTES.caraSetup)) {
    return sectionPage(CARA_SECTION, DASHBOARD_ROUTES.caraGreeting, "Setup");
  }

  return sectionPage(WORKSPACE_SECTION, DASHBOARD_ROUTES.home, "Overview");
}
