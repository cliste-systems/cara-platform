import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { businessDescriptionFromNiche } from "@/lib/onboarding-business-type";
import {
  parseOrganizationNiche,
  type OrganizationNiche,
} from "@/lib/organization-niche";

/**
 * A "vertical" is the customer-facing grouping we tailor the whole product to.
 *
 * It sits one level above {@link OrganizationNiche}: a single vertical can cover
 * several niches (e.g. the "Salon & Beauty" vertical covers hair salons,
 * barbers, nail/beauty studios, spas, lashes, brows…). We tailor onboarding and
 * dashboard copy per vertical so we can polish one vertical end-to-end before
 * adding the next, instead of half-tailoring all 14 niches at once.
 *
 * `generic` is the deliberate fallback: anything we haven't tailored yet uses
 * neutral, business-agnostic copy.
 */
export type VerticalId = "salon_beauty" | "retail" | "generic";

export type VerticalSelectionChoice = {
  id: VerticalId;
  /** Headline on the onboarding picker card. */
  label: string;
  /** One-liner under the headline. */
  description: string;
  /** Short eyebrow above the label on the picker. */
  tagline: string;
};

export type VerticalPackCapabilities = {
  usesServiceCatalog: boolean;
  /** Omit service area from prompt compilation and DB persistence. */
  skipServiceArea: boolean;
  bookingMenuImport: boolean;
  catalogSatisfiesServicesGate: boolean;
  autoEnsureBookingRoute: boolean;
  alwaysIncludeLinkChecklist: boolean;
  linkChecklistUsesBookingInquiryRoute: boolean;
  preferPackLabelInSettings: boolean;
  defaultRouteTemplate: "booking-inquiry" | "form-application";
};

export type VerticalPackNav = {
  extraItems?: {
    href: string;
    label: string;
    section: "core" | "account";
    afterHref?: string;
  }[];
  hiddenHrefs?: string[];
  /** Business submenu hrefs to omit (Profile, Services, FAQs, Files). */
  hiddenBusinessHrefs?: string[];
  /** href → label */
  labelOverrides?: Record<string, string>;
};

export type VerticalPackOnboarding = {
  profileHeaderTitle: string;
  profileHeaderSubtitle: string;
  pickerIcon: "sparkles" | "building";
};

export type VerticalPack = {
  id: VerticalId;
  /** Niche stored when this vertical is explicitly chosen and the description
   * doesn't classify to a more specific niche inside the vertical. */
  defaultNiche: OrganizationNiche;
  /** Niches that belong to this vertical. Empty = catch-all (generic). */
  niches: readonly OrganizationNiche[];
  selection: Omit<VerticalSelectionChoice, "id">;
  /** Short noun shown beside "Cliste" in the dashboard header / product chrome. */
  productNoun: string;
  /** Niche pack version — bump when vertical-specific dashboard flows change. */
  packVersion: string;
  /** How Cara/the product refers to a customer's clientele (e.g. "clients"). */
  customerNoun: { singular: string; plural: string };
  /** Location switcher noun (e.g. "Location" vs "Site"). */
  locationNoun: string;
  nav?: VerticalPackNav;
  capabilities: VerticalPackCapabilities;
  onboarding: VerticalPackOnboarding;
};

const SALON_CAPABILITIES: VerticalPackCapabilities = {
  usesServiceCatalog: true,
  skipServiceArea: true,
  bookingMenuImport: true,
  catalogSatisfiesServicesGate: true,
  autoEnsureBookingRoute: true,
  alwaysIncludeLinkChecklist: true,
  linkChecklistUsesBookingInquiryRoute: true,
  preferPackLabelInSettings: true,
  defaultRouteTemplate: "booking-inquiry",
};

const RETAIL_CAPABILITIES: VerticalPackCapabilities = {
  usesServiceCatalog: false,
  skipServiceArea: true,
  bookingMenuImport: false,
  catalogSatisfiesServicesGate: false,
  autoEnsureBookingRoute: false,
  alwaysIncludeLinkChecklist: false,
  linkChecklistUsesBookingInquiryRoute: false,
  preferPackLabelInSettings: true,
  defaultRouteTemplate: "form-application",
};

const GENERIC_CAPABILITIES: VerticalPackCapabilities = {
  usesServiceCatalog: true,
  skipServiceArea: false,
  bookingMenuImport: false,
  catalogSatisfiesServicesGate: false,
  autoEnsureBookingRoute: false,
  alwaysIncludeLinkChecklist: false,
  linkChecklistUsesBookingInquiryRoute: false,
  preferPackLabelInSettings: false,
  defaultRouteTemplate: "form-application",
};

/** Niches that roll up into the Salon & Beauty vertical. */
const SALON_BEAUTY_NICHES = ["hair_salon", "barber", "beauty"] as const;

const SALON_BEAUTY_PACK: VerticalPack = {
  id: "salon_beauty",
  defaultNiche: "hair_salon",
  niches: SALON_BEAUTY_NICHES,
  selection: {
    label: "Salon & Beauty",
    tagline: "Beauty & wellness",
    description:
      "Salons, barbers, nail studios, and spas — Cara is tuned for appointment-based beauty businesses.",
  },
  productNoun: "Salon",
  packVersion: "1.0",
  customerNoun: { singular: "client", plural: "clients" },
  locationNoun: "Location",
  capabilities: SALON_CAPABILITIES,
  onboarding: {
    profileHeaderTitle: "Tell us about your salon",
    profileHeaderSubtitle:
      "A few details so Cara can answer your clients’ questions and capture enquiries.",
    pickerIcon: "sparkles",
  },
};

/** Niches that roll up into the Retail vertical. */
const RETAIL_NICHES = ["retail"] as const;

const RETAIL_PACK: VerticalPack = {
  id: "retail",
  defaultNiche: "retail",
  niches: RETAIL_NICHES,
  selection: {
    label: "Retail",
    tagline: "Stores & supermarkets",
    description:
      "Shops and supermarkets — Cara answers hours and department questions, takes messages, and puts callers through.",
  },
  productNoun: "Store",
  packVersion: "1.0",
  customerNoun: { singular: "customer", plural: "customers" },
  locationNoun: "Store",
  nav: {
    extraItems: [
      {
        href: DASHBOARD_ROUTES.departments,
        label: "Departments",
        section: "core",
        afterHref: DASHBOARD_ROUTES.businessFaqs,
      },
      {
        href: DASHBOARD_ROUTES.products,
        label: "Products",
        section: "core",
        afterHref: DASHBOARD_ROUTES.departments,
      },
    ],
    hiddenHrefs: [
      DASHBOARD_ROUTES.actionInbox,
      DASHBOARD_ROUTES.routing,
      DASHBOARD_ROUTES.locations,
      DASHBOARD_ROUTES.usage,
    ],
    hiddenBusinessHrefs: [
      DASHBOARD_ROUTES.businessServices,
      DASHBOARD_ROUTES.businessFiles,
    ],
  },
  capabilities: RETAIL_CAPABILITIES,
  onboarding: {
    profileHeaderTitle: "Tell us about your shop",
    profileHeaderSubtitle:
      "A few details so Cara can answer your customers the way you would.",
    pickerIcon: "building",
  },
};

const GENERIC_PACK: VerticalPack = {
  id: "generic",
  defaultNiche: "other",
  niches: [],
  selection: {
    label: "Something else",
    tagline: "Any other business",
    description:
      "Shops, trades, hospitality, clinics, and more — flexible call handling for any local business.",
  },
  productNoun: "Business",
  packVersion: "1.0",
  customerNoun: { singular: "contact", plural: "contacts" },
  locationNoun: "Site",
  capabilities: GENERIC_CAPABILITIES,
  onboarding: {
    profileHeaderTitle: "Tell us about your business",
    profileHeaderSubtitle:
      "A few details so Cara can answer calls the way you would.",
    pickerIcon: "building",
  },
};

export const VERTICAL_PACKS: Record<VerticalId, VerticalPack> = {
  salon_beauty: SALON_BEAUTY_PACK,
  retail: RETAIL_PACK,
  generic: GENERIC_PACK,
};

/**
 * Choices shown on the onboarding niche picker, in display order. Today this is
 * intentionally short: the tailored vertical plus the generic fallback. Add a
 * new pack here (e.g. trades) when its copy is ready.
 */
export const VERTICAL_CHOICES: VerticalSelectionChoice[] = [
  { id: RETAIL_PACK.id, ...RETAIL_PACK.selection },
  { id: SALON_BEAUTY_PACK.id, ...SALON_BEAUTY_PACK.selection },
  { id: GENERIC_PACK.id, ...GENERIC_PACK.selection },
];

const NICHE_TO_VERTICAL: ReadonlyMap<OrganizationNiche, VerticalId> = new Map<
  OrganizationNiche,
  VerticalId
>([
  ...SALON_BEAUTY_NICHES.map((niche) => [niche, "salon_beauty"] as const),
  ...RETAIL_NICHES.map((niche) => [niche, "retail"] as const),
]);

/** Which vertical a stored niche belongs to. */
export function verticalIdForNiche(
  raw: string | null | undefined,
): VerticalId {
  return NICHE_TO_VERTICAL.get(parseOrganizationNiche(raw)) ?? "generic";
}

/** The tailored pack for a stored niche (falls back to the generic pack). */
export function verticalPackForNiche(
  raw: string | null | undefined,
): VerticalPack {
  return VERTICAL_PACKS[verticalIdForNiche(raw)];
}

export function isVerticalId(v: string): v is VerticalId {
  return v in VERTICAL_PACKS;
}

export function parseVerticalId(
  raw: string | null | undefined,
): VerticalId | null {
  return raw && isVerticalId(raw) ? raw : null;
}

/**
 * Resolve the niche to store given the owner's explicit vertical choice and the
 * niche our classifier inferred from their description.
 *
 * - "Salon & Beauty" chosen: keep the classified niche when it's inside the
 *   salon family (so barber vs hair salon vs beauty stays accurate), otherwise
 *   pin it to the vertical's default so they still get the tailored experience.
 * - "Something else" (or no choice): trust the classifier as before.
 */
/** Default niche + agent label when the owner only picks a vertical (no free-text description). */
export function profileDefaultsForVertical(vertical: VerticalId): {
  niche: OrganizationNiche;
  agentBusinessType: string;
} {
  const pack = VERTICAL_PACKS[vertical];
  return {
    niche: pack.defaultNiche,
    agentBusinessType:
      businessDescriptionFromNiche(pack.defaultNiche) || pack.selection.label,
  };
}

export function resolveNicheForVerticalChoice(
  choice: VerticalId | null,
  classifiedNiche: OrganizationNiche,
): OrganizationNiche {
  if (choice === "salon_beauty") {
    return verticalIdForNiche(classifiedNiche) === "salon_beauty"
      ? classifiedNiche
      : SALON_BEAUTY_PACK.defaultNiche;
  }
  if (choice === "retail") {
    return classifiedNiche === "retail" ? "retail" : RETAIL_PACK.defaultNiche;
  }
  return classifiedNiche;
}
