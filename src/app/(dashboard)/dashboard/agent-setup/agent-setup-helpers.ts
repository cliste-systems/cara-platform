import type { AgentFaq } from "./agent-faqs";
import type { WeekSchedule, BankHolidayConfig } from "@/lib/business-hours";
import type { DetailsCollectMode } from "@/lib/details-collect-mode";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import type { ServiceCatalogSupplement } from "@/lib/service-catalog-supplement";
import type { VerticalId } from "@/lib/verticals";
import type { CaraCaptureField } from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import type { CaraConduct } from "@/lib/agent-cara-conduct";
import { assistantNameLabel, businessNameLabel } from "@/lib/voice-greeting";

export type AgentSetupInitial = {
  version?: string;
  businessName: string;
  assistantDisplayName: string;
  greeting: string;
  businessType: string;
  niche: string;
  verticalId: VerticalId;
  faqs: AgentFaq[];
  openingHoursSchedule: WeekSchedule;
  openingHoursLegacy?: string;
  hoursNeverConfigured: boolean;
  open24_7: boolean;
  hoursNote: string;
  bankHolidays: BankHolidayConfig;
  serviceAreaItems: string[];
  serviceAreaExclusionItems: string[];
  servicesItems: string[];
  servicesNotOfferedItems: string[];
  serviceCatalog: ServiceCatalogItem[];
  serviceCatalogSupplement?: ServiceCatalogSupplement;
  detailsToCollectItems: string[];
  detailsCollectMode: DetailsCollectMode;
  businessRules: string[];
  caraRules: string[];
  caraConduct: CaraConduct;
  captureFields: CaraCaptureField[];
  rawBusinessDescription: string;
  locationAddress: string;
  locationEircode: string;
  baseTown: string;
  locationCounty: string;
  quotePricesOnCalls: boolean;
  /** E.164 Cliste line assigned to this org (read-only in dashboard). */
  clistePhoneNumber: string;
};

export { assistantNameLabel, businessNameLabel };
