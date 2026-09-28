import { NextResponse } from "next/server";
import { deliverVoiceEmail } from "@/lib/voice-email-delivery";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { isResendConfigured, sendTransactionalEmail } from "@/lib/resend-mail";
import {
  authorizeVoiceWebhook,
  voiceWebhookNoSecretResponse,
  voiceWebhookUnauthorizedResponse,
} from "@/lib/voice-webhook-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_EMAIL_BODY_LENGTH = 8000;

type SendCallerEmailBody = {
  called_number?: string;
  call_session_id?: string;
  to: string;
  subject: string;
  body: string;
  /** Required in production — Cara must ask on the call before emailing. */
  caller_consented?: boolean;
};

function requireCallerConsent(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Voice worker: email a caller-facing message (e.g. directions / maps link).
 */
export async function POST(request: Request) {
  const auth = await authorizeVoiceWebhook(request);
  if (auth === "no_secret") return voiceWebhookNoSecretResponse();
  if (auth === "bad") return voiceWebhookUnauthorizedResponse();

  if (!isResendConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Email is not configured on this server" },
      { status: 503 },
    );
  }

  let body: SendCallerEmailBody;
  try {
    body = (await request.json()) as SendCallerEmailBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const callSessionId = typeof body.call_session_id === "string" ? body.call_session_id.trim() : "";
  if (!callSessionId || callSessionId.length > 256 || /[\x00-\x1f\x7f]/.test(callSessionId)) {
    return NextResponse.json({ ok: false, code: "invalid_call_session", error: "An active call session is required" }, { status: 400 });
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  if (!calledNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "called_number is required" },
      { status: 400 },
    );
  }

  const to = String(body.to ?? "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { ok: false, error: "A valid to email is required" },
      { status: 400 },
    );
  }

  const subject = String(body.subject ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!subject || subject.length > 300 || !text || to.length > 254) {
    return NextResponse.json(
      { ok: false, error: "subject and body are required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_EMAIL_BODY_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `body exceeds ${MAX_EMAIL_BODY_LENGTH} characters`,
      },
      { status: 400 },
    );
  }
  if (requireCallerConsent() && body.caller_consented !== true) {
    return NextResponse.json(
      {
        ok: false,
        code: "caller_consent_required",
        error:
          "caller_consented must be true — Cara must ask on the call before emailing",
      },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  const calledE164 =
    normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", calledE164)
    .maybeSingle();

  if (phoneErr) {
    console.error("[voice/send-caller-email] phone lookup", phoneErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!phoneRow?.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: `called_number ${calledE164} is not assigned to any organization`,
      },
      { status: 404 },
    );
  }

  const orgId = phoneRow.organization_id as string;
  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, is_active")
    .eq("id", orgId)
    .maybeSingle();
  if (!orgRow?.is_active) {
    return NextResponse.json(
      { ok: false, code: "org_suspended", error: "Organization is not active" },
      { status: 403 },
    );
  }

  const businessName = String(orgRow?.name ?? "").trim() || "Your business";
  const delivery = await deliverVoiceEmail({
    organizationId: orgId,
    callSessionId,
    to,
    subject: subject.includes(businessName) ? subject : `${businessName}: ${subject}`,
    text,
  }, {
    claim: async (input) => {
      const { data, error } = await admin.rpc("claim_voice_email_delivery", {
        p_organization_id: input.organizationId,
        p_call_session_id: input.callSessionId,
        p_recipient_hash: input.recipientHash,
        p_content_hash: input.contentHash,
      });
      if (error) throw new Error("Email budget unavailable");
      return data;
    },
    send: sendTransactionalEmail,
    finish: async (id, leaseToken, status) => {
      const { data, error } = await admin.from("voice_email_deliveries")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id).eq("lease_token", leaseToken).select("id").maybeSingle();
      if (error || !data) throw new Error("Email completion unavailable");
    },
  });
  if (!delivery.ok) {
    return NextResponse.json({ ok: false, code: delivery.code, error: "Email could not be sent for this call" }, {
      status: delivery.status,
      headers: delivery.status === 429 ? { "Retry-After": "3600" } : {},
    });
  }
  return NextResponse.json({ ...delivery, to });
}
