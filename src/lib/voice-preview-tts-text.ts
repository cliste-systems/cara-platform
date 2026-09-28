/**
 * Minimal TTS prep for dashboard voice previews — mirrors cara-voice-platform
 * pronunciation rules so the preview matches live calls.
 */
const PRONUNCIATION_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\bHello Cara\b/gi, "Hello Car-ah"],
  [/\bCara\b/g, "Car-ah"],
  [/\bKavanaghs\b/gi, "Kav-an-aghs"],
  [/\bDonegal Town\b/gi, "Doneygall Town"],
  [/\bDonegal\b/gi, "Doneygall"],
  [/\bReal Rewards\b/gi, "Real Re-wards"],
  [/\bsupervalu\.ie\/rewards\b/gi, "SuperValu dot ie slash rewards"],
  [/\bsupervalu\.ie\b/gi, "SuperValu dot ie"],
];

export function prepareVoicePreviewTtsText(text: string): string {
  let out = text.trim();
  for (const [pattern, replacement] of PRONUNCIATION_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
