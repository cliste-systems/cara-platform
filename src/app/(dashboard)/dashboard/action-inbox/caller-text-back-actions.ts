"use server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import {
  isTwilioSmsCapableError,
  sendCallerFacingSms,
} from "@/lib/booking-confirmation-sms";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { resolveOrgAssignedPhoneE164 } from "@/lib/org-assigned-phone";
import { getCallerSmsQuotaStatus } from "@/lib/sms-quota";
import {
  finalizeCallerTextBackMiddle,
  heuristicSanitizeCallerTextBackMiddle,
  parseCallerTextBackReviewJson,
} from "@/lib/caller-text-back-sanitize";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { callerSmsEligibility } from "@/lib/caller-line-sms";
import { smsDestinationAllowed } from "@/lib/voice-sms-destination-guard";
import { createAdminClient } from "@/utils/supabase/admin";

const MAX_MIDDLE_LENGTH = 800;
const MAX_SMS_BODY_LENGTH = 1600;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReviewCallerTextBackResult =
  | {
      ok: true;
      original: string;
      suggested: string;
      usedAi: boolean;
    }
  | { ok: false; message: string };

export type SendCallerTextBackResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendCallerTextBackMessage(input: {
  ticketId: string;
  message: string;
}): Promise<SendCallerTextBackResult> {
  const ticketId = input.ticketId.trim();
  const message = input.message.trim();
  if (!UUID_RE.test(ticketId)) {
    return { ok: false, message: "Invalid request." };
  }
  if (!message) {
    return { ok: false, message: "Message is empty." };
  }
  if (message.length > MAX_SMS_BODY_LENGTH) {
    return { ok: false, message: "Message is too long to send as a text." };
  }

  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: ticket, error: ticketErr } = await supabase
    .from("action_tickets")
    .select("id, caller_number, status")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (ticketErr || !ticket) {
    return { ok: false, message: "Could not find that request." };
  }

  const toE164 =
    normalizeCustomerPhoneE164(String(ticket.caller_number ?? "")) ||
    String(ticket.caller_number ?? "").trim();
  if (!toE164) {
    return { ok: false, message: "No valid phone number for this caller." };
  }

  const smsEligibility = callerSmsEligibility(toE164);
  if (!smsEligibility.canText) {
    return { ok: false, message: smsEligibility.reason };
  }

  if (!smsDestinationAllowed(toE164)) {
    return {
      ok: false,
      message: "This phone number cannot be texted from your account.",
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, message: "Text sending is not configured yet." };
  }

  const { data: orgRow } = await admin
    .from("organizations")
    .select("is_active")
    .eq("id", organizationId)
    .maybeSingle();
  if (!orgRow?.is_active) {
    return { ok: false, message: "Your account cannot send texts right now." };
  }

  const quota = await getCallerSmsQuotaStatus(admin, organizationId);
  if (!quota.allowed) {
    if (quota.includedSms <= 0) {
      return {
        ok: false,
        message: "Your plan does not include customer texts yet.",
      };
    }
    return {
      ok: false,
      message: `Monthly customer text allowance used (${quota.usedSegments}/${quota.includedSms}). Open Usage to review or contact support.`,
    };
  }

  const fromE164 = await resolveOrgAssignedPhoneE164(admin, organizationId);
  if (!fromE164) {
    return {
      ok: false,
      message: "Your store number is not set up for texting yet.",
    };
  }

  const result = await sendCallerFacingSms(toE164, message, {
    organizationId,
    purpose: "staff_text_back",
    fromE164,
  });

  if (!result.ok) {
    const lower = result.message.toLowerCase();
    if (
      lower.includes("21614") ||
      lower.includes("landline") ||
      lower.includes("cannot be a landline")
    ) {
      return {
        ok: false,
        message: "That number looks like a landline. Try calling instead.",
      };
    }
    if (lower.includes("twilio not configured")) {
      return { ok: false, message: "Text sending is not configured yet." };
    }
    if (isTwilioSmsCapableError(result.message)) {
      return {
        ok: false,
        message:
          "Your store line cannot send texts yet. Ask Hello Cara to enable SMS on your number.",
      };
    }
    console.error("[caller-text-back] send_failed", result.message);
    return {
      ok: false,
      message: "Could not send the text. Try again in a moment.",
    };
  }

  return { ok: true };
}

export async function reviewCallerTextBackMessage(
  draft: string,
): Promise<ReviewCallerTextBackResult> {
  const original = draft.trim();
  if (!original) {
    return { ok: false, message: "Add a message before review." };
  }
  if (original.length > MAX_MIDDLE_LENGTH) {
    return { ok: false, message: "Message is too long for a text." };
  }

  await requireDashboardAdmin();

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 256,
      messages: [
        {
          role: "system",
          content: [
            "You polish short SMS replies for shop staff texting customers.",
            "Fix spelling and grammar in Irish/British English.",
            "Keep the same meaning, facts, and friendly tone.",
            "Do not add a greeting or sign-off.",
            "Never use em dashes or en dashes. Use commas, full stops, or hyphens instead.",
            "Return ONLY valid JSON: {\"message\":\"...\"}",
          ].join(" "),
        },
        {
          role: "user",
          content: original,
        },
      ],
    });

    const parsed = parseCallerTextBackReviewJson(raw);
    const suggested = finalizeCallerTextBackMiddle(parsed ?? original);
    return {
      ok: true,
      original,
      suggested,
      usedAi: true,
    };
  } catch (error) {
    console.warn("[caller-text-back] review_failed", error);
    return {
      ok: true,
      original,
      suggested: heuristicSanitizeCallerTextBackMiddle(original),
      usedAi: false,
    };
  }
}
