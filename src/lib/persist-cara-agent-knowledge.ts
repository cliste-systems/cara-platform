import "server-only";
import {serviceSelectionIssue} from "./service-selection";

import { compileCaraPhoneNotes } from "@/app/(onboarding)/onboarding/knowledge/train-cara-compile-notes";
import { cleanAgentFaqs, type AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  cleanCaptureFields,
  composeCaptureDetailsNote,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import {
  cleanBusinessRules,
  stitchBusinessRulesIntoSummary,
} from "@/lib/agent-business-rules";
import type { DetailsCollectMode } from "@/lib/details-collect-mode";
import { MAX_DESCRIPTION, MAX_SUMMARY } from "@/lib/business-knowledge-summary";

export type CaraAgentKnowledgeSaveInput = {
  businessName?: string;
  faqs: AgentFaq[];
  openingHours: string;
  businessHours: unknown;
  serviceArea: string;
  serviceAreaExclusions?: string;
  servicesOffered: string;
  servicesNotOffered: string;
  detailsToCollect: string;
  detailsCollectMode: DetailsCollectMode;
  captureFields: CaraCaptureField[];
  businessRules: string[];
  rawBusinessDescription?: string;
  /** When set, replaces `business_knowledge_summary` using compiled phone notes. */
  rebuildKnowledgeSummary?: boolean;
  /** Dashboard chip saves should drop stale onboarding paragraph fields. */
  clearOnboardingRawParagraphs?: boolean;
};

export type CaraAgentKnowledgeSaveResult =
  | { ok: true; update: Record<string, unknown> }
  | { ok: false; message: string };

const MAX_HOURS = 2000;
const MAX_SERVICE_AREA = 2000;
const MAX_SERVICES = 2000;
const MAX_DETAILS = 2000;

export function buildKnowledgeSummaryFromAgentState(input: {
  businessName: string;
  rawBusinessDescription: string;
  servicesOffered: string;
  servicesNotOffered: string;
  openingHours: string;
  serviceArea: string;
  detailsToCollect: string;
  businessRules: string[];
  faqs: AgentFaq[];
}): string {
  const compiled = compileCaraPhoneNotes({
    businessName: input.businessName,
    about: input.rawBusinessDescription,
    servicesOffered: input.servicesOffered,
    servicesNotOffered: input.servicesNotOffered,
    openingHours: input.openingHours,
    serviceArea: input.serviceArea,
    detailsToCollect: input.detailsToCollect,
    faqs: input.faqs,
  });

  return stitchBusinessRulesIntoSummary(compiled, input.businessRules);
}

export function buildCaraAgentKnowledgeOrgUpdate(
  input: CaraAgentKnowledgeSaveInput,
): CaraAgentKnowledgeSaveResult {
  const faqs = cleanAgentFaqs(input.faqs);
  const businessRules = cleanBusinessRules(input.businessRules);
  const captureFields = cleanCaptureFields(input.captureFields);
  const openingHours = String(input.openingHours ?? "").trim();
  const serviceArea = String(input.serviceArea ?? "").trim();
  const serviceAreaExclusions = String(input.serviceAreaExclusions ?? "").trim();
  const servicesOffered = String(input.servicesOffered ?? "").trim();
  const servicesNotOffered = String(input.servicesNotOffered ?? "").trim();
  const detailsToCollect =
    String(input.detailsToCollect ?? "").trim() ||
    composeCaptureDetailsNote(captureFields);
  const rawBusinessDescription = String(input.rawBusinessDescription ?? "").trim();

  if (rawBusinessDescription.length > MAX_DESCRIPTION) {
    return { ok: false, message: "Business description is too long." };
  }
  if (openingHours.length > MAX_HOURS) {
    return { ok: false, message: "Opening hours text is too long." };
  }
  if (serviceArea.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Service area text is too long." };
  }
  if (serviceAreaExclusions.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Town exclusions text is too long." };
  }
  if (servicesOffered.length > MAX_SERVICES) {
    return { ok: false, message: "Services text is too long." };
  }
  if (servicesNotOffered.length > MAX_SERVICES) {
    return { ok: false, message: "What you don't offer text is too long." };
  }
  const serviceIssue=serviceSelectionIssue(servicesOffered,servicesNotOffered,false);
  if(serviceIssue)return {ok:false,message:serviceIssue.message};
  if (detailsToCollect.length > MAX_DETAILS) {
    return { ok: false, message: "Details to collect text is too long." };
  }

  const update: Record<string, unknown> = {
    agent_faqs: faqs,
    agent_opening_hours: openingHours || null,
    business_hours: input.businessHours,
    agent_service_area: serviceArea || null,
    agent_service_area_exclusions: serviceAreaExclusions || null,
    agent_services_departments: servicesOffered || null,
    agent_services_not_offered: servicesNotOffered || null,
    agent_details_to_collect: detailsToCollect || null,
    agent_details_collect_mode: input.detailsCollectMode,
    agent_capture_fields: captureFields,
    agent_business_rules: businessRules,
    updated_at: new Date().toISOString(),
  };

  if (input.rawBusinessDescription !== undefined) {
    update.raw_business_description = rawBusinessDescription || null;
  }

  if (input.rebuildKnowledgeSummary) {
    const summary = buildKnowledgeSummaryFromAgentState({
      businessName: String(input.businessName ?? "").trim() || "this business",
      rawBusinessDescription,
      servicesOffered,
      servicesNotOffered,
      openingHours,
      serviceArea,
      detailsToCollect,
      businessRules,
      faqs,
    });
    if (summary.length > MAX_SUMMARY) {
      return { ok: false, message: "Cara's notes are too long." };
    }
    update.business_knowledge_summary = summary || null;
  }

  if (input.clearOnboardingRawParagraphs) {
    update.agent_services_departments_raw = null;
    update.agent_services_not_offered_raw = null;
    update.agent_business_rules_raw = null;
  }

  return { ok: true, update };
}
