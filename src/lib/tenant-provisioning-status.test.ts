import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantProvisioningStatus,
  type TenantProvisioningInput,
} from "./tenant-provisioning-status";

function baseInput(
  overrides: Partial<TenantProvisioningInput> = {},
): TenantProvisioningInput {
  return {
    organizationId: "00000000-0000-4000-8000-000000000001",
    organizationName: "Test SuperValu",
    assistantDisplayName: "Cara",
    greeting: "",
    customPrompt: "",
    phoneNumber: "",
    poolPhoneE164: null,
    poolPhoneAssigned: false,
    callRoutingMode: "cliste_number",
    fallbackNumber: "",
    storePublicNumber: "",
    divertCarrier: "",
    businessHours: null,
    agentServicesDepartments: [],
    agentFaqs: [],
    agentVoiceId: "",
    agentBusinessType: "",
    businessKnowledgeSummary: "",
    agentServicesNotOffered: "",
    agentExtraNotes: "",
    promptCompileWarnings: [],
    ownerUserId: null,
    ownerHasLegalAcceptances: false,
    inviteSentAt: "2026-01-01T00:00:00.000Z",
    inviteAcceptedAt: null,
    hasInboundCallLog: false,
    caraOnlineSince: null,
    ...overrides,
  };
}

describe("buildTenantProvisioningStatus stages", () => {
  it("starts in invited when invite not accepted", () => {
    const status = buildTenantProvisioningStatus(baseInput());
    assert.equal(status.stage, "invited");
  });

  it("moves to configuring after invite accepted", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({ inviteAcceptedAt: "2026-01-02T00:00:00.000Z" }),
    );
    assert.equal(status.stage, "configuring");
  });

  it("moves to ready when the phone is assigned and agreements accepted", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({
        inviteAcceptedAt: "2026-01-02T00:00:00.000Z",
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353871234567",
        poolPhoneAssigned: true,
        ownerUserId: "11111111-1111-4111-8111-111111111111",
        ownerHasLegalAcceptances: true,
      }),
    );
    assert.equal(status.stage, "ready");
    assert.equal(status.readyForGoLive, true);
  });

  it("does not allow caller processing before the organisation agreements are accepted", () => {
    const status = buildTenantProvisioningStatus(baseInput({
      inviteAcceptedAt: "2026-01-02T00:00:00.000Z",
      phoneNumber: "+353871234567", poolPhoneE164: "+353871234567", poolPhoneAssigned: true,
      ownerUserId: "11111111-1111-4111-8111-111111111111", ownerHasLegalAcceptances: false,
    }));
    assert.equal(status.readyForGoLive, false);
    assert.equal(status.stage, "configuring");
  });

  it("moves to live when cara_online_since is set", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({
        inviteAcceptedAt: "2026-01-02T00:00:00.000Z",
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353871234567",
        poolPhoneAssigned: true,
        caraOnlineSince: "2026-01-10T00:00:00.000Z",
      }),
    );
    assert.equal(status.stage, "live");
  });
});

describe("phone_assigned", () => {
  it("requires org cache and matching assigned pool row", () => {
    const missingPool = buildTenantProvisioningStatus(
      baseInput({
        phoneNumber: "+353871234567",
        poolPhoneAssigned: false,
      }),
    );
    assert.equal(
      missingPool.steps.find((s) => s.id === "phone_assigned")?.complete,
      false,
    );

    const mismatch = buildTenantProvisioningStatus(
      baseInput({
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353870000000",
        poolPhoneAssigned: true,
      }),
    );
    assert.equal(
      mismatch.steps.find((s) => s.id === "phone_assigned")?.complete,
      false,
    );

    const ok = buildTenantProvisioningStatus(
      baseInput({
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353871234567",
        poolPhoneAssigned: true,
      }),
    );
    assert.equal(
      ok.steps.find((s) => s.id === "phone_assigned")?.complete,
      true,
    );
  });
});
