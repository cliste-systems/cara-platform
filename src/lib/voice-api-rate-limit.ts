import { createAdminClient } from "@/utils/supabase/admin";

import { actorRateLimitFingerprint } from "./rate-limit-identifiers";
import { isSignupOnboardingDevRelaxed } from "@/lib/onboarding-dev";

export type VoiceApiRateLimitScope = "voice_preview" | "greeting_review";

const CONFIG: Record<
  VoiceApiRateLimitScope,
  { windowMs: number; maxRequests: number }
> = {
  voice_preview: {
    windowMs: 60_000,
    maxRequests: 20,
  },
  greeting_review: {
    windowMs: 60_000,
    maxRequests: 5,
  },
};

export type VoiceApiRateLimitStatus = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/** Reserve one paid request atomically before making any provider call. */
export async function reserveVoiceApiRequest(
  scope: VoiceApiRateLimitScope,
  fingerprint: string,
): Promise<VoiceApiRateLimitStatus> {
  if (isSignupOnboardingDevRelaxed()) return { allowed: true, retryAfterSeconds: 0 };
  const cfg = CONFIG[scope];
  const unavailable = { allowed: false, retryAfterSeconds: Math.ceil(cfg.windowMs / 1000) };
  try {
    const { data, error } = await createAdminClient().rpc("auth_rate_limit_record_failure", {
      p_scope: scope,
      p_fingerprint: fingerprint,
      p_window_seconds: cfg.windowMs / 1000,
      // The first maxRequests calls are admitted. The following call starts the
      // lock; already-locked attempts retain that count and are always denied.
      p_max_failures: cfg.maxRequests + 1,
      p_lock_seconds: cfg.windowMs / 1000,
      p_captcha_after: cfg.maxRequests + 1,
    });
    const row = Array.isArray(data) ? data[0] : undefined;
    if (error || !row || !Number.isInteger(row.failure_count) || row.failure_count < 1 ||
        !Number.isInteger(row.retry_after_seconds) || row.retry_after_seconds < 0) {
      console.warn("[voice-api-rate-limit] reservation unavailable", { scope, code: error?.code });
      return unavailable;
    }
    const allowed = row.failure_count <= cfg.maxRequests && row.retry_after_seconds === 0;
    return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, row.retry_after_seconds) };
  } catch {
    console.warn("[voice-api-rate-limit] reservation unavailable", { scope });
    return unavailable;
  }
}

/** The caller supplies a user/org identifier from its verified session. */
export function voiceApiFingerprint(actorKey: string): string {
  return actorRateLimitFingerprint(actorKey);
}

export function voiceApiRateLimitMessage(retryAfterSeconds: number): string {
  return `Too many requests. Try again in ${retryAfterSeconds} seconds.`;
}
