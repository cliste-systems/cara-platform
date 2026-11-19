import {
  DEFAULT_GREETING_CLOSING,
  defaultVoiceGreetingIntro,
} from "@/lib/voice-greeting";
import {detectPromptInjectionViolation} from "@/lib/prompt-injection-guard";
import { greetingPartsFormatError,sanitizeGreetingLine } from "@/lib/voice-greeting-security";

export type VoiceGreetingGuardrailResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      introIssue: boolean;
      closingIssue: boolean;
      suggestedIntro?: string;
      suggestedClosing?: string;
    };

const INAPPROPRIATE_MESSAGE =
  "Please keep the greeting professional for callers.";

function offTopicMessage(introOffTopic: boolean, closingOffTopic: boolean): string {
  if (introOffTopic && closingOffTopic) {
    return "These lines are just the greeting — Cara adds the legal notice automatically.";
  }
  if (closingOffTopic) {
    return "The legal notice is added automatically above. A short line like “How can I help you today?” works well here.";
  }
  return "Introduce your business here — e.g. “You're through to [Business] —”. The AI and recording notice is handled separately.";
}

/** Wording that belongs only in the fixed legal notice, not in editable lines. */
export const GREETING_LEGAL_OVERLAP_PATTERN =
  /\b(recorded|recording|recordings|quality and training|for quality|for training|training purposes|monitored|monitoring|transcribed|transcription|ai assistant|this call may|this call is|speaking to an? ai|speaking with an? ai|automated assistant|artificial intelligence|voice assistant|gdpr|data protection|eu ai act|consent to record)\b/i;

const HELP_INVITATION_PATTERN =
  /\b(how can i help|how may i help|what can i do|how can i assist|how may i assist)[^?]*\?/i;

const GREETING_ABUSE_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions\b/i,
  /\b(disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+instructions\b/i,
  /\b(pretend|act)\s+(you\s+are|to\s+be)\b/i,
  /\bsystem\s+prompt\b/i,
  /\bjail\s*break\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bdan\s+mode\b/i,
  /\bhttps?:\/\//i,
  /\bwww\.\w/i,
  /\b[\w.+-]+@[\w-]+\.\w{2,}\b/,
  /\b(tell me a joke|repeat after me|say the following)\b/i,
  /\b(instructions?|system|override|password|passcode|credit card|bank account|api key|execute|download|transfer money|send money|click|subscribe|discount code|services include)\b/i,
];

/** Max editable prefix allowed before a help question in the closing line. */
const MAX_CLOSING_PREFIX_BEFORE_HELP_CHARS = 40;
/** Closing without a help question should stay short. */
const MAX_CLOSING_WITHOUT_HELP_CHARS = 80;

/** Normalise text for blocklist checks (NFKC, leetspeak, spaced letters). */
function normalizeForModeration(text: string): string {
  const collapsed = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return collapsed.replace(/([a-z])\s+(?=\1)/g, "$1");
}

const INAPPROPRIATE_PATTERNS: RegExp[] = [
  /\bf+\s*u+\s*c+\s*k+(?:\s*(?:i\s*n\s*g|e\s*r\s*s?|e\s*d|s))?\b/,
  /\bf+\s*u+\s*k+\b/,
  /\bsh+\s*i+\s*t+\s*e?\b/,
  /\bsh+\s*i+\s*t+\b/,
  /\bb+\s*i+\s*t+\s*c+\s*h\b/,
  /\ba+\s*s+\s*s+\s*h+\s*o+\s*l+\s*e\b/,
  /\bc+\s*u+\s*n+\s*t\b/,
  /\bd+\s*i+\s*c+\s*k\b/,
  /\bc+\s*o+\s*c+\s*k\b/,
  /\bp+\s*i+\s*s+\s*s\b/,
  /\bw+\s*a+\s*n+\s*k+\s*e+\s*r\b/,
  /\bb+\s*o+\s*l+\s*l+\s*o+\s*c+\s*k+\s*s\b/,
  /\bfeck+\b/,
  /\bshite+\b/,
  /\bbollocks+\b/,
  /\bprick+\b/,
  /\btwat+\b/,
  /\bwhore+\b/,
  /\bslut+\b/,
  /\bn+\s*i+\s*g+\s*g(?:\s*e\s*r|\s*a)?\s*s?\b/,
  /\bf+\s*a+\s*g+\s*o+\s*t\b/,
  /\bretard+\b/,
  /\bk+\s*i+\s*l+\s*l+\s*y+\s*o+\s*u+\s*r+\s*s+\s*e+\s*l+\s*f\b/,
  /\bgo+\s*die+\b/,
  /\bse+\s*x+\s*y?\b/,
  /\bp+\s*o+\s*r+\s*n\b/,
  /\bn+\s*u+\s*d+\s*e+\b/,
];

function lineHasInappropriateContent(line: string): boolean {
  const normalized = normalizeForModeration(line);
  if (!normalized) return false;
  const compact = normalized.replace(/\s+/g, "");
  const candidates = [normalized, compact];
  return INAPPROPRIATE_PATTERNS.some((pattern) =>
    candidates.some((candidate) => pattern.test(candidate)),
  );
}

export function greetingLineIsInappropriate(line: string): boolean {
  return lineHasInappropriateContent(line);
}

export function lineHasLegalOverlap(text: string): boolean {
  return GREETING_LEGAL_OVERLAP_PATTERN.test(text);
}

function lineHasGreetingAbuseContent(line: string): boolean {
  const normalized = normalizeForModeration(line);
  if (!normalized) return false;
  if(detectPromptInjectionViolation(line)||detectPromptInjectionViolation(normalized))return true;
  const compact = normalized.replace(/\s+/g, "");
  const candidates = [line, normalized, compact];
  return GREETING_ABUSE_PATTERNS.some((pattern) =>
    candidates.some((candidate) => pattern.test(candidate)),
  );
}

function stripLeadingPunctuation(text: string): string {
  return text.replace(/^[\s.,!?;—–-]+/, "").trim();
}

function introIsOffTopic(intro: string): boolean {
  if (lineHasLegalOverlap(intro)) return true;
  if (lineHasGreetingAbuseContent(intro)) return true;
  if (HELP_INVITATION_PATTERN.test(intro)) return true;
  if (intro.split(/\s+/).length>30) return true;
  // An opening welcomes the caller; it must not become instructions or a service script.
  if (!/\b(hello|hi|hiya|hey|welcome|calling|through to|reached|good morning|good afternoon|good evening|dia dhuit|fáilte)\b/i.test(intro)) return true;
  return false;
}

function closingIsOffTopic(closing: string): boolean {
  if (lineHasLegalOverlap(closing)) return true;
  if (lineHasGreetingAbuseContent(closing)) return true;

  const helpMatch = closing.match(HELP_INVITATION_PATTERN);
  if (helpMatch && helpMatch.index != null) {
    if(closing.slice(helpMatch.index+helpMatch[0].length).trim())return true;
    const prefix = stripLeadingPunctuation(
      closing.slice(0, helpMatch.index).trim(),
    );
    if (prefix) {
      if (lineHasLegalOverlap(prefix) || lineHasGreetingAbuseContent(prefix)) {
        return true;
      }
      if (prefix.length > MAX_CLOSING_PREFIX_BEFORE_HELP_CHARS) {
        return true;
      }
    }
    return false;
  }

  return closing.length > MAX_CLOSING_WITHOUT_HELP_CHARS || !/\?\s*$/.test(closing) || !/\b(help|assist|calling|call|enquiry|enquiries|support|speak|name|do for|reason|need|looking)\b/i.test(closing);
}

export function greetingLineIsOffTopic(
  line: string,
  part: "intro" | "closing",
): boolean {
  const sanitized = sanitizeGreetingLine(line);
  if (!sanitized) return part === "intro";
  return part === "intro" ? introIsOffTopic(sanitized) : closingIsOffTopic(sanitized);
}

export function validateVoiceGreetingGuardrails(input: {
  greetingIntro: string;
  greetingClosing: string;
  businessName: string;
}): VoiceGreetingGuardrailResult {
  const formatError=greetingPartsFormatError(input.greetingIntro,input.greetingClosing);
  if(formatError)return {ok:false,message:formatError,introIssue:true,closingIssue:true};
  const intro = sanitizeGreetingLine(input.greetingIntro);
  const closing =
    sanitizeGreetingLine(input.greetingClosing) || DEFAULT_GREETING_CLOSING;

  const introInappropriate = greetingLineIsInappropriate(intro);
  const closingInappropriate = greetingLineIsInappropriate(closing);
  const introOffTopic = !introInappropriate && introIsOffTopic(intro);
  const closingOffTopic = !closingInappropriate && closingIsOffTopic(closing);

  const introIssue = introInappropriate || introOffTopic;
  const closingIssue = closingInappropriate || closingOffTopic;

  if (!introIssue && !closingIssue) {
    return { ok: true };
  }

  const message =
    introInappropriate || closingInappropriate
      ? INAPPROPRIATE_MESSAGE
      : offTopicMessage(introOffTopic, closingOffTopic);

  return {
    ok: false,
    message,
    introIssue,
    closingIssue,
    ...(introIssue
      ? { suggestedIntro: defaultVoiceGreetingIntro(input.businessName) }
      : {}),
    ...(closingIssue ? { suggestedClosing: DEFAULT_GREETING_CLOSING } : {}),
  };
}

export function sanitizeGreetingSuggestionLine(
  line: string | undefined,
  part: "intro" | "closing" = "closing",
): string | undefined {
  if (!line?.trim()) return undefined;
  const sanitized = sanitizeGreetingLine(line);
  if (
    !sanitized ||
    greetingLineIsInappropriate(sanitized) ||
    greetingLineIsOffTopic(sanitized, part)
  ) {
    return undefined;
  }
  return sanitized;
}

/** Hard safety rules shared by save and review; awkward wording is advisory. */
export function voiceGreetingSafetyIssue(intro:string,closing:string):string|null {
 const format=greetingPartsFormatError(intro,closing);if(format)return format;
 for(const line of [intro,closing]){
  const clean=sanitizeGreetingLine(line);
  if(greetingLineIsInappropriate(clean))return INAPPROPRIATE_MESSAGE;
  if(lineHasGreetingAbuseContent(clean))return 'Use a professional caller greeting without links, commands or requests for sensitive information.';
  if(lineHasLegalOverlap(clean))return 'The AI and recording notice is included automatically. Keep it out of the editable lines.';
 }
 return null;
}
