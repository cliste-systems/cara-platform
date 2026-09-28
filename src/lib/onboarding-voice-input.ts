import "server-only";

import {
  reserveVoiceApiRequest,
  voiceApiFingerprint,
  voiceApiRateLimitMessage,
} from "@/lib/voice-api-rate-limit";
import { auditVoiceGreetingSecurityEvent } from "@/lib/voice-greeting-audit";
import {
  validateVoiceGreetingGuardrails,
  type VoiceGreetingGuardrailResult,
} from "@/lib/voice-greeting-guardrails";
import { sanitizeVoiceGreetingPayload } from "@/lib/voice-greeting-security";
import { DEFAULT_GREETING_CLOSING } from "@/lib/voice-greeting";
import type { OnboardingSession } from "@/lib/onboarding-session";

export type VoiceGreetingInputContext = {
  session: OnboardingSession;
  businessName: string;
  source: "onboarding_review" | "onboarding_save" | "voice_preview";
};

export type VoiceGreetingInputResult =
  | {
      ok: true;
      greetingIntro: string;
      greetingClosing: string;
    }
  | {
      ok: false;
      message: string;
      rateLimited?: boolean;
      introIssue?: boolean;
      closingIssue?: boolean;
    };

async function auditGuardrailBlock(
  ctx: VoiceGreetingInputContext,
  guardrail: Extract<VoiceGreetingGuardrailResult, { ok: false }>,
  introLength: number,
  closingLength: number,
): Promise<void> {
  await auditVoiceGreetingSecurityEvent({
    source: ctx.source,
    outcome: "failure",
    actorUserId: ctx.session.user.id,
    organizationId: ctx.session.organizationId,
    eventType: "voice_greeting_guardrail_blocked",
    introIssue: guardrail.introIssue,
    closingIssue: guardrail.closingIssue,
    introLength,
    closingLength,
  });
}

export async function prepareOnboardingVoiceGreetingInput(
  ctx: VoiceGreetingInputContext,
  payload: { greetingIntro: string; greetingClosing: string },
  options: { rateLimitScope: "greeting_review" | null },
): Promise<VoiceGreetingInputResult> {
  if (options.rateLimitScope) {
    const fingerprint = voiceApiFingerprint(
      `${options.rateLimitScope}:${ctx.session.organizationId}`,
    );
    const rateLimit = await reserveVoiceApiRequest(
      options.rateLimitScope,
      fingerprint,
    );
    if (!rateLimit.allowed) {
      await auditVoiceGreetingSecurityEvent({
        source: ctx.source,
        outcome: "rate_limited",
        actorUserId: ctx.session.user.id,
        organizationId: ctx.session.organizationId,
        eventType: "voice_greeting_rate_limited",
      });
      return {
        ok: false,
        message: voiceApiRateLimitMessage(rateLimit.retryAfterSeconds),
        rateLimited: true,
      };
    }
  }

  const sanitized = sanitizeVoiceGreetingPayload({
    greetingIntro: payload.greetingIntro,
    greetingClosing: payload.greetingClosing,
    defaultClosing: DEFAULT_GREETING_CLOSING,
  });

  if (!sanitized.ok) {
    await auditVoiceGreetingSecurityEvent({
      source: ctx.source,
      outcome: "failure",
      actorUserId: ctx.session.user.id,
      organizationId: ctx.session.organizationId,
      eventType: "voice_greeting_invalid_format",
      introLength: String(payload.greetingIntro ?? "").trim().length,
      closingLength: String(payload.greetingClosing ?? "").trim().length,
    });
    return { ok: false, message: sanitized.message };
  }

  const guardrail = validateVoiceGreetingGuardrails({
    greetingIntro: sanitized.greetingIntro,
    greetingClosing: sanitized.greetingClosing,
    businessName: ctx.businessName,
  });

  if (!guardrail.ok) {
    await auditGuardrailBlock(
      ctx,
      guardrail,
      sanitized.greetingIntro.length,
      sanitized.greetingClosing.length,
    );
    return {
      ok: false,
      message: guardrail.message,
      introIssue: guardrail.introIssue,
      closingIssue: guardrail.closingIssue,
    };
  }

  return {
    ok: true,
    greetingIntro: sanitized.greetingIntro,
    greetingClosing: sanitized.greetingClosing,
  };
}
