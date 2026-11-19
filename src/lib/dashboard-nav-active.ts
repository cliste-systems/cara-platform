export type DashboardNavItemActive = {
  href: string;
  activePrefix?: string;
  activeAliases?: string[];
  inactivePaths?: string[];
};

export function isDashboardNavItemActive(
  pathname: string,
  item: DashboardNavItemActive,
): boolean {
  if (item.inactivePaths?.some(path => pathname === path || pathname.startsWith(path + "/"))) return false;
  if (item.activePrefix) {
    return pathname.startsWith(item.activePrefix);
  }
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  const paths = [item.href, ...(item.activeAliases ?? [])];
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
