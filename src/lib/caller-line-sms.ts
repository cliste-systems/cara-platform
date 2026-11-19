import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";

/** Mirrors voice-agent caller line rules — Irish landlines cannot receive SMS. */
const IRISH_MOBILE_PREFIXES = new Set(["83", "85", "86", "87", "89"]);

export type CallerSmsEligibility =
  | { canText: true; e164: string }
  | { canText: false; reason: string };

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeCallerE164(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (
    lower === "unknown" ||
    lower === "anonymous" ||
    lower === "restricted" ||
    lower === "private" ||
    lower === "unavailable" ||
    lower.includes("blocked")
  ) {
    return "";
  }

  const candidate = trimmed.replace(/^sip[:_]/i, "");
  if (candidate.startsWith("+")) {
    return /^\+[1-9]\d{6,14}$/.test(candidate) ? candidate : "";
  }

  const normalized = normalizeCustomerPhoneE164(candidate);
  if (normalized.startsWith("+") && /^\+[1-9]\d{6,14}$/.test(normalized)) {
    return normalized;
  }

  const digits = digitsOnly(candidate);
  if (digits.startsWith("353") && digits.length >= 11) {
    const e164 = `+${digits}`;
    return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : "";
  }
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    const e164 = `+353${digits.slice(1)}`;
    return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : "";
  }
  if (digits.length >= 10) {
    const e164 = `+${digits}`;
    return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : "";
  }

  return "";
}

function classifyIrishLocal(local: string): "mobile" | "landline" {
  if (local.length === 9 && local.startsWith("8")) {
    const prefix = local.slice(0, 2);
    if (IRISH_MOBILE_PREFIXES.has(prefix)) {
      return "mobile";
    }
  }
  return "landline";
}

function classifyUkE164(e164: string): "mobile" | "landline" {
  const local = e164.slice(3);
  return local.startsWith("7") ? "mobile" : "landline";
}

/** Whether staff can text this caller number from the dashboard. */
export function callerSmsEligibility(
  raw: string | null | undefined,
): CallerSmsEligibility {
  const e164 = normalizeCallerE164(raw);
  if (!e164) {
    return {
      canText: false,
      reason:
        "You can't text this number — we don't have a mobile number for this caller.",
    };
  }

  if (e164.startsWith("+353")) {
    const kind = classifyIrishLocal(e164.slice(4));
    if (kind === "mobile") {
      return { canText: true, e164 };
    }
    return {
      canText: false,
      reason:
        "You can't text this number — landlines can't receive texts. Try calling instead.",
    };
  }

  if (e164.startsWith("+44")) {
    const kind = classifyUkE164(e164);
    if (kind === "mobile") {
      return { canText: true, e164 };
    }
    return {
      canText: false,
      reason:
        "You can't text this number — it looks like a UK landline. Try calling instead.",
    };
  }

  // Other international — allow; Twilio validates on send.
  return { canText: true, e164 };
}
