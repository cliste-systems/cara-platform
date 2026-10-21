/**
 * Stable v1 call-outcome set. Canonical value on `call_logs.outcome`.
 */

import { stripToolLinesFromTranscript } from "@/lib/transcript-display";

export type CallOutcome =
  | "answered"
  | "link_sent"
  | "callback_requested"
  | "action_created"
  | "transferred"
  | "failed"
  | "voicemail_or_no_speech"
  | "spam_or_abuse"
  | "blocked";

export type CallHistoryRow = {
  id: string;
  dateTimeLabel: string;
  callerId: string;
  callerDisplay: string;
  durationLabel: string;
  outcome: CallOutcome;
  intentLabel: string;
  transcriptVerbatim: string;
  transcriptReview: string | null;
  aiSummary: string | null;
  hasLinkedAction?: boolean;
};

/** Universal outcome labels (visible in UI). */
export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  answered: "Answered",
  link_sent: "Info sent",
  callback_requested: "Callback requested",
  action_created: "Enquiry captured",
  transferred: "Transferred",
  failed: "Failed",
  voicemail_or_no_speech: "No speech",
  spam_or_abuse: "Spam or abuse",
  blocked: "Blocked",
};

/** Fallback intent when summary text does not match a pattern. */
export const INTENT_FALLBACK_BY_OUTCOME: Record<CallOutcome, string> = {
  answered: "General enquiry",
  link_sent: "Information request",
  callback_requested: "Callback request",
  action_created: "Follow-up",
  transferred: "Transfer request",
  failed: "Unknown",
  voicemail_or_no_speech: "Unknown",
  spam_or_abuse: "Unknown",
  blocked: "Unknown",
};

/**
 * Infer caller intent from summary + outcome (lightweight; no extra DB fields).
 */
export function inferCallIntent(
  summary: string | null | undefined,
  outcome: CallOutcome,
): string {
  const s = String(summary ?? "").toLowerCase();
  if (/\b(urgent|emergency|asap|burst|leak|flooding)\b/.test(s)) {
    return "Urgent issue";
  }
  if (/\b(complaint|unhappy|refund|disappointed|upset)\b/.test(s)) {
    return "Complaint";
  }
  if (/(call ?back|callback|ring (me|them) back|call me back)/.test(s)) {
    return "Callback request";
  }
  if (/\b(quote|estimate|pricing|price|cost|how much)\b/.test(s)) {
    return "Quote request";
  }
  if (/\b(sales|fleet|enquir|inquir|new customer|interested in)\b/.test(s)) {
    return "Sales enquiry";
  }
  if (/(hours|open|close|parking|location|address|directions|where are you)/.test(s)) {
    return "Information request";
  }
  if (/(confirm|confirmation|verify|double.?check)/.test(s)) {
    return "Information request";
  }
  if (outcome === "link_sent") return "Information request";
  if (outcome === "callback_requested") return "Callback request";
  if (outcome === "action_created") return "Follow-up";
  if (outcome === "transferred") return "Transfer request";
  return INTENT_FALLBACK_BY_OUTCOME[outcome];
}

export function normalizeCallOutcome(raw: string): CallOutcome {
  const hay = String(raw ?? "").toLowerCase();
  const s = hay.trim().replace(/\s+/g, "_");
  if (!hay.trim()) return "answered";

  if (s === "answered") return "answered";
  if (s === "link_sent" || s === "linksent") return "link_sent";
  if (s === "callback_requested") return "callback_requested";
  if (s === "action_created") return "action_created";
  if (s === "transferred" || s === "transfer") return "transferred";
  if (["failed", "stt_failure", "tts_failure", "speech_failure", "connection_failed", "dispatch_failed"].includes(s)) return "failed";
  if (s === "voicemail_or_no_speech") return "voicemail_or_no_speech";
  if (s === "spam_or_abuse") return "spam_or_abuse";
  if (s === "blocked" || s === "caller_blocked") return "blocked";

  if (hay.includes("blocklist") || hay.includes("caller_blocked")) {
    return "blocked";
  }
  if (hay.includes("spam") || hay.includes("abuse") || hay.includes("robocall")) {
    return "spam_or_abuse";
  }
  if (
    hay.includes("voicemail") ||
    hay.includes("no_speech") ||
    hay.includes("no speech") ||
    hay.includes("no_answer") ||
    hay.includes("no answer") ||
    hay.includes("silent") ||
    hay.includes("silence")
  ) {
    return "voicemail_or_no_speech";
  }
  if (hay.includes("transfer") || hay.includes("forwarded")) return "transferred";
  if (hay.includes("link") && hay.includes("sent")) return "link_sent";
  if (hay.includes("callback") || (hay.includes("call") && hay.includes("back"))) {
    return "callback_requested";
  }
  if (
    hay.includes("hung") ||
    hay.includes("disconnect") ||
    hay.includes("dropped") ||
    hay.includes("failed") ||
    hay.includes("cut off") ||
    hay.includes("cutoff")
  ) {
    return "failed";
  }
  if (
    hay.includes("message") ||
    hay.includes("action") ||
    hay.includes("ticket") ||
    hay.includes("follow")
  ) {
    return "action_created";
  }

  return "answered";
}

export function formatE164ForDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 10) return t;

  if (digits.startsWith("353") && digits.length === 12) {
    const r = digits.slice(3);
    return `+353 ${r.slice(0, 2)} ${r.slice(2, 5)} ${r.slice(5)}`;
  }

  if (digits.startsWith("1") && digits.length === 11) {
    const r = digits.slice(1);
    return `+1 (${r.slice(0, 3)}) ${r.slice(3, 6)}-${r.slice(6)}`;
  }

  const chunks: string[] = [];
  let rest = digits;
  const ccLen = rest.length > 11 ? 3 : rest.length > 10 ? 2 : 1;
  chunks.push(rest.slice(0, ccLen));
  rest = rest.slice(ccLen);
  while (rest.length) {
    const take = rest.length > 4 ? 3 : rest.length;
    chunks.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  return `+${chunks.join(" ")}`;
}

export function formatDurationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function formatCallDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function mapCallLogToRow(log: {
  id: string;
  caller_number: string;
  duration_seconds: number;
  outcome: string;
  transcript: string | null;
  transcript_review: string | null;
  ai_summary: string | null;
  created_at: string;
}): CallHistoryRow {
  const callerId = log.caller_number.trim();
  const verbatimRaw = log.transcript?.trim() || "";
  const verbatim = stripToolLinesFromTranscript(verbatimRaw);
  const outcome = normalizeCallOutcome(log.outcome);
  const summary = log.ai_summary?.trim() ?? null;
  return {
    id: log.id,
    dateTimeLabel: formatCallDateTimeLabel(log.created_at),
    callerId,
    callerDisplay: formatE164ForDisplay(callerId),
    durationLabel: formatDurationLabel(log.duration_seconds),
    outcome,
    intentLabel: inferCallIntent(summary, outcome),
    transcriptVerbatim: verbatim || "No transcript on file.",
    transcriptReview: stripToolLinesFromTranscript(log.transcript_review?.trim()) || null,
    aiSummary: summary,
  };
}
