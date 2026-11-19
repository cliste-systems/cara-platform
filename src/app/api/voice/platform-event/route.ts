import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { captureObservedError } from "@/lib/observability";
import {
  recordPlatformEvent,
  type PlatformEventCategory,
  type PlatformEventSeverity,
} from "@/lib/platform-events";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITIES = new Set<PlatformEventSeverity>(["critical", "warning", "info"]);
const CATEGORIES = new Set<PlatformEventCategory>([
  "recording",
  "webhook",
  "product_lookup",
  "worker",
  "dashboard",
]);
const MAX_MESSAGE_CHARS = 500;

type PlatformEventBody = {
  severity?: string;
  category?: string;
  event_type?: string;
  message?: string;
  source?: string;
  organization_id?: string | null;
  call_log_id?: string | null;
  called_number?: string | null;
  metadata?: Record<string, unknown> | null;
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

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth === "no_secret") return voiceSecretNotConfigured();
  if (auth === "bad") return unauthorized();

  let body: PlatformEventBody;
  try {
    body = (await request.json()) as PlatformEventBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const severity = String(body.severity ?? "").trim() as PlatformEventSeverity;
  if (!SEVERITIES.has(severity)) {
    return NextResponse.json(
      { ok: false, error: "severity must be critical|warning|info" },
      { status: 400 },
    );
  }

  const category = String(body.category ?? "").trim() as PlatformEventCategory;
  if (!CATEGORIES.has(category)) {
    return NextResponse.json(
      {
        ok: false,
        error: "category must be recording|webhook|product_lookup|worker|dashboard",
      },
      { status: 400 },
    );
  }

  const eventType = String(body.event_type ?? "").trim();
  if (!eventType) {
    return NextResponse.json({ ok: false, error: "event_type is required" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  let organizationId =
    typeof body.organization_id === "string" && UUID_RE.test(body.organization_id.trim())
      ? body.organization_id.trim()
      : null;
  const callLogId =
    typeof body.call_log_id === "string" && UUID_RE.test(body.call_log_id.trim())
      ? body.call_log_id.trim()
      : null;

  try {
    const admin = createAdminClient();

    if (!organizationId && body.called_number?.trim()) {
      const calledE164 =
        normalizeCustomerPhoneE164(body.called_number.trim()) ||
        body.called_number.trim();
      const { data: phoneRow } = await admin
        .from("phone_numbers")
        .select("organization_id")
        .eq("e164", calledE164)
        .maybeSingle();
      organizationId = (phoneRow?.organization_id as string | undefined) ?? null;
    }

    await recordPlatformEvent(admin, {
      severity,
      category,
      eventType,
      message: message.slice(0, MAX_MESSAGE_CHARS),
      source: body.source?.trim() || "voice_worker",
      organizationId,
      callLogId,
      metadata: {
        ...(body.metadata ?? {}),
        ...(body.called_number?.trim() ? { called_number: body.called_number.trim() } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureObservedError(e, { route: "voice/platform-event" });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
