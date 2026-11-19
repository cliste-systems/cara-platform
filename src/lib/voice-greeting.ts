/** Shared caller greeting — onboarding + Cara Setup use the same compliant template. */

export const VOICE_ASSISTANT_DEFAULT_NAME = "Cara";

export const DEFAULT_GREETING_CLOSING = "How can I help you today?";

export function assistantNameLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed || VOICE_ASSISTANT_DEFAULT_NAME;
}

export function businessNameLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed || "[Business name]";
}

export function defaultVoiceGreetingIntro(businessName: string): string {
  return `You're through to ${businessNameLabel(businessName)}.`;
}

/** Fixed GDPR / AI Act disclosure — callers always hear this; platform staff can edit the template. */
export function voiceLegalDisclosure(
  assistantDisplayName: string,
  template?: string,
): string {
  const assistant = assistantNameLabel(assistantDisplayName);
  const trimmedTemplate = template?.trim();
  if (trimmedTemplate) {
    return trimmedTemplate.replaceAll("{assistant}", assistant);
  }
  return `I'm ${assistant}, the AI assistant. This call may be recorded and transcribed.`;
}

/** Short UI copy explaining why the disclosure is locked. */
export const VOICE_LEGAL_NOTICE_HINT =
  "Fixed by law — under GDPR and the EU AI Act, callers must be told they're speaking to AI and that calls may be recorded and transcribed.";

export function buildFullVoiceGreeting(
  introLine: string,
  assistantDisplayName: string,
  closingLine?: string,
  legalDisclosureTemplate?: string,
): string {
  const intro = introLine.trim();
  const closing = closingLine?.trim() || DEFAULT_GREETING_CLOSING;
  return `${intro} ${voiceLegalDisclosure(assistantDisplayName, legalDisclosureTemplate)} ${closing}`;
}

/** Compliant default using the business name in the intro. */
export function buildDefaultVoiceGreeting(
  businessName: string,
  assistantDisplayName: string,
  closingLine?: string,
): string {
  return buildFullVoiceGreeting(
    defaultVoiceGreetingIntro(businessName),
    assistantDisplayName,
    closingLine,
  );
}

export function parseGreetingParts(
  storedGreeting: string,
  assistantDisplayName: string,
  defaultIntro: string,
  legalDisclosureTemplate?: string,
): { intro: string; closing: string } {
  const trimmed = storedGreeting.trim();
  const legal = voiceLegalDisclosure(assistantDisplayName, legalDisclosureTemplate);

  if (!trimmed) {
    return {
      intro: defaultIntro,
      closing: DEFAULT_GREETING_CLOSING,
    };
  }

  const legalIndex = trimmed.indexOf(legal);
  if (legalIndex >= 0) {
    const intro = trimmed.slice(0, legalIndex).trim();
    const closing = trimmed.slice(legalIndex + legal.length).trim();
    return {
      intro: intro || defaultIntro,
      closing: closing || DEFAULT_GREETING_CLOSING,
    };
  }

  return { intro: defaultIntro, closing: DEFAULT_GREETING_CLOSING };
}

export function resolveVoiceGreetingPreview(
  introLine: string,
  assistantDisplayName: string,
  greetingClosing: string,
): string {
  return buildFullVoiceGreeting(
    introLine,
    assistantDisplayName,
    greetingClosing.trim() || DEFAULT_GREETING_CLOSING,
  );
}
