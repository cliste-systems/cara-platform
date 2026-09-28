/** Public marketing/legal site paths (unauthenticated). */
export const PUBLIC_LEGAL_PAGES = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/dpa", label: "DPA" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/sub-processors", label: "Sub-processors" },
  { href: "/legal/cookies", label: "Cookies" },
] as const;

/** In-dashboard legal hub (authenticated business owners). */
export const DASHBOARD_LEGAL_PAGES = [
  {
    href: "/dashboard/legal/caller-notice",
    label: "Caller notice",
    description: "Copy-paste privacy wording for your customers",
  },
  {
    href: "/dashboard/legal/data-requests",
    label: "Data requests",
    description: "Export or erase customer data",
  },
  { href: "/dashboard/legal/privacy", label: "Privacy notice" },
  { href: "/dashboard/legal/dpa", label: "DPA" },
  { href: "/dashboard/legal/terms", label: "Terms" },
  { href: "/dashboard/legal/sub-processors", label: "Sub-processors" },
  { href: "/dashboard/legal/cookies", label: "Cookies" },
] as const;

export const LEGAL_LAST_UPDATED = "28 September 2026";
