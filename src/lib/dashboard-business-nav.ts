import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { VerticalPack } from "@/lib/verticals";

export const BUSINESS_NAV_PREFIX = "/dashboard/business";

export type BusinessNavChild = {
  href: string;
  label: string;
};

export const BUSINESS_SIDEBAR_CHILDREN: BusinessNavChild[] = [
  { href: DASHBOARD_ROUTES.businessProfile, label: "Profile" },
  { href: DASHBOARD_ROUTES.businessServices, label: "Services" },
  { href: DASHBOARD_ROUTES.businessFiles, label: "Files" },
];

export function businessSidebarChildrenForVertical(
  pack: VerticalPack,
): BusinessNavChild[] {
  const hidden = new Set(pack.nav?.hiddenBusinessHrefs ?? []);
  return BUSINESS_SIDEBAR_CHILDREN.filter((item) => !hidden.has(item.href));
}

export function isBusinessNavPath(pathname: string): boolean {
  return pathname.startsWith(BUSINESS_NAV_PREFIX);
}

export function businessNavChildLabel(pathname: string): string | null {
  if (pathname === "/dashboard/business/hours") return "Hours & availability";
  if (
    pathname === DASHBOARD_ROUTES.businessAnswers ||
    pathname.startsWith(`${DASHBOARD_ROUTES.businessAnswers}/`)
  ) {
    return "Common questions";
  }
  const match = BUSINESS_SIDEBAR_CHILDREN.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? null;
}
