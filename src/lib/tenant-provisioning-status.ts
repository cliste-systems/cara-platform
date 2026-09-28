import {
  adminCaraTrainingReadinessDetail,
  type AdminCaraTrainingReadinessInput,
} from "@/lib/admin-cara-training-readiness";

export type TenantProvisioningStepId =
  | "invite_sent"
  | "invite_accepted"
  | "legal_acceptance"
  | "phone_assigned"
  | "cara_trained"
  | "live";

export type TenantProvisioningStage =
  | "invited"
  | "configuring"
  | "ready"
  | "live";

export type TenantProvisioningStep = {
  id: TenantProvisioningStepId;
  label: string;
  complete: boolean;
  detail: string;
};

export type TenantProvisioningStatus = {
  stage: TenantProvisioningStage;
  steps: TenantProvisioningStep[];
  readyForGoLive: boolean;
  daysSinceInvite: number | null;
};

export type TenantProvisioningInput = {
  organizationId: string;
  organizationName: string;
  assistantDisplayName: string;
  greeting: string;
  customPrompt: string;
  phoneNumber: string;
  poolPhoneE164: string | null;
  poolPhoneAssigned: boolean;
  callRoutingMode: string | null;
  fallbackNumber: string;
  storePublicNumber: string;
  divertCarrier: string;
  businessHours: unknown;
  agentServicesDepartments: unknown;
  agentFaqs: unknown;
  agentVoiceId: string;
  agentBusinessType: string;
  businessKnowledgeSummary: string;
  agentServicesNotOffered: string;
  agentExtraNotes: string;
  promptCompileWarnings: unknown;
  agentDetailsToCollect?: string;
  phoneSystem?: import("@/lib/store-transfer-capability").StorePhoneSystemRow | null;
  canTransfer?: boolean;
  quotePricesOnCalls?: boolean;
  ownerUserId: string | null;
  ownerHasLegalAcceptances: boolean;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
  hasInboundCallLog: boolean;
  caraOnlineSince: string | null;
};

export const TENANT_PROVISIONING_STEP_ORDER: {
  id: TenantProvisioningStepId;
  label: string;
}[] = [
  { id: "invite_sent", label: "Invite sent" },
  { id: "invite_accepted", label: "Invite accepted" },
  { id: "legal_acceptance", label: "Legal acceptance" },
  { id: "phone_assigned", label: "Phone assigned" },
  { id: "cara_trained", label: "Cara training" },
  { id: "live", label: "Live" },
];

const GO_LIVE_STEP_IDS: TenantProvisioningStepId[] = ["phone_assigned", "legal_acceptance"];

export function buildTenantProvisioningStatus(
  input: TenantProvisioningInput,
): TenantProvisioningStatus {
  const inviteSent = Boolean(input.inviteSentAt);
  const inviteAccepted = Boolean(input.inviteAcceptedAt);
  const legalAccepted =
    !input.ownerUserId || input.ownerHasLegalAcceptances;

  const orgPhone = input.phoneNumber.trim();
  const poolE164 = input.poolPhoneE164?.trim() ?? "";
  const phoneAssigned =
    Boolean(orgPhone) &&
    input.poolPhoneAssigned &&
    poolE164 === orgPhone;

  const live = Boolean(input.caraOnlineSince);

  const caraTrainingInput: AdminCaraTrainingReadinessInput = {
    assistantDisplayName: input.assistantDisplayName,
    agentVoiceId: input.agentVoiceId,
    greeting: input.greeting,
    greetingIntro: "",
    greetingClosing: "",
    agentBusinessType: input.agentBusinessType,
    businessKnowledgeSummary: input.businessKnowledgeSummary,
    departments: [],
    legacyDepartments: input.agentServicesDepartments,
    agentServicesNotOffered: input.agentServicesNotOffered,
    agentExtraNotes: input.agentExtraNotes,
    businessHours: input.businessHours,
    agentFaqs: Array.isArray(input.agentFaqs)
      ? input.agentFaqs.map((f) =>
          typeof f === "object" && f && "question" in f
            ? {
                question: String((f as { question: unknown }).question ?? ""),
                answer: String((f as { answer: unknown }).answer ?? ""),
              }
            : { question: "", answer: "" },
        )
      : [],
    agentDetailsToCollect: input.agentDetailsToCollect ?? "",
    phoneSystem: input.phoneSystem ?? null,
    canTransfer: input.canTransfer ?? false,
    quotePricesOnCalls: input.quotePricesOnCalls,
    customPrompt: input.customPrompt,
    promptCompileWarnings: input.promptCompileWarnings,
  };
  const caraTraining = adminCaraTrainingReadinessDetail(caraTrainingInput);

  const steps: TenantProvisioningStep[] = TENANT_PROVISIONING_STEP_ORDER.map(
    ({ id, label }) => {
      switch (id) {
        case "invite_sent":
          return {
            id,
            label,
            complete: inviteSent,
            detail: inviteSent
              ? "Owner invite emailed."
              : "Send the owner invite.",
          };
        case "invite_accepted":
          return {
            id,
            label,
            complete: inviteAccepted,
            detail: inviteAccepted
              ? "Owner signed in."
              : "Waiting for owner to accept invite.",
          };
        case "legal_acceptance":
          return {
            id,
            label,
            complete: legalAccepted,
            detail: legalAccepted
              ? "Required legal documents accepted."
              : "Owner must accept legal terms in dashboard.",
          };
        case "phone_assigned":
          return {
            id,
            label,
            complete: phoneAssigned,
            detail: phoneAssigned
              ? `Cliste number ${orgPhone} assigned.`
              : "Assign an Irish Cliste number.",
          };
        case "cara_trained": {
          const needsTelecomsInfo =
            input.phoneSystem?.has_ddi_range === null &&
            input.phoneSystem != null;
          const detail = caraTraining.detail;
          return {
            id,
            label,
            complete: caraTraining.complete,
            detail: needsTelecomsInfo
              ? `${detail} Needs telecoms info: confirm whether departments have direct-dial numbers.`
              : detail,
          };
        }
        case "live":
          return {
            id,
            label,
            complete: live,
            detail: live ? "Store is live." : "Go live when ready.",
          };
        default:
          return { id, label, complete: false, detail: "" };
      }
    },
  );

  const readyForGoLive = GO_LIVE_STEP_IDS.every(
    (id) => steps.find((s) => s.id === id)?.complete,
  );

  let stage: TenantProvisioningStage;
  if (live) {
    stage = "live";
  } else if (readyForGoLive) {
    stage = "ready";
  } else if (inviteAccepted) {
    stage = "configuring";
  } else {
    stage = "invited";
  }

  let daysSinceInvite: number | null = null;
  if (input.inviteSentAt) {
    const sent = new Date(input.inviteSentAt);
    if (!Number.isNaN(sent.getTime())) {
      daysSinceInvite = Math.floor(
        (Date.now() - sent.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  }

  return { stage, steps, readyForGoLive, daysSinceInvite };
}

export function tenantProvisioningStageLabel(
  stage: TenantProvisioningStage,
): string {
  switch (stage) {
    case "invited":
      return "Invited";
    case "configuring":
      return "Configuring";
    case "ready":
      return "Ready";
    case "live":
      return "Live";
  }
}
