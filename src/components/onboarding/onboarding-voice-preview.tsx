import { MAX_GREETING_SCRIPT_LENGTH } from "@/lib/voice-greeting-security";

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

export function stopVoicePreview() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export async function speakVoicePreview(
  line: string,
  parts?: { greetingIntro: string; greetingClosing: string },
  options?: { onEnded?: () => void; onTimeUpdate?: (seconds: number) => void },
): Promise<
  | { ok: true }
  | {
      ok: false;
      message: string;
      introIssue?: boolean;
      closingIssue?: boolean;
    }
> {
  stopVoicePreview();

  const text = line.trim();
  if (!text) {
    return { ok: false, message: "Nothing to preview yet." };
  }
  if (text.length > MAX_GREETING_SCRIPT_LENGTH) {
    return { ok: false, message: "Preview text is too long." };
  }

  try {
    const response = await fetch("/api/onboarding/voice-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ...(parts
          ? {
              greetingIntro: parts.greetingIntro,
              greetingClosing: parts.greetingClosing,
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; introIssue?: boolean; closingIssue?: boolean }
        | null;
      return {
        ok: false,
        message: payload?.error ?? "Voice preview failed.",
        introIssue: payload?.introIssue,
        closingIssue: payload?.closingIssue,
      };
    }

    const blob = await response.blob();
    activeObjectUrl = URL.createObjectURL(blob);
    activeAudio = new Audio(activeObjectUrl);
    activeAudio.ontimeupdate = () => options?.onTimeUpdate?.(activeAudio?.currentTime ?? 0);
    activeAudio.onended = () => {
      stopVoicePreview();
      options?.onEnded?.();
    };
    await activeAudio.play();
    return { ok: true };
  } catch {
    return { ok: false, message: "Voice preview failed." };
  }
}
