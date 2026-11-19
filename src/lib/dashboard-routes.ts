/** Canonical dashboard paths (visible product language). */
export const DASHBOARD_ROUTES = {
  home: "/dashboard",
  activity: "/dashboard/activity",
  calls: "/dashboard/calls",
  /** @deprecated Action Inbox retired; kept for legacy redirects. */
  actionInbox: "/dashboard/action-inbox",
  departments: "/dashboard/departments",
  products: "/dashboard/products",
  department: (slug: string) => `/dashboard/departments/${slug}`,
  routing: "/dashboard/routing",
  /** @deprecated Use businessProfile or caraGreeting */
  caraSetup: "/dashboard/cara-setup",
  caraGreeting: "/dashboard/cara/greeting",
  /** @deprecated Use caraKnowledgeNeedsInput */
  caraTraining: "/dashboard/cara-knowledge?tab=needs-input",
  caraKnowledge: "/dashboard/cara-knowledge",
  caraKnowledgeNeedsInput: "/dashboard/cara-knowledge?tab=needs-input",
  caraKnowledgeNeedsInputItem: (itemId: string) =>
    `/dashboard/cara-knowledge?tab=needs-input&item=${encodeURIComponent(itemId)}`,
  /** @deprecated All knowledge browsing lives on the main hub page. */
  caraKnowledgeKnows: "/dashboard/cara-knowledge",
  caraKnowledgeKnowsCategory: (_category: string) => "/dashboard/cara-knowledge",
  caraKnowledgeTeach: "/dashboard/cara-knowledge?teach=1",
  caraKnowledgeUnlearn: "/dashboard/cara-knowledge",
  caraKnowledgeHistory: "/dashboard/cara-knowledge?tab=history",
  businessProfile: "/dashboard/business/profile",
  businessServices: "/dashboard/business/services",
  businessAnswers: "/dashboard/business/answers",
  /** @deprecated Use businessAnswers or caraKnowledge */
  businessFaqs: "/dashboard/business/answers",
  businessFiles: "/dashboard/business/files",
  usage: "/dashboard/usage",
  support: "/dashboard/support",
  legal: "/dashboard/legal",
  legalAccept: "/dashboard/legal-accept",
  legalDataRequests: "/dashboard/legal/data-requests",
  legalCallerNotice: "/dashboard/legal/caller-notice",
  /** @deprecated Use legalDataRequests */
  gdpr: "/dashboard/legal/data-requests",
  settings: "/dashboard/settings",
  phoneSetup: "/dashboard/settings/phone-setup",
  locations: "/dashboard/locations",
  team: "/dashboard/team",
} as const;

/** Paths that share one agent-config form (unsaved guard treats as same surface). */
export const AGENT_CONFIG_PATH_PREFIXES = [
  "/dashboard/cara/",
  "/dashboard/business/",
] as const;

export function isAgentConfigPath(href: string): boolean {
  return AGENT_CONFIG_PATH_PREFIXES.some((prefix) => href.startsWith(prefix));
}

/** All agent-config pages to revalidate after knowledge saves. */
export const AGENT_CONFIG_REVALIDATE_PATHS = [
  DASHBOARD_ROUTES.caraGreeting,
  DASHBOARD_ROUTES.businessProfile,
  DASHBOARD_ROUTES.businessServices,
  DASHBOARD_ROUTES.businessAnswers,
  DASHBOARD_ROUTES.businessFiles,
  DASHBOARD_ROUTES.caraSetup,
  DASHBOARD_ROUTES.caraKnowledge,
  DASHBOARD_ROUTES.caraKnowledgeNeedsInput,
  DASHBOARD_ROUTES.caraKnowledgeKnows,
  DASHBOARD_ROUTES.caraKnowledgeTeach,
  DASHBOARD_ROUTES.caraKnowledgeUnlearn,
  DASHBOARD_ROUTES.caraKnowledgeHistory,
  `${DASHBOARD_ROUTES.caraSetup}/general`,
  `${DASHBOARD_ROUTES.caraSetup}/services`,
  `${DASHBOARD_ROUTES.caraSetup}/answers`,
] as const;

export const CARA_KNOWLEDGE_REVALIDATE_PATHS = [
  DASHBOARD_ROUTES.caraKnowledge,
  DASHBOARD_ROUTES.caraKnowledgeNeedsInput,
  DASHBOARD_ROUTES.caraKnowledgeTeach,
  DASHBOARD_ROUTES.caraKnowledgeHistory,
  DASHBOARD_ROUTES.home,
] as const;

/** Legacy paths → canonical (middleware + bookmarks). */
export const LEGACY_DASHBOARD_REDIRECTS: Record<string, string> = {
  "/dashboard/action-inbox": DASHBOARD_ROUTES.calls,
  "/dashboard/legal/accept": DASHBOARD_ROUTES.legalAccept,
  "/dashboard/call-history": DASHBOARD_ROUTES.calls,
  "/dashboard/contacts": DASHBOARD_ROUTES.calls,
  "/dashboard/clients": DASHBOARD_ROUTES.calls,
  "/dashboard/billing": DASHBOARD_ROUTES.usage,
  "/dashboard/agent-setup": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/cara-setup": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/cara-setup/general": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/cara-setup/services": DASHBOARD_ROUTES.businessServices,
  "/dashboard/cara-setup/call-handling": DASHBOARD_ROUTES.caraGreeting,
  "/dashboard/cara/call-handling": DASHBOARD_ROUTES.caraGreeting,
  "/dashboard/cara-setup/answers": DASHBOARD_ROUTES.businessAnswers,
  "/dashboard/business/faqs": DASHBOARD_ROUTES.businessAnswers,
  "/dashboard/cara-training": DASHBOARD_ROUTES.caraKnowledgeNeedsInput,
  "/dashboard/faqs": DASHBOARD_ROUTES.caraKnowledge,
  "/dashboard/cara-knowledge/needs-input": DASHBOARD_ROUTES.caraKnowledgeNeedsInput,
  "/dashboard/cara-knowledge/knows": DASHBOARD_ROUTES.caraKnowledge,
  "/dashboard/cara-knowledge/teach": DASHBOARD_ROUTES.caraKnowledgeTeach,
  "/dashboard/cara-knowledge/unlearn": DASHBOARD_ROUTES.caraKnowledge,
  "/dashboard/cara-knowledge/history": DASHBOARD_ROUTES.caraKnowledgeHistory,
  "/dashboard/cara/rules": DASHBOARD_ROUTES.caraGreeting,
  "/dashboard/business/rules": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/privacy": DASHBOARD_ROUTES.legalDataRequests,
  "/dashboard/calendar": DASHBOARD_ROUTES.home,
  "/dashboard/bookings": DASHBOARD_ROUTES.home,
  "/dashboard/payments": DASHBOARD_ROUTES.home,

  "/dashboard/storefront": DASHBOARD_ROUTES.home,
  "/dashboard/reports": DASHBOARD_ROUTES.home,
};
