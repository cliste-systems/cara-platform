import {
  CLISTE_DEFAULT_ELEVENLABS_MODEL_ID,
  CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
} from "@/lib/onboarding-voice-presets";

/** Voice settings aligned with cara-voice-platform LiveKit worker (`agent.ts` / blocklist TTS). */
export const CLISTE_ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.35,
  use_speaker_boost: true,
} as const;

/**
 * Resolve ElevenLabs voice id — same order as cara-voice-platform `resolveOrgVoiceId` +
 * worker fallback chain.
 */
export function resolveOrgElevenLabsVoiceId(
  agentVoiceId: string | null | undefined,
): string {
  const fromOrg = agentVoiceId?.trim();
  if (fromOrg) return fromOrg;

  const fromEnv = process.env.ELEVEN_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;

  return CLISTE_DEFAULT_ELEVENLABS_VOICE_ID;
}

/** TTS model — same default as cara-voice-platform (`ELEVEN_TTS_MODEL` or flash v2.5). */
export function resolveElevenLabsModelId(): string {
  return (
    process.env.ELEVEN_TTS_MODEL?.trim() || CLISTE_DEFAULT_ELEVENLABS_MODEL_ID
  );
}
