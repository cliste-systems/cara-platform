import "server-only";

import { randomUUID } from "crypto";

import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk";

import {
  ADMIN_SIM_CALLER_E164,
  sortDemoCallLinesByCompany,
  workerPathLabelForE164,
  type AdminDemoCallLine,
} from "@/lib/admin-demo-call-lines";
import {
  isClientProvisionSource,
  type ClientProvisionSource,
} from "@/lib/client-provision-source";
import { livekitHttpHostFromEnv } from "@/lib/livekit-phone-numbers";
import { parseOrganizationNiche } from "@/lib/organization-niche";
import { assessTranscriptQuality } from "@/lib/call-transcript-qa";
import { createAdminClient } from "@/utils/supabase/admin";

export {
  ADMIN_SIM_CALLER_E164,
  FEATURED_DEMO_LINE_E164,
  formatIrishE164Display,
  KAVANAGHS_DEMO_LINE_E164,
  sortDemoCallLinesByCompany,
  workerPathLabelForE164,
  type AdminDemoCallLine,
} from "@/lib/admin-demo-call-lines";

type AccountJoin = {
  provision_source?: string | null;
  signup_ip?: string | null;
};

type OrgJoin = {
  id: string;
  name: string;
  slug: string;
  niche: string | null;
  account_id: string | null;
  accounts: AccountJoin | AccountJoin[] | null;
};

type PhoneRow = {
  e164: string;
  organization_id: string;
  organizations: OrgJoin | OrgJoin[] | null;
};

function resolveAccountJoin(
  accounts: OrgJoin["accounts"],
): AccountJoin | null {
  if (!accounts) return null;
  return Array.isArray(accounts) ? (accounts[0] ?? null) : accounts;
}

function resolveOrgJoin(
  org: PhoneRow["organizations"],
): OrgJoin | null {
  if (!org) return null;
  return Array.isArray(org) ? (org[0] ?? null) : org;
}

function inferProvisionSource(
  account: AccountJoin | null,
  hasInvite: boolean,
): ClientProvisionSource {
  const explicit = account?.provision_source;
  if (explicit && isClientProvisionSource(explicit)) return explicit;
  if (hasInvite) return "managed";
  if (account?.signup_ip) return "self_serve";
  return "managed";
}

export async function loadAdminDemoCallLines(): Promise<AdminDemoCallLine[]> {
  const admin = createAdminClient();

  const withSource = await admin
    .from("phone_numbers")
    .select(
      `e164, organization_id,
       organizations (
         id, name, slug, niche, account_id,
         accounts ( provision_source, signup_ip )
       )`,
    )
    .eq("status", "assigned")
    .not("organization_id", "is", null);

  let rows = withSource.data as PhoneRow[] | null;
  if (withSource.error) {
    if (
      !withSource.error.message.includes("provision_source") &&
      !withSource.error.message.includes("schema cache")
    ) {
      throw new Error(withSource.error.message);
    }
    const legacy = await admin
      .from("phone_numbers")
      .select(
        `e164, organization_id,
         organizations (
           id, name, slug, niche, account_id,
           accounts ( signup_ip )
         )`,
      )
      .eq("status", "assigned")
      .not("organization_id", "is", null);
    if (legacy.error) throw new Error(legacy.error.message);
    rows = legacy.data as PhoneRow[] | null;
  }

  const orgIds = [
    ...new Set(
      (rows ?? [])
        .map((row) => resolveOrgJoin(row.organizations)?.id)
        .filter(Boolean) as string[],
    ),
  ];

  const { data: invites } = await admin
    .from("admin_invites")
    .select("organization_id")
    .in(
      "organization_id",
      orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const inviteOrgIds = new Set(
    (invites ?? []).map((inv) => String(inv.organization_id)),
  );

  const lines: AdminDemoCallLine[] = [];
  for (const row of rows ?? []) {
    const org = resolveOrgJoin(row.organizations);
    if (!org?.id || !row.e164?.trim()) continue;
    const account = resolveAccountJoin(org.accounts);
    lines.push({
      orgId: org.id,
      orgName: org.name.trim() || "Unknown tenant",
      orgSlug: org.slug.trim(),
      e164: row.e164.trim(),
      niche: parseOrganizationNiche(org.niche),
      provisionSource: inferProvisionSource(account, inviteOrgIds.has(org.id)),
      workerPath: workerPathLabelForE164(row.e164),
    });
  }

  return sortDemoCallLinesByCompany(lines);
}

export async function resolveAdminDemoCallLine(
  calledNumber: string | null | undefined,
): Promise<AdminDemoCallLine | null> {
  const raw = calledNumber?.trim() ?? "";
  if (!raw) return null;
  const lines = await loadAdminDemoCallLines();
  const normalized = normalizeDemoLineE164(raw);
  return (
    lines.find((line) => line.e164 === raw || line.e164 === normalized) ?? null
  );
}

/** Match assigned pool numbers regardless of spacing/formatting. */
function normalizeDemoLineE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("353") && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+353${digits.slice(1)}`;
  }
  return value.trim();
}

export type StartAdminDemoCallInput = {
  calledNumber: string;
  staffIdentity: string;
};

export type StartAdminDemoCallResult = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  callerNumber: string;
  orgName: string;
};

function resolveLiveKitCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error(
      "LiveKit is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).",
    );
  }
  return { apiKey, apiSecret };
}

function resolveLiveKitWsUrl(): string {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) {
    throw new Error("LIVEKIT_URL is not set.");
  }
  return url;
}

function resolveAgentName(): string {
  return process.env.LIVEKIT_AGENT_NAME?.trim() || "cliste-voice-node";
}

function buildDispatchMetadata(line: AdminDemoCallLine): string {
  return JSON.stringify({
    phone_number: line.e164,
    organization_id: line.orgId,
    organization_slug: line.orgSlug,
    caller_number: ADMIN_SIM_CALLER_E164,
    source: "admin_simulator",
  });
}

function buildTextRehearsalMetadata(line: AdminDemoCallLine): string {
  return JSON.stringify({
    phone_number: line.e164,
    organization_id: line.orgId,
    organization_slug: line.orgSlug,
    caller_number: ADMIN_SIM_CALLER_E164,
    source: "text_rehearsal",
    skip_greeting: true,
  });
}

export async function startAdminTextRehearsalCall(
  input: StartAdminDemoCallInput,
): Promise<StartAdminDemoCallResult> {
  const line = await resolveAdminDemoCallLine(input.calledNumber);
  if (!line) {
    throw new Error("Invalid demo line — choose an assigned store number.");
  }

  const { apiKey, apiSecret } = resolveLiveKitCredentials();
  const host = livekitHttpHostFromEnv();
  const livekitUrl = resolveLiveKitWsUrl();
  const agentName = resolveAgentName();
  const roomName = `text-rehearsal-${randomUUID()}`;
  const metadata = buildTextRehearsalMetadata(line);

  const roomClient = new RoomServiceClient(host, apiKey, apiSecret);
  const dispatchClient = new AgentDispatchClient(host, apiKey, apiSecret);

  await roomClient.createRoom({
    name: roomName,
    metadata,
    emptyTimeout: 120,
    departureTimeout: 30,
    maxParticipants: 4,
  });

  await dispatchClient.createDispatch(roomName, agentName, { metadata });

  const identity = `text-rehearsal-${input.staffIdentity.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40)}-${randomUUID().slice(0, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: "Text rehearsal",
    ttl: "45m",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: false,
    canSubscribe: false,
    canPublishData: true,
  });

  return {
    livekitUrl,
    roomName,
    token: await token.toJwt(),
    calledNumber: line.e164,
    callerNumber: ADMIN_SIM_CALLER_E164,
    orgName: line.orgName,
  };
}

export async function startAdminDemoCall(
  input: StartAdminDemoCallInput,
): Promise<StartAdminDemoCallResult> {
  const line = await resolveAdminDemoCallLine(input.calledNumber);
  if (!line) {
    throw new Error("Invalid demo line — choose an assigned store number.");
  }

  const { apiKey, apiSecret } = resolveLiveKitCredentials();
  const host = livekitHttpHostFromEnv();
  const livekitUrl = resolveLiveKitWsUrl();
  const roomName = `admin-demo-${randomUUID()}`;
  const metadata = buildDispatchMetadata(line);

  const roomClient = new RoomServiceClient(host, apiKey, apiSecret);

  await roomClient.createRoom({
    name: roomName,
    metadata,
    emptyTimeout: 60,
    departureTimeout: 30,
    maxParticipants: 4,
  });

  const presence = await createAdminClient().from("admin_live_call_sessions").insert({
    room_name: roomName, organization_id: line.orgId, caller_number: ADMIN_SIM_CALLER_E164,
  });
  if (presence.error) console.warn("[admin-demo] session tracking will retry on connect");

  const identity = `admin-${input.staffIdentity.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40)}-${randomUUID().slice(0, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: "Admin simulator",
    ttl: "45m",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    livekitUrl,
    roomName,
    token: await token.toJwt(),
    calledNumber: line.e164,
    callerNumber: ADMIN_SIM_CALLER_E164,
    orgName: line.orgName,
  };
}

/** Dispatch Cara after the browser mic is live — avoids GPT-Live subscribing to a stale track. */
export async function dispatchAdminDemoCallAgent(input: {
  roomName: string;
  calledNumber: string;
}): Promise<void> {
  const line = await resolveAdminDemoCallLine(input.calledNumber);
  if (!line) {
    throw new Error("Invalid demo line — choose an assigned store number.");
  }

  const { apiKey, apiSecret } = resolveLiveKitCredentials();
  const host = livekitHttpHostFromEnv();
  const agentName = resolveAgentName();
  const metadata = buildDispatchMetadata(line);
  const dispatchClient = new AgentDispatchClient(host, apiKey, apiSecret);

  await dispatchClient.createDispatch(input.roomName.trim(), agentName, { metadata });
}

export type AdminDemoCallLogSummary = {
  id: string;
  createdAt: string;
  outcome: string | null;
  durationSeconds: number | null;
};

export async function findCallLogByRoomName(
  roomName: string,
): Promise<AdminDemoCallLogSummary | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("call_logs")
    .select("id, created_at, outcome, duration_seconds")
    .eq("room_name", roomName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    createdAt: data.created_at,
    outcome: data.outcome,
    durationSeconds: data.duration_seconds,
  };
}

export type AdminDemoCallPipelineIncident = {
  id: string;
  occurredAt: string;
  stage: string;
  errorMessage: string;
  modelLabel: string | null;
  retryable: boolean | null;
};

export type AdminDemoCallTranscriptQuality = {
  issues: string[];
  summary: string;
  needsReview: boolean;
};

export type AdminDemoCallSessionLog = {
  incidents: AdminDemoCallPipelineIncident[];
  callLog: AdminDemoCallLogSummary | null;
  callTestReport: {
    id: string;
    healthStatus: string;
    healthReason: string | null;
    greetingMs: number | null;
    replyP50: number | null;
    errorCount: number;
  } | null;
  transcriptQuality: AdminDemoCallTranscriptQuality | null;
};

export async function loadAdminDemoCallSessionLog(
  roomName: string,
): Promise<AdminDemoCallSessionLog> {
  const admin = createAdminClient();

  const [incidentsRes, callLog] = await Promise.all([
    admin
      .from("voice_pipeline_incidents")
      .select(
        "id, occurred_at, stage, error_message, model_label, retryable",
      )
      .eq("room_name", roomName)
      .order("occurred_at", { ascending: true })
      .limit(50),
    findCallLogByRoomName(roomName),
  ]);

  if (incidentsRes.error) {
    throw new Error(incidentsRes.error.message);
  }

  let callTestReport: AdminDemoCallSessionLog["callTestReport"] = null;
  let transcriptQuality: AdminDemoCallSessionLog["transcriptQuality"] = null;

  if (callLog?.id) {
    const [{ data: report }, { data: callLogDetail }] = await Promise.all([
      admin
        .from("call_test_reports")
        .select("id, health_status, health_reason, error_count, latency")
        .eq("call_log_id", callLog.id)
        .maybeSingle(),
      admin
        .from("call_logs")
        .select(
          "transcript, transcript_review, duration_seconds, organizations ( name )",
        )
        .eq("id", callLog.id)
        .maybeSingle(),
    ]);

    if (report) {
      const latency = (report.latency ?? {}) as {
        greetingMs?: number;
        replyP50?: number;
      };
      callTestReport = {
        id: report.id,
        healthStatus: report.health_status,
        healthReason: report.health_reason,
        greetingMs:
          typeof latency.greetingMs === "number" ? latency.greetingMs : null,
        replyP50:
          typeof latency.replyP50 === "number" ? latency.replyP50 : null,
        errorCount: report.error_count ?? 0,
      };
    }

    if (callLogDetail) {
      const org = callLogDetail.organizations as
        | { name?: string }
        | { name?: string }[]
        | null;
      const businessName = Array.isArray(org) ? org[0]?.name : org?.name;
      const qa = assessTranscriptQuality({
        transcript: callLogDetail.transcript as string | null,
        transcriptReview: callLogDetail.transcript_review as string | null,
        durationSeconds:
          (callLogDetail.duration_seconds as number | null) ??
          callLog.durationSeconds ??
          undefined,
        businessName: businessName ?? null,
      });
      if (qa.issues.length > 0 || qa.needsReview) {
        transcriptQuality = {
          issues: qa.issues,
          summary: qa.summary,
          needsReview: qa.needsReview,
        };
      }
    }
  }

  return {
    incidents: (incidentsRes.data ?? []).map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      stage: row.stage,
      errorMessage: row.error_message,
      modelLabel: row.model_label,
      retryable: row.retryable,
    })),
    callLog,
    callTestReport,
    transcriptQuality,
  };
}
