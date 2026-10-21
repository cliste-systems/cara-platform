"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  formatAgentKnowledgeList,
  formatWeekScheduleForAgent,
} from "@/lib/agent-knowledge-format";
import { cleanBusinessRules } from "@/lib/agent-business-rules";
import {
  DEFAULT_CARA_CONDUCT,
  type CaraConduct,
} from "@/lib/agent-cara-conduct";
import { weekScheduleHasOpenDay } from "@/lib/business-hours";
import { dedupeServiceChips } from "@/lib/services-boundary";
import { syncCaptureFieldsFromDetailLabels } from "@/lib/sync-capture-fields";
import {
  composeCaptureDetailsNote,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import {
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  resolveVoiceGreetingPreview,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";

import { saveAgentSetup } from "../agent-setup/actions";
import type { AgentFaq } from "../agent-setup/agent-faqs";
import type { AgentSetupInitial } from "../agent-setup/agent-setup-helpers";
import type { BusinessFileListItem } from "@/lib/business-files";
import type { WeekSchedule, BankHolidayConfig } from "@/lib/business-hours";
import type { CaraSetupPromptInput } from "@/lib/compile-cara-prompt";
import type { DetailsCollectMode } from "@/lib/details-collect-mode";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import type { ServiceCatalogSupplement } from "@/lib/service-catalog-supplement";
import type { VerticalId } from "@/lib/verticals";

type FormSnapshot = {
  assistantDisplayName: string;
  greetingIntro: string;
  greetingClosing: string;
  businessType: string;
  openingHoursSchedule: WeekSchedule;
  openingHoursLegacy: string;
  hoursNeverConfigured: boolean;
  open24_7: boolean;
  hoursNote: string;
  bankHolidays: BankHolidayConfig;
  serviceAreaItems: string[];
  serviceAreaExclusionItems: string[];
  servicesItems: string[];
  servicesNotOfferedItems: string[];
  detailsToCollectItems: string[];
  detailsCollectMode: DetailsCollectMode;
  businessRulesItems: string[];
  caraRulesItems: string[];
  caraConduct: CaraConduct;
  captureFields: CaraCaptureField[];
  rawBusinessDescription: string;
  faqs: AgentFaq[];
  locationAddress: string;
  locationEircode: string;
  baseTown: string;
  locationCounty: string;
};

type CaraSetupFormContextValue = {
  businessName: string;
  niche: string;
  verticalId: VerticalId;
  businessFiles: BusinessFileListItem[];
  setBusinessFiles: (files: BusinessFileListItem[]) => void;
  assistantDisplayName: string;
  setAssistantDisplayName: (v: string) => void;
  greetingIntro: string;
  setGreetingIntro: (v: string) => void;
  greetingClosing: string;
  setGreetingClosing: (v: string) => void;
  businessType: string;
  setBusinessType: (v: string) => void;
  /** Read-only — assigned Cliste inbound line. */
  clistePhoneNumber: string;
  locationAddress: string;
  setLocationAddress: (v: string) => void;
  locationEircode: string;
  setLocationEircode: (v: string) => void;
  baseTown: string;
  setBaseTown: (v: string) => void;
  locationCounty: string;
  setLocationCounty: (v: string) => void;
  openingHoursSchedule: WeekSchedule;
  setOpeningHoursSchedule: (v: WeekSchedule) => void;
  openingHoursLegacy: string;
  hoursNeverConfigured: boolean;
  open24_7: boolean;
  setOpen24_7: (v: boolean) => void;
  hoursNote: string;
  setHoursNote: (v: string) => void;
  bankHolidays: BankHolidayConfig;
  setBankHolidays: (v: BankHolidayConfig) => void;
  serviceAreaItems: string[];
  setServiceAreaItems: (v: string[]) => void;
  serviceAreaExclusionItems: string[];
  setServiceAreaExclusionItems: (v: string[]) => void;
  servicesItems: string[];
  setServicesItems: (v: string[]) => void;
  servicesNotOfferedItems: string[];
  setServicesNotOfferedItems: (v: string[]) => void;
  serviceCatalog: ServiceCatalogItem[];
  setServiceCatalog: (v: ServiceCatalogItem[]) => void;
  serviceCatalogSupplement?: ServiceCatalogSupplement;
  quotePricesOnCalls: boolean;
  setQuotePricesOnCalls: (v: boolean) => void;
  detailsToCollectItems: string[];
  setDetailsToCollectItems: (v: string[]) => void;
  detailsCollectMode: DetailsCollectMode;
  setDetailsCollectMode: (v: DetailsCollectMode) => void;
  businessRulesItems: string[];
  setBusinessRulesItems: (v: string[]) => void;
  caraRulesItems: string[];
  setCaraRulesItems: (v: string[]) => void;
  caraConduct: CaraConduct;
  setCaraConduct: (v: CaraConduct) => void;
  rawBusinessDescription: string;
  setRawBusinessDescription: (v: string) => void;
  faqs: AgentFaq[];
  setFaqs: (v: AgentFaq[]) => void;
  isDirty: boolean;
  pending: boolean;
  status: { kind: "ok" | "error"; message: string } | null;
  save: () => void;
  saveAsync: () => Promise<boolean>;
  markSavedBaseline: () => void;
  discardChanges: () => void;
  promptExtras: Pick<
    CaraSetupPromptInput,
    "routes" | "fallbackNote" | "transferNumber" | "businessScope"
  >;
};

const CaraSetupFormContext = createContext<CaraSetupFormContextValue | null>(
  null,
);

function snapshotFromState(
  state: FormSnapshot,
  openingHoursLegacy: string,
): string {
  return JSON.stringify({ ...state, openingHoursLegacy });
}

export function CaraSetupFormProvider({
  initial,
  businessFiles,
  promptExtras,
  children,
}: {
  initial: AgentSetupInitial;
  businessFiles: BusinessFileListItem[];
  promptExtras: Pick<
    CaraSetupPromptInput,
    "routes" | "fallbackNote" | "transferNumber" | "businessScope"
  >;
  children: ReactNode;
}) {
  const defaultIntro = defaultVoiceGreetingIntro(initial.businessName);
  const parsedGreeting = parseGreetingParts(
    initial.greeting,
    initial.assistantDisplayName,
    defaultIntro,
  );
  const [assistantDisplayName, setAssistantDisplayName] = useState(
    initial.assistantDisplayName,
  );
  const [greetingIntro, setGreetingIntro] = useState(parsedGreeting.intro);
  const [greetingClosing, setGreetingClosing] = useState(parsedGreeting.closing);
  const [businessType, setBusinessType] = useState(initial.businessType);
  const [locationAddress, setLocationAddress] = useState(
    initial.locationAddress,
  );
  const [locationEircode, setLocationEircode] = useState(
    initial.locationEircode,
  );
  const [baseTown, setBaseTown] = useState(initial.baseTown);
  const [locationCounty, setLocationCounty] = useState(initial.locationCounty);
  const [openingHoursSchedule, setOpeningHoursSchedule] = useState(
    initial.openingHoursSchedule,
  );
  const [openingHoursLegacy, setOpeningHoursLegacy] = useState(
    initial.openingHoursLegacy ?? "",
  );
  const [hoursNeverConfigured, setHoursNeverConfigured] = useState(
    initial.hoursNeverConfigured,
  );
  const [open24_7, setOpen24_7] = useState(initial.open24_7);
  const [hoursNote, setHoursNote] = useState(initial.hoursNote);
  const [bankHolidays, setBankHolidays] = useState(initial.bankHolidays);
  const [serviceAreaItems, setServiceAreaItems] = useState(
    initial.serviceAreaItems,
  );
  const [serviceAreaExclusionItems, setServiceAreaExclusionItems] = useState(
    initial.serviceAreaExclusionItems,
  );
  const [servicesItems, setServicesItems] = useState(initial.servicesItems);
  const [servicesNotOfferedItems, setServicesNotOfferedItems] = useState(
    initial.servicesNotOfferedItems,
  );
  const [serviceCatalog, setServiceCatalog] = useState(initial.serviceCatalog);
  const [serviceCatalogSupplement, setServiceCatalogSupplement] = useState(
    initial.serviceCatalogSupplement,
  );
  const [quotePricesOnCalls, setQuotePricesOnCalls] = useState(
    initial.quotePricesOnCalls,
  );
  const [detailsToCollectItems, setDetailsToCollectItems] = useState(
    initial.detailsToCollectItems ?? [],
  );
  const [detailsCollectMode, setDetailsCollectMode] = useState(
    initial.detailsCollectMode,
  );
  const [businessRulesItems, setBusinessRulesItems] = useState(
    initial.businessRules ?? [],
  );
  const [caraRulesItems, setCaraRulesItems] = useState(initial.caraRules ?? []);
  const [caraConduct, setCaraConduct] = useState(
    initial.caraConduct ?? DEFAULT_CARA_CONDUCT,
  );
  const [captureFields, setCaptureFields] = useState(initial.captureFields);
  const [rawBusinessDescription, setRawBusinessDescription] = useState(
    initial.rawBusinessDescription,
  );
  const [faqs, setFaqs] = useState<AgentFaq[]>(initial.faqs);
  const [businessFilesState, setBusinessFiles] = useState(businessFiles);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; message: string } | null
  >(null);
  const baselineRef = useRef(
    snapshotFromState(
      {
        assistantDisplayName: initial.assistantDisplayName,
        greetingIntro: parsedGreeting.intro,
        greetingClosing: parsedGreeting.closing,
        businessType: initial.businessType,
        openingHoursSchedule: initial.openingHoursSchedule,
        openingHoursLegacy: initial.openingHoursLegacy ?? "",
        hoursNeverConfigured: initial.hoursNeverConfigured,
        open24_7: initial.open24_7,
        hoursNote: initial.hoursNote,
        bankHolidays: initial.bankHolidays,
        serviceAreaItems: initial.serviceAreaItems,
        serviceAreaExclusionItems: initial.serviceAreaExclusionItems,
        servicesItems: initial.servicesItems,
        servicesNotOfferedItems: initial.servicesNotOfferedItems,
        detailsToCollectItems: initial.detailsToCollectItems,
        detailsCollectMode: initial.detailsCollectMode,
        businessRulesItems: initial.businessRules,
        caraRulesItems: initial.caraRules,
        caraConduct: initial.caraConduct ?? DEFAULT_CARA_CONDUCT,
        captureFields: initial.captureFields,
        rawBusinessDescription: initial.rawBusinessDescription,
        faqs: initial.faqs,
        locationAddress: initial.locationAddress,
        locationEircode: initial.locationEircode,
        baseTown: initial.baseTown,
        locationCounty: initial.locationCounty,
      },
      initial.openingHoursLegacy ?? "",
    ),
  );

  useEffect(() => {
    setBusinessFiles(businessFiles);
  }, [businessFiles]);

  const initialSig = useMemo(
    () =>
      JSON.stringify({
        assistantDisplayName: initial.assistantDisplayName,
        greetingIntro: parsedGreeting.intro,
        greetingClosing: parsedGreeting.closing,
        businessType: initial.businessType,
        openingHoursSchedule: initial.openingHoursSchedule,
        openingHoursLegacy: initial.openingHoursLegacy,
        hoursNeverConfigured: initial.hoursNeverConfigured,
        open24_7: initial.open24_7,
        hoursNote: initial.hoursNote,
        bankHolidays: initial.bankHolidays,
        serviceAreaItems: initial.serviceAreaItems,
        serviceAreaExclusionItems: initial.serviceAreaExclusionItems,
        servicesItems: initial.servicesItems,
        servicesNotOfferedItems: initial.servicesNotOfferedItems,
        detailsToCollectItems: initial.detailsToCollectItems,
        detailsCollectMode: initial.detailsCollectMode,
        businessRulesItems: initial.businessRules,
        caraRulesItems: initial.caraRules,
        caraConduct: initial.caraConduct ?? DEFAULT_CARA_CONDUCT,
        captureFields: initial.captureFields,
        rawBusinessDescription: initial.rawBusinessDescription,
        faqs: initial.faqs,
        locationAddress: initial.locationAddress,
        locationEircode: initial.locationEircode,
        baseTown: initial.baseTown,
        locationCounty: initial.locationCounty,
      }),
    [initial],
  );

  // Chat-to-Cara saves server-side; merge into form without clobbering dirty fields.
  useEffect(() => {
    const currentSnap = snapshotFromState(
      {
        assistantDisplayName,
        greetingIntro,
        greetingClosing,
        businessType,
        openingHoursSchedule,
        openingHoursLegacy,
        hoursNeverConfigured,
        open24_7,
        hoursNote,
        bankHolidays,
        serviceAreaItems,
        serviceAreaExclusionItems,
        servicesItems,
        servicesNotOfferedItems,
        detailsToCollectItems,
        detailsCollectMode,
        businessRulesItems,
        caraRulesItems,
        caraConduct,
        captureFields,
        rawBusinessDescription,
        faqs,
        locationAddress,
        locationEircode,
        baseTown,
        locationCounty,
      },
      openingHoursLegacy,
    );
    const isDirtyNow = currentSnap !== baselineRef.current;

    if (isDirtyNow) return;

    const nextParsed = parseGreetingParts(
      initial.greeting,
      initial.assistantDisplayName,
      defaultVoiceGreetingIntro(initial.businessName),
    );
    setAssistantDisplayName(initial.assistantDisplayName);
    setGreetingIntro(nextParsed.intro);
    setGreetingClosing(nextParsed.closing);
    setBusinessType(initial.businessType);
    setLocationAddress(initial.locationAddress);
    setLocationEircode(initial.locationEircode);
    setBaseTown(initial.baseTown);
    setLocationCounty(initial.locationCounty);
    setOpeningHoursSchedule(initial.openingHoursSchedule);
    setOpeningHoursLegacy(initial.openingHoursLegacy ?? "");
    setHoursNeverConfigured(initial.hoursNeverConfigured);
    setOpen24_7(initial.open24_7);
    setHoursNote(initial.hoursNote);
    setBankHolidays(initial.bankHolidays);
    setServiceAreaItems(initial.serviceAreaItems);
    setServiceAreaExclusionItems(initial.serviceAreaExclusionItems);
    setServicesItems(initial.servicesItems);
    setServicesNotOfferedItems(initial.servicesNotOfferedItems);
    setServiceCatalog(initial.serviceCatalog);
    setServiceCatalogSupplement(initial.serviceCatalogSupplement);
    setQuotePricesOnCalls(initial.quotePricesOnCalls);
    setDetailsToCollectItems(initial.detailsToCollectItems);
    setCaptureFields(initial.captureFields);
    setRawBusinessDescription(initial.rawBusinessDescription);
    setDetailsCollectMode(initial.detailsCollectMode);
    setBusinessRulesItems(initial.businessRules);
    setCaraRulesItems(initial.caraRules);
    setCaraConduct(initial.caraConduct ?? DEFAULT_CARA_CONDUCT);
    setFaqs(initial.faqs);
    baselineRef.current = snapshotFromState(
      {
        assistantDisplayName: initial.assistantDisplayName,
        greetingIntro: nextParsed.intro,
        greetingClosing: nextParsed.closing,
        businessType: initial.businessType,
        openingHoursSchedule: initial.openingHoursSchedule,
        openingHoursLegacy: initial.openingHoursLegacy ?? "",
        hoursNeverConfigured: initial.hoursNeverConfigured,
        open24_7: initial.open24_7,
        hoursNote: initial.hoursNote,
        bankHolidays: initial.bankHolidays,
        serviceAreaItems: initial.serviceAreaItems,
        serviceAreaExclusionItems: initial.serviceAreaExclusionItems,
        servicesItems: initial.servicesItems,
        servicesNotOfferedItems: initial.servicesNotOfferedItems,
        detailsToCollectItems: initial.detailsToCollectItems,
        detailsCollectMode: initial.detailsCollectMode,
        businessRulesItems: initial.businessRules,
        caraRulesItems: initial.caraRules,
        caraConduct: initial.caraConduct ?? DEFAULT_CARA_CONDUCT,
        captureFields: initial.captureFields,
        rawBusinessDescription: initial.rawBusinessDescription,
        faqs: initial.faqs,
        locationAddress: initial.locationAddress,
        locationEircode: initial.locationEircode,
        baseTown: initial.baseTown,
        locationCounty: initial.locationCounty,
      },
      initial.openingHoursLegacy ?? "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSig]);

  const currentSnapshot = snapshotFromState(
    {
      assistantDisplayName,
      greetingIntro,
      greetingClosing,
      businessType,
      openingHoursSchedule,
      openingHoursLegacy,
      hoursNeverConfigured,
      open24_7,
      hoursNote,
      bankHolidays,
      serviceAreaItems,
      serviceAreaExclusionItems,
      servicesItems,
      servicesNotOfferedItems,
      detailsToCollectItems,
      detailsCollectMode,
      businessRulesItems,
      caraRulesItems,
      caraConduct,
      captureFields,
      rawBusinessDescription,
      faqs,
      locationAddress,
      locationEircode,
      baseTown,
      locationCounty,
    },
    openingHoursLegacy,
  );

  const isDirty = currentSnapshot !== baselineRef.current;

  const markSavedBaseline = useCallback(() => {
    baselineRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const discardChanges = useCallback(() => {
    const base = JSON.parse(baselineRef.current) as FormSnapshot & {
      openingHoursLegacy: string;
    };
    setAssistantDisplayName(base.assistantDisplayName);
    setGreetingIntro(base.greetingIntro);
    setGreetingClosing(base.greetingClosing);
    setBusinessType(base.businessType);
    setOpeningHoursSchedule(base.openingHoursSchedule);
    setOpeningHoursLegacy(base.openingHoursLegacy);
    setHoursNeverConfigured(base.hoursNeverConfigured);
    setOpen24_7(base.open24_7);
    setHoursNote(base.hoursNote);
    setBankHolidays(base.bankHolidays);
    setServiceAreaItems(base.serviceAreaItems);
    setServiceAreaExclusionItems(base.serviceAreaExclusionItems);
    setServicesItems(base.servicesItems);
    setServicesNotOfferedItems(base.servicesNotOfferedItems);
    setDetailsToCollectItems(base.detailsToCollectItems ?? []);
    setCaptureFields(base.captureFields ?? initial.captureFields);
    setRawBusinessDescription(base.rawBusinessDescription ?? "");
    setDetailsCollectMode(base.detailsCollectMode ?? initial.detailsCollectMode);
    setBusinessRulesItems(base.businessRulesItems ?? []);
    setCaraRulesItems(base.caraRulesItems ?? []);
    setCaraConduct(base.caraConduct ?? DEFAULT_CARA_CONDUCT);
    setFaqs(base.faqs);
    setLocationAddress(base.locationAddress);
    setLocationEircode(base.locationEircode);
    setBaseTown(base.baseTown);
    setLocationCounty(base.locationCounty);
  }, []);

  const updateDetailsToCollectItems = useCallback((next: string[]) => {
    setDetailsToCollectItems(next);
    setCaptureFields((current) => syncCaptureFieldsFromDetailLabels(current, next));
  }, []);

  const buildSavePayload = useCallback(() => {
    const hasHours = weekScheduleHasOpenDay(openingHoursSchedule);
    return {
      assistantDisplayName: assistantDisplayName,
      greetingIntro,
      greetingClosing,
      faqs,
      openingHours: open24_7
        ? "Open 24 hours, 7 days a week"
        : hasHours
          ? formatWeekScheduleForAgent(openingHoursSchedule)
          : "Closed all week",
      businessHours: openingHoursSchedule,
      open24_7,
      hoursNote,
      bankHolidays,
      serviceArea: "",
      serviceAreaExclusions: "",
      servicesDepartments: formatAgentKnowledgeList(
        dedupeServiceChips(servicesItems),
      ),
      servicesNotOffered: formatAgentKnowledgeList(
        dedupeServiceChips(servicesNotOfferedItems),
      ),
      detailsToCollect: composeCaptureDetailsNote(captureFields),
      detailsCollectMode,
      businessRules: cleanBusinessRules(businessRulesItems),
      caraConduct,
      locationAddress,
      locationEircode,
      baseTown,
      locationCounty,
      captureFields,
      rawBusinessDescription,
    };
  }, [
    greetingIntro,
    greetingClosing,
    faqs,
    openingHoursSchedule,
    open24_7,
    hoursNote,
    bankHolidays,
    serviceAreaItems,
    serviceAreaExclusionItems,
    servicesItems,
    servicesNotOfferedItems,
    captureFields,
    detailsCollectMode,
    businessRulesItems,
    caraConduct,
    locationAddress,
    locationEircode,
    baseTown,
    locationCounty,
    rawBusinessDescription,
  ]);

  const saveAsync = useCallback(async (): Promise<boolean> => {
    setStatus(null);
    const res = await saveAgentSetup(buildSavePayload());
    if (res.ok) {
      baselineRef.current = currentSnapshot;
      setHoursNeverConfigured(false);
      setStatus({ kind: "ok", message: "Changes saved." });
      return true;
    }
    setStatus({ kind: "error", message: res.message });
    return false;
  }, [
    buildSavePayload,
    currentSnapshot,
  ]);

  const save = useCallback(() => {
    startTransition(async () => {
      await saveAsync();
    });
  }, [saveAsync]);

  const value: CaraSetupFormContextValue = {
    businessName: initial.businessName,
    niche: initial.niche,
    verticalId: initial.verticalId,
    businessFiles: businessFilesState,
    setBusinessFiles,
    assistantDisplayName,
    setAssistantDisplayName,
    greetingIntro,
    setGreetingIntro,
    greetingClosing,
    setGreetingClosing,
    businessType,
    setBusinessType,
    clistePhoneNumber: initial.clistePhoneNumber,
    locationAddress,
    setLocationAddress,
    locationEircode,
    setLocationEircode,
    baseTown,
    setBaseTown,
    locationCounty,
    setLocationCounty,
    openingHoursSchedule,
    setOpeningHoursSchedule,
    openingHoursLegacy,
    hoursNeverConfigured,
    open24_7,
    setOpen24_7,
    hoursNote,
    setHoursNote,
    bankHolidays,
    setBankHolidays,
    serviceAreaItems,
    setServiceAreaItems,
    serviceAreaExclusionItems,
    setServiceAreaExclusionItems,
    servicesItems,
    setServicesItems,
    servicesNotOfferedItems,
    setServicesNotOfferedItems,
    serviceCatalog,
    setServiceCatalog,
    serviceCatalogSupplement,
    quotePricesOnCalls,
    setQuotePricesOnCalls,
    detailsToCollectItems,
    setDetailsToCollectItems: updateDetailsToCollectItems,
    detailsCollectMode,
    setDetailsCollectMode,
    businessRulesItems,
    setBusinessRulesItems,
    caraRulesItems,
    setCaraRulesItems,
    caraConduct,
    setCaraConduct,
    rawBusinessDescription,
    setRawBusinessDescription,
    faqs,
    setFaqs,
    isDirty,
    pending,
    status,
    save,
    saveAsync,
    markSavedBaseline,
    discardChanges,
    promptExtras,
  };

  return (
    <CaraSetupFormContext.Provider value={value}>
      {children}
    </CaraSetupFormContext.Provider>
  );
}

export function useCaraSetupForm(): CaraSetupFormContextValue {
  const ctx = useContext(CaraSetupFormContext);
  if (!ctx) {
    throw new Error("useCaraSetupForm must be used within CaraSetupFormProvider");
  }
  return ctx;
}
