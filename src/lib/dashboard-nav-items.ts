import { DASHBOARD_ROUTES as R } from "@/lib/dashboard-routes";
import type { VerticalPack } from "@/lib/verticals";

export function navItemsForVertical<
  T extends { href: string; label: string; section: "core" | "account" },
>(baseNavItems: T[], pack: VerticalPack): T[] {
  if (pack.id !== "retail") return [
    { href: R.home, label: "Overview", section: "core" },
    { href: R.calls, label: "Calls", section: "core" },
    { href: "/dashboard/services", label: "Services", section: "core" },
    { href: R.caraKnowledge, label: "Cara’s knowledge", section: "core" },
    { href: R.businessProfile, label: "Your business", section: "core", activeAliases: ["/dashboard/business/hours", R.caraGreeting, R.phoneSetup] },
    { href: R.settings, label: "Settings & billing", section: "account", inactivePaths: [R.phoneSetup], activeAliases: [R.usage, R.team, R.legalDataRequests] },
    { href: R.support, label: "Help", section: "account" },
  ] as T[];
  const nav = pack.nav;
  if (!nav) return baseNavItems;

  const hidden = new Set(nav.hiddenHrefs ?? []);
  let items = baseNavItems
    .filter((item) => !hidden.has(item.href))
    .map((item) => {
      const override = nav.labelOverrides?.[item.href];
      return override ? { ...item, label: override } : item;
    });

  for (const extra of nav.extraItems ?? []) {
    const insert: T = {
      href: extra.href,
      label: extra.label,
      section: extra.section,
    } as T;

    if (extra.afterHref) {
      const idx = items.findIndex((item) => item.href === extra.afterHref);
      if (idx >= 0) {
        items = [...items.slice(0, idx + 1), insert, ...items.slice(idx + 1)];
        continue;
      }
    }

    items = [...items, insert];
  }

  return items;
}
