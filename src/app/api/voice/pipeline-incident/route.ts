import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { captureObservedError } from "@/lib/observability";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAGES = new Set(["stt", "llm", "tts", "session", "unknown"]);
const MAX_ERROR_MESSAGE_CHARS = 500;
const MAX_MODEL_LABEL_CHARS = 120;

type IncidentBody = {
  incident_id?: string;
  organization_id?: string | null;
  called_number?: string | null;
  caller_number?: string | null;
  room_name?: string | null;
  call_sid?: string | null;
  stage?: string;
  error_message?: string;
  model_label?: string | null;
  retryable?: boolean | null;
  sms_fallback_sent?: boolean;
  occurred_at?: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function voiceSecretNotConfigured() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Voice service is temporarily unavailable.",
    },
    { status: 503 },
  );
}

async function authorize(request: Request): Promise<"ok" | "no_secret" | "bad"> {
  const secret = process.env.CLISTE_VOICE_WEBHOOK_SECRET?.trim();
  if (!secret) return "no_secret";
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cliste-voice-secret");
  const token = bearer ?? header ?? "";
  return (await timingSafeEqualUtf8(token, secret)) ? "ok" : "bad";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth === "no_secret") return voiceSecretNotConfigured();
  if (auth === "bad") return unauthorized();

  let body: IncidentBody;
  try {
    body = (await request.json()) as IncidentBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const stage = String(body.stage ?? "").trim();
  if (!STAGES.has(stage)) {
    return NextResponse.json(
      { ok: false, error: "stage must be one of stt|llm|tts|session|unknown" },
      { status: 400 },
    );
  }

  const rawMessage = String(body.error_message ?? "").trim();
  if (!rawMessage) {
    return NextResponse.json({ ok: false, error: "error_message is required" }, { status: 400 });
  }

  const incidentIdRaw =
    typeof body.incident_id === "string" ? body.incident_id.trim() : "";
  const incidentId = incidentIdRaw && UUID_RE.test(incidentIdRaw) ? incidentIdRaw : null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server configuration error" },
      { status: 503 },
    );
  }

  const claimedOrgId =
    typeof body.organization_id === "string" ? body.organization_id.trim() : "";
  const calledNumberRaw =
    typeof body.called_number === "string" ? body.called_number.trim() : "";

  let resolvedOrgId: string | null = null;
  if (claimedOrgId && UUID_RE.test(claimedOrgId)) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("id")
      .eq("id", claimedOrgId)
      .maybeSingle();
    if (orgRow?.id) resolvedOrgId = orgRow.id as string;
  }
  if (!resolvedOrgId && calledNumberRaw) {
    const calledE164 = normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
    const { data: phoneRow } = await admin
      .from("phone_numbers")
      .select("organization_id")
      .eq("e164", calledE164)
      .maybeSingle();
    if (phoneRow?.organization_id) resolvedOrgId = phoneRow.organization_id as string;
  }

  const row = {
    incident_id: incidentId,
    occurred_at: (() => {
      const raw = typeof body.occurred_at === "string" ? body.occurred_at : "";
      if (!raw) return new Date().toISOString();
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    })(),
    organization_id: resolvedOrgId,
    called_number: calledNumberRaw || null,
    caller_number:
      typeof body.caller_number === "string" ? body.caller_number.trim() || null : null,
    room_name: typeof body.room_name === "string" ? body.room_name.trim() || null : null,
    call_sid: typeof body.call_sid === "string" ? body.call_sid.trim() || null : null,
    stage,
    error_message: truncate(rawMessage, MAX_ERROR_MESSAGE_CHARS),
    model_label:
      typeof body.model_label === "string" && body.model_label.trim()
        ? truncate(body.model_label.trim(), MAX_MODEL_LABEL_CHARS)
        : null,
    retryable: typeof body.retryable === "boolean" ? body.retryable : null,
    sms_fallback_sent: body.sms_fallback_sent === true,
  };

  const write = incidentId
    ? admin.from("voice_pipeline_incidents").upsert(row, { onConflict: "incident_id" })
    : admin.from("voice_pipeline_incidents").insert(row);

  const { error } = await write;
  if (error) {
    await captureObservedError(error, { route: "voice/pipeline-incident" });
    return NextResponse.json({ ok: false, error: "Failed to record incident" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    incident_id: incidentId,
    organization_id: resolvedOrgId,
  });
}
