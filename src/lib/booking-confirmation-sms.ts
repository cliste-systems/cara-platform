import twilio from "twilio";

export type TwilioSmsSendOptions = {
  /** Billable org for SMS metering (optional). */
  organizationId?: string;
  purpose?: string;
  /** Caller-facing SMS: send from the org's assigned Irish DID. */
  fromE164?: string;
};

export type TwilioSmsSendResult =
  | { ok: true; fromE164: string }
  | { ok: false; message: string; retryable?: boolean; uncertain?: boolean };

function platformSmsFromE164(): string | null {
  return (
    process.env.TWILIO_SMS_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    null
  );
}

/** Twilio 21661 — voice DIDs often cannot send SMS until IE1 messaging is enabled. */
export function isTwilioSmsCapableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("21661") ||
    lower.includes("not sms-capable") ||
    lower.includes("is not a valid, sms-capable")
  );
}

/** Best-effort outbound SMS (Action Inbox alerts, link delivery, etc.). */
export async function sendTwilioBookingSms(
  to: string,
  body: string,
  options?: TwilioSmsSendOptions,
): Promise<{ ok: true } | { ok: false; message: string; retryable?: boolean; uncertain?: boolean }> {
  const result = await sendTwilioBookingSmsDetailed(to, body, options);
  if (result.ok) return { ok: true };
  return { ok: false, message: result.message, retryable: result.retryable, uncertain: result.uncertain };
}

async function sendTwilioBookingSmsDetailed(
  to: string,
  body: string,
  options?: TwilioSmsSendOptions,
): Promise<TwilioSmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const platformFrom = platformSmsFromE164();
  const from = options?.fromE164?.trim() || platformFrom;
  if (!sid || !token || !from) {
    return { ok: false, message: "Twilio not configured" };
  }
  try {
    const client = twilio(sid, token);
    const message = await client.messages.create({ from, to: to.trim(), body });
    const segments = Math.max(
      1,
      Number(message.numSegments) || estimateSmsSegments(body),
    );
    if (options?.organizationId) {
      void recordSmsUsageAfterSend(
        options.organizationId,
        segments,
        options.purpose,
      );
    }
    return { ok: true, fromE164: from };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = typeof e === "object" && e && "status" in e ? Number(e.status) : 0;
    return { ok: false, message: msg, retryable: status === 429, uncertain: !status || status >= 500 };
  }
}

/**
 * Caller/customer SMS — prefer the org's assigned DID, fall back to the platform
 * sender when that line is voice-only on Twilio.
 */
export async function sendCallerFacingSms(
  to: string,
  body: string,
  options: {
    organizationId: string;
    purpose: string;
    fromE164: string | null;
  },
): Promise<TwilioSmsSendResult> {
  const preferredFrom = options.fromE164?.trim() || null;
  const platformFrom = platformSmsFromE164();

  if (preferredFrom) {
    const primary = await sendTwilioBookingSmsDetailed(to, body, {
      organizationId: options.organizationId,
      purpose: options.purpose,
      fromE164: preferredFrom,
    });
    if (primary.ok) return primary;
    if (
      !isTwilioSmsCapableError(primary.message) ||
      !platformFrom ||
      platformFrom === preferredFrom
    ) {
      return primary;
    }
    console.warn("[sms] caller_facing_fallback_sender", {
      organizationId: options.organizationId,
      preferredFrom,
      platformFrom,
      reason: primary.message,
    });
  }

  if (!platformFrom) {
    return { ok: false, message: "Twilio not configured" };
  }

  return sendTwilioBookingSmsDetailed(to, body, {
    organizationId: options.organizationId,
    purpose: options.purpose,
    fromE164: platformFrom,
  });
}

function estimateSmsSegments(body: string): number {
  const len = body.length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

async function recordSmsUsageAfterSend(
  organizationId: string,
  segments: number,
  purpose?: string,
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const { recordSmsUsage } = await import("@/lib/sms-usage");
    const admin = createAdminClient();
    await recordSmsUsage(admin, organizationId, { segments, purpose });
  } catch (err) {
    console.error(
      "[sms] usage record failed",
      organizationId,
      err instanceof Error ? err.message : err,
    );
  }
}
