import type {
  CallCloseDiagnosticsPayload,
  CallTestDiagnosticEvent,
} from "@/lib/call-testing-types";
import { isTestCalledNumber } from "@/lib/call-testing-types";
import type { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PipelineIncidentRow = {
  id: string;
  occurred_at: string;
  stage: string;
  error_message: string;
  model_label: string | null;
  retryable: boolean | null;
  sms_fallback_sent: boolean;
};

function extractToolLines(transcript: string | null | undefined): string[] {
  const text = transcript?.trim() ?? "";
  if (!text) return [];
  return text
    .split("\n")
    .filter((line) => /^\[Tool/.test(line.trim()))
    .slice(-40);
}

function assessTranscriptCompleteness(transcript: string | null | undefined): {
  complete: boolean;
  reasons: string[];
  callerLineCount: number;
  assistantLineCount: number;
} {
  const reasons: string[] = [];
  const text = transcript?.trim() ?? "";
  if (!text) reasons.push("transcript is empty");
  const callerLineCount = (text.match(/^Caller: /gm) ?? []).length;
  const assistantLineCount = (text.match(/^Assistant: /gm) ?? []).length;
  if (text && callerLineCount === 0) reasons.push("no Caller: lines");
  if (text && assistantLineCount === 0) reasons.push("no Assistant: lines");
  return {
    complete: reasons.length === 0,
    reasons,
    callerLineCount,
    assistantLineCount,
  };
}

function buildRecommendedChecks(input: {
  events: CallTestDiagnosticEvent[];
  transcriptIssues: string[];
  pipelineIncidents: PipelineIncidentRow[];
  greetingPlayed: boolean;
}): string[] {
  const checks: string[] = [];
  const tags = new Set(input.events.map((e) => e.tag));

  if (!input.greetingPlayed) {
    checks.push("Greeting never played — check ElevenLabs key, credits, and greeting PCM cache.");
  }
  if (input.pipelineIncidents.some((i) => i.stage === "tts")) {
    checks.push("TTS incidents recorded — verify ELEVENLABS_API_KEY (sk_…) and voice ID.");
  }
  if (input.pipelineIncidents.some((i) => i.stage === "llm")) {
    checks.push("LLM incidents recorded — verify OpenAI credits and model access.");
  }
  if (tags.has("greeting_pcm_warm_failed")) {
    checks.push("Greeting PCM warm failed — ElevenLabs render/cache path broken.");
  }
  if (tags.has("pipeline_tts_error")) {
    checks.push("Live TTS errors during call — inspect Eleven websocket / synthesize errors.");
  }
  if (tags.has("pipeline_llm_error")) {
    checks.push("LLM errors during call — inspect OpenAI 429 / rate limits.");
  }
  if (input.transcriptIssues.length > 0) {
    checks.push("Review transcript issues and compare with event timeline.");
  }
  if (checks.length === 0) {
    checks.push("No automatic flags — scan full event timeline and pipeline incidents.");
  }
  return checks;
}

function synthesizeEventsFromIncidents(
  incidents: PipelineIncidentRow[],
  callStartedAtMs?: number,
): CallTestDiagnosticEvent[] {
  return incidents.map((inc) => {
    const atMs = Date.parse(inc.occurred_at);
    return {
      atMs: Number.isFinite(atMs) ? atMs : Date.now(),
      level: "error" as const,
      tag: `pipeline_incident_${inc.stage}`,
      message: inc.error_message,
      data: {
        stage: inc.stage,
        modelLabel: inc.model_label,
        retryable: inc.retryable,
        source: "voice_pipeline_incidents",
        offsetMs:
          callStartedAtMs != null && Number.isFinite(atMs)
            ? Math.max(0, atMs - callStartedAtMs)
            : undefined,
      },
    };
  });
}

export async function fetchPipelineIncidentsForCall(input: {
  admin: AdminClient;
  callSid?: string | null;
  roomName?: string | null;
  organizationId?: string | null;
  callerNumber?: string | null;
  windowStartIso?: string | null;
  windowEndIso?: string | null;
}): Promise<PipelineIncidentRow[]> {
  const callSid = input.callSid?.trim();
  const roomName = input.roomName?.trim();
  const orgId = input.organizationId?.trim();
  const callerNumber = input.callerNumber?.trim();

  if (!callSid && !roomName && !orgId) return [];

  let query = input.admin
    .from("voice_pipeline_incidents")
    .select(
      "id, occurred_at, stage, error_message, model_label, retryable, sms_fallback_sent",
    )
    .order("occurred_at", { ascending: true });

  if (callSid && roomName) {
    query = query.or(`call_sid.eq.${callSid},room_name.eq.${roomName}`);
  } else if (callSid) {
    query = query.eq("call_sid", callSid);
  } else if (roomName) {
    query = query.eq("room_name", roomName);
  } else if (orgId) {
    query = query.eq("organization_id", orgId);
    if (callerNumber) {
      query = query.eq("caller_number", callerNumber);
    }
    if (input.windowStartIso) {
      query = query.gte("occurred_at", input.windowStartIso);
    }
    if (input.windowEndIso) {
      query = query.lte("occurred_at", input.windowEndIso);
    }
  }

  const { data, error } = await query.limit(100);
  if (error) {
    console.warn("[call-testing] pipeline incidents fetch", error.message);
    return [];
  }
  return (data ?? []) as PipelineIncidentRow[];
}

export async function enrichCallTestDiagnostics(input: {
  admin: AdminClient;
  orgId: string;
  callLogId: string;
  calledNumber?: string | null;
  callerNumber?: string | null;
  callSid?: string | null;
  roomName?: string | null;
  transcript?: string | null;
  transcriptReview?: string | null;
  aiSummary?: string | null;
  costEstimate?: Record<string, unknown> | null;
  workerDiagnostics?: CallCloseDiagnosticsPayload | null;
  createdAtIso?: string | null;
  durationSeconds?: number;
}): Promise<CallCloseDiagnosticsPayload> {
  const worker = input.workerDiagnostics;
  const windowStart = input.createdAtIso
    ? new Date(
        Date.parse(input.createdAtIso) - 30_000,
      ).toISOString()
    : null;
  const windowEnd =
    input.createdAtIso && input.durationSeconds != null
      ? new Date(
          Date.parse(input.createdAtIso) +
            input.durationSeconds * 1000 +
            60_000,
        ).toISOString()
      : null;

  const pipelineIncidents = await fetchPipelineIncidentsForCall({
    admin: input.admin,
    callSid: input.callSid,
    roomName: input.roomName,
    organizationId: input.orgId,
    callerNumber: input.callerNumber,
    windowStartIso: windowStart,
    windowEndIso: windowEnd,
  });

  const callStartedAtMs = input.createdAtIso
    ? Date.parse(input.createdAtIso)
    : undefined;

  const workerEvents = worker?.events ?? [];
  const incidentEvents = synthesizeEventsFromIncidents(
    pipelineIncidents,
    callStartedAtMs,
  );
  const eventKeys = new Set(
    workerEvents.map((e) => `${e.tag}:${e.message}:${e.atMs}`),
  );
  const mergedEvents = [
    ...workerEvents,
    ...incidentEvents.filter(
      (e) => !eventKeys.has(`${e.tag}:${e.message}:${e.atMs}`),
    ),
  ].sort((a, b) => a.atMs - b.atMs);

  if (mergedEvents.length === 0 && worker?.greetingPlayed !== true) {
    const baseMs = callStartedAtMs ?? Date.now();
    mergedEvents.push(
      {
        atMs: baseMs + 500,
        level: "error",
        tag: "inferred_greeting_silent",
        message:
          "Greeting did not play. Typical causes: ElevenLabs synthesize failure or invalid API key.",
        data: { source: "server_inferred" },
      },
      {
        atMs: baseMs + 2000,
        level: "error",
        tag: "inferred_llm_or_tts_outage",
        message:
          "Check OpenAI billing (429 credit_balance_exhausted) and ELEVENLABS_API_KEY on the LiveKit agent.",
        data: { source: "server_inferred" },
      },
    );
  }

  const transcriptIssues =
    worker?.transcriptIssues ??
    analyzeTranscriptIssues(input.transcript, input.aiSummary);
  const completeness = assessTranscriptCompleteness(input.transcript);
  const toolLines = worker?.toolLines ?? extractToolLines(input.transcript);
  const greetingPlayed = worker?.greetingPlayed === true;

  const recommendedChecks =
    worker?.recommendedChecks ??
    buildRecommendedChecks({
      events: mergedEvents,
      transcriptIssues,
      pipelineIncidents,
      greetingPlayed,
    });

  let orgSnapshot = worker?.orgSnapshot;
  if (!orgSnapshot) {
    const { data: org } = await input.admin
      .from("organizations")
      .select("id, name, slug, phone_number, niche")
      .eq("id", input.orgId)
      .maybeSingle();
    if (org) {
      orgSnapshot = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        phoneNumber: org.phone_number,
        niche: org.niche,
      };
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseDeepLink =
    worker?.supabaseDeepLink ??
    (supabaseUrl && input.callLogId
      ? `${supabaseUrl.replace(/\/$/, "")}/project/default/editor/table/call_logs?filter=id%3Aeq%3A${encodeURIComponent(input.callLogId)}`
      : undefined);

  return {
    latency: worker?.latency ?? {},
    pipeline: worker?.pipeline,
    sessionFlags: worker?.sessionFlags,
    events: mergedEvents,
    greetingPlayed,
    greetingSource: worker?.greetingSource ?? null,
    disclosureConfirmed: worker?.disclosureConfirmed === true,
    deploy: worker?.deploy,
    transcriptIssues,
    identifiers: worker?.identifiers ?? {
      callSid: input.callSid ?? null,
      roomName: input.roomName ?? null,
      calledNumber: input.calledNumber ?? null,
      organizationId: input.orgId,
    },
    orgSnapshot,
    configSnapshot: worker?.configSnapshot,
    recommendedChecks,
    toolLines,
    transcriptCompleteness: worker?.transcriptCompleteness ?? completeness,
    costEstimate: worker?.costEstimate ?? input.costEstimate ?? null,
    pipelineIncidents,
    postprocessRan: worker?.postprocessRan,
    knowledgeGapCount: worker?.knowledgeGapCount,
    greetingText: worker?.greetingText,
    supabaseDeepLink,
    callLogId: input.callLogId,
    transcriptReview: input.transcriptReview ?? undefined,
    aiSummary: input.aiSummary ?? undefined,
    capturedAtMs: worker?.capturedAtMs ?? Date.now(),
    isTestCalledNumber: isTestCalledNumber(input.calledNumber),
  };
}

function analyzeTranscriptIssues(
  transcript: string | null | undefined,
  aiSummary: string | null | undefined,
): string[] {
  const issues: string[] = [];
  const text = transcript?.trim() ?? "";
  if (!text) {
    issues.push("Transcript empty — STT may have failed or flush timed out.");
    return issues;
  }
  const callerLines = text.match(/^Caller: /gm) ?? [];
  const assistantLines = text.match(/^Assistant: /gm) ?? [];
  if (callerLines.length === 0) {
    issues.push("No caller speech captured — likely silence / STT failure.");
  }
  if (assistantLines.length === 0) {
    issues.push("No assistant speech captured — TTS/LLM likely failed.");
  }
  if (/\[Tool error\]/m.test(text)) {
    issues.push("Tool errors present in transcript.");
  }
  if (!aiSummary?.trim()) {
    issues.push("AI summary missing — postprocess may have been skipped.");
  }
  return issues;
}
