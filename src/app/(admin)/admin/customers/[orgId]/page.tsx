import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";

import {
  clientProvisionSourceBadgeClass,
  clientProvisionSourceDescription,
  clientProvisionSourceLabel,
} from "@/lib/client-provision-source";
import { loadAdminClientDetail } from "@/lib/load-admin-clients";
import { loadOrganizationProvisioning } from "@/lib/load-provisioning-pipeline";
import { livekitUsNumbersEnabled } from "@/lib/livekit-us-numbers-flag";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import { createAdminClient } from "@/utils/supabase/admin";

import { adminCustomersPath } from "@/lib/admin-route-paths";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AccountPlanForm } from "@/app/(admin)/admin/organizations/[id]/account-plan-form";
import { GoLiveCard } from "@/app/(admin)/admin/organizations/[id]/go-live-card";
import { IrishPhoneCard } from "@/app/(admin)/admin/organizations/[id]/irish-phone-card";
import { LiveKitPhoneCard } from "@/app/(admin)/admin/organizations/[id]/livekit-phone-card";
import { OpenDashboardButton } from "@/app/(admin)/admin/organizations/[id]/open-dashboard-button";
import { OrganizationNicheForm } from "@/app/(admin)/admin/organizations/[id]/organization-niche-form";
import {
  CaraTrainingLinkCard,
  ProvisioningStepsRail,
} from "@/app/(admin)/admin/organizations/[id]/retail-org-sections";
import { TenantProvisioningStageChip } from "@/app/(admin)/admin/tenant-provisioning-chip";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ManagedInviteCard({
  ownerEmail,
  inviteSentAt,
  inviteAcceptedAt,
}: {
  ownerEmail: string | null;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
}) {
  return (
    <section className="rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]">
      <h2 className="text-sm font-semibold text-gray-900">Owner invite</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-gray-500">Email</dt>
          <dd className="font-medium text-gray-900">{ownerEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Sent</dt>
          <dd className="text-gray-700">{formatWhen(inviteSentAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Accepted</dt>
          <dd className="text-gray-700">{formatWhen(inviteAcceptedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

function SelfServeClientSummary({
  client,
}: {
  client: NonNullable<Awaited<ReturnType<typeof loadAdminClientDetail>>>;
}) {
  return (
    <>
      <section className="rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]">
        <h2 className="text-sm font-semibold text-gray-900">Account summary</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-gray-500">Account status</dt>
            <dd className="capitalize text-gray-900">{client.accountStatus}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Plan</dt>
            <dd className="capitalize text-gray-900">{client.planTier ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Org status</dt>
            <dd className="capitalize text-gray-900">{client.orgStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Subscription</dt>
            <dd className="font-mono text-xs text-gray-700">
              {client.platformSubscriptionId ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]">
        <h2 className="text-sm font-semibold text-gray-900">Onboarding progress</h2>
        <p className="mt-2 text-sm text-gray-600">
          Wizard step{" "}
          <span className="font-medium text-gray-900">
            {client.onboardingStep ?? 0}
          </span>
          . The client completes setup in their own dashboard.
        </p>
      </section>

      <section className="rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]">
        <h2 className="text-sm font-semibold text-gray-900">Business snapshot</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Phone</dt>
            <dd className="text-gray-900">{client.phoneNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Created</dt>
            <dd className="text-gray-900">{formatWhen(client.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

export default async function AdminClientDetailPage({ params }: PageProps) {
  const { orgId } = await params;
  const client = await loadAdminClientDetail(orgId);
  if (!client) notFound();

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return (
      <AdminPageShell icon={Building2} title="Customer" backHref={adminCustomersPath()} backLabel="Customers">
        <p className="text-destructive text-sm">
          {e instanceof Error ? e.message : "Admin client unavailable."}
        </p>
      </AdminPageShell>
    );
  }

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, slug, niche, phone_number, account_id, store_code, is_active",
    )
    .eq("id", orgId)
    .maybeSingle();

  if (!org) notFound();

  const niche = parseOrganizationNiche(org.niche);
  const isManaged = client.provisionSource === "managed";
  const isRetail = niche === "retail";

  const shellProps = {
    icon: Building2,
    title: client.name,
    description: (
      <>
        {client.slug}{client.storeCode ? ` · store ${client.storeCode}` : ""} · {ORGANIZATION_NICHE_ADMIN_LABELS[niche]}
        <span className="block text-xs">{clientProvisionSourceDescription(client.provisionSource)}</span>
      </>
    ),
    backHref: adminCustomersPath(),
    backLabel: "Customers",
    actions: (
      <div className="flex flex-wrap items-center gap-2">
        <span className={clientProvisionSourceBadgeClass(client.provisionSource)}>
          {clientProvisionSourceLabel(client.provisionSource)}
        </span>
        {isManaged && client.provisioningStage ? (
          <TenantProvisioningStageChip stage={client.provisioningStage} />
        ) : null}
        <OpenDashboardButton organizationId={orgId} />
      </div>
    ),
  };

  if (!isManaged) {
    return (
      <AdminPageShell {...shellProps}>
        <SelfServeClientSummary client={client} />
      </AdminPageShell>
    );
  }

  if (isRetail) {
    const provisioning = await loadOrganizationProvisioning(orgId);
    const phoneStep = provisioning?.steps.find((s) => s.id === "phone_assigned");
    const caraTrainingStep = provisioning?.steps.find(
      (s) => s.id === "cara_trained",
    );
    const clisteNumber = org.phone_number as string | null;

    return (
      <AdminPageShell {...shellProps}>
        <ManagedInviteCard
          ownerEmail={client.ownerEmail}
          inviteSentAt={client.inviteSentAt}
          inviteAcceptedAt={client.inviteAcceptedAt}
        />
        {provisioning ? (
          <ProvisioningStepsRail steps={provisioning.steps} />
        ) : null}
        <IrishPhoneCard
          organizationId={orgId}
          phoneNumber={clisteNumber}
          phoneAssignedComplete={phoneStep?.complete}
        />
        <CaraTrainingLinkCard
          organizationId={orgId}
          trainedComplete={caraTrainingStep?.complete}
        />
        <GoLiveCard
          organizationId={orgId}
          isActive={org.is_active === true}
          readyForGoLive={provisioning?.readyForGoLive ?? false}
          missingStepLabel={
            provisioning
              ? (provisioning.steps.find(
                  (s) => s.id === "phone_assigned" && !s.complete,
                )?.label ?? null)
              : null
          }
        />
      </AdminPageShell>
    );
  }

  const accountId = org.account_id ?? null;
  const planTier = client.planTier ?? "pro";
  const showLivekit = livekitUsNumbersEnabled();

  return (
    <AdminPageShell {...shellProps}>
      <ManagedInviteCard
        ownerEmail={client.ownerEmail}
        inviteSentAt={client.inviteSentAt}
        inviteAcceptedAt={client.inviteAcceptedAt}
      />
      <IrishPhoneCard organizationId={orgId} phoneNumber={org.phone_number} />
      {accountId ? (
        <AccountPlanForm accountId={accountId} initialPlanTier={planTier} />
      ) : null}
      <OrganizationNicheForm organizationId={orgId} initialNiche={niche} />
      {showLivekit ? (
        <LiveKitPhoneCard organizationId={orgId} phoneNumber={org.phone_number} />
      ) : null}
    </AdminPageShell>
  );
}
