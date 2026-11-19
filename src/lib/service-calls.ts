import { normalizeCallOutcome, type CallOutcome } from "./call-history-types";

/** Service calls deliberately have no retail department or ticket fields. */
export type ServiceCall = {
  id: string;
  room_name?: string | null;
  knowledge_question?: string | null;
  knowledge_needs_input?: boolean;
  caller_number: string;
  caller_name: string | null;
  created_at: string;
  duration_seconds: number;
  outcome: string;
  ai_summary: string | null;
  call_resolution: string | null;
  post_call_status: string | null;
  audio_storage_path: string | null;
  caller_data_erased_at: string | null;
  caller_data_erased_by_label: string | null;
  caller_data_erased_reason: string | null;
  follow_up_completed_at: string | null;
  follow_up_completed_by_label?: string | null;
  is_urgent: boolean;
  post_call_expected_ticket: boolean;
};

export const SERVICE_CALL_COLUMNS = "id,room_name,caller_number,caller_name,created_at,duration_seconds,outcome,ai_summary,call_resolution,post_call_status,audio_storage_path,caller_data_erased_at,caller_data_erased_by_label,caller_data_erased_reason,follow_up_completed_at,follow_up_completed_by_label,is_urgent,post_call_expected_ticket";
export const SERVICE_CALL_PAGE_SIZE = 12;
export const SERVICE_CALL_OUTCOMES: { value: CallOutcome | "marked_complete" | "knowledge_question"; label: string }[] = [
  { value: "answered", label: "Answered" },
  { value: "marked_complete", label: "Marked as complete" },
  { value: "knowledge_question", label: "Knowledge question" },
  { value: "link_sent", label: "Information sent" },
  { value: "action_created", label: "Enquiry captured" },
  { value: "callback_requested", label: "Callback requested" },
  { value: "failed", label: "Failed" },
  { value: "voicemail_or_no_speech", label: "No speech" },
  { value: "spam_or_abuse", label: "Spam or abuse" },
  { value: "blocked", label: "Blocked" },
];

export function isServiceFollowUp(call: ServiceCall): boolean {
  return !call.caller_data_erased_at && call.post_call_status !== "pending" &&
    (call.call_resolution === "needs_follow_up" || ["action_created", "callback_requested"].includes(call.outcome) || call.is_urgent || call.post_call_expected_ticket || Boolean(call.knowledge_needs_input));
}

export function serviceCallStatus(call: ServiceCall): string {
  if (call.caller_data_erased_at) return "Data erased";
  if (call.post_call_status === "pending") return "Processing";
  if (call.follow_up_completed_at) return "Completed";
  if (isServiceFollowUp(call)) {
    if (call.knowledge_question) return "Needs your answer";
    return call.is_urgent ? "Urgent follow-up" : "Follow-up needed";
  }
  if (["failed", "partial"].includes(call.post_call_status ?? "") || call.call_resolution === "incomplete") return "Needs review";
  const outcome = normalizeCallOutcome(call.outcome);
  if (outcome === "blocked") return "Blocked";
  if (outcome === "voicemail_or_no_speech") return "No speech";
  if (outcome === "spam_or_abuse") return "Spam or abuse";
  if (outcome === "failed") return "Failed";
  return "Answered";
}

/** A compact call purpose, rather than repeating a full generated summary. */
export function serviceCallPurpose(call: ServiceCall): string {
  if (call.caller_data_erased_at || call.post_call_status === "pending") return serviceCallStatus(call);
  if (call.knowledge_question && (isServiceFollowUp(call) || call.follow_up_completed_at)) return `Cara’s knowledge: ${call.knowledge_question.trim()}`;
  if (isServiceFollowUp(call) || call.follow_up_completed_at) {
    const topic = (call.ai_summary ?? "").split(/[·\n]/)[0].trim()
      .replace(/^(?:requested|asked for|wants?)\s+(?:a\s+)?(?:call\s?back|follow[ -]?up)(?:\s+(?:about|regarding|for|on))?\s*/i, "")
      .replace(/\s+(?:call\s?back|follow[ -]?up)$/i, "")
      .replace(/[.!?]+$/, "").trim();
    return topic ? `Callback about ${topic.charAt(0).toLowerCase()}${topic.slice(1)}` : "Callback requested";
  }
  return call.outcome === "link_sent" ? "Information sent" : serviceCallStatus(call);
}
export function serviceCallTone(call: ServiceCall): "complete" | "knowledge" | "follow-up" | "neutral" {
  if (call.caller_data_erased_at || call.post_call_status === "pending") return "neutral";
  if (call.follow_up_completed_at) return "complete";
  if (call.knowledge_question && isServiceFollowUp(call)) return "knowledge";
  return isServiceFollowUp(call) ? "follow-up" : "neutral";
}

/** Complete, short labels for the call list; the detail panel retains the full topic. */
export function serviceCallRowPurpose(call: ServiceCall): string {
  const purpose = serviceCallPurpose(call);
  if (purpose.startsWith("Cara’s knowledge:")) return "Knowledge question";
  if (!purpose.startsWith("Callback about ")) return purpose;
  const topic = purpose.slice("Callback about ".length);
  const topics: [RegExp, string][] = [
    [/service availability/i, "Availability"],
    [/boiler service/i, "Boiler service"],
    [/annual plan/i, "Annual plan"],
    [/appointment/i, "Appointment"],
    [/quote|pricing/i, "Pricing"],
    [/business hours|opening hours/i, "Opening hours"],
  ];
  const match = topics.find(([pattern]) => pattern.test(topic));
  if (match) return `Callback: ${match[1]}`;
  return topic.length <= 22 && topic.split(/\s+/).length <= 3
    ? `Callback: ${topic}` : "Callback requested";
}

/** Quote PostgREST values, including punctuation, so input cannot add filters. */
export function serviceCallSearchFilter(raw: string): string | null {
  const value = raw.trim().slice(0, 120);
  if (!value) return null;
  const literal = value.replace(/[\\%_*]/g, " ").trim();
  if (!literal) return null;
  const quoted = JSON.stringify(`*${literal}*`);
  const filters = [`caller_name.ilike.${quoted}`, `caller_number.ilike.${quoted}`];
  if (/^[+\d\s().-]+$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 4) filters.push(`caller_number.ilike.${JSON.stringify(`*${digits.replace(/^0/, "")}*`)}`);
  }
  return filters.join(",");
}

export function serviceCallsHref(current: URLSearchParams, changes: Record<string, string | null>): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  return `/dashboard/calls${params.size ? `?${params}` : ""}`;
}
