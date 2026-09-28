import { NextResponse } from "next/server";

import { hasAccountOwnerAccess } from "@/lib/account-owner-access";
import { managedClientSetupRequirement } from "@/lib/managed-onboarding-access";
import { userHasCurrentLegalAcceptances } from "@/lib/legal-acceptance-status";

import { resolveOrgCartesiaVoiceId, resolveLiveKitTtsLanguage, resolveLiveKitTtsModel } from "@/lib/cara-livekit-voice";
import { synthesizeLiveKitInferenceSpeech } from "@/lib/livekit-inference-voice";
import {
  reserveVoiceApiRequest,
  voiceApiFingerprint,
  voiceApiRateLimitMessage,
} from "@/lib/voice-api-rate-limit";
import { auditVoiceGreetingSecurityEvent } from "@/lib/voice-greeting-audit";
import {
  greetingLineIsInappropriate,
  validateVoiceGreetingGuardrails,
} from "@/lib/voice-greeting-guardrails";
import {
  greetingScriptTooLong,
  sanitizeGreetingLine,
  sanitizeVoiceGreetingPayload,
} from "@/lib/voice-greeting-security";
import { DEFAULT_GREETING_CLOSING } from "@/lib/voice-greeting";
import { prepareVoicePreviewTtsText } from "@/lib/voice-preview-tts-text";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text?: string;
  greetingIntro?: string;
  greetingClosing?: string;
};

const GUARDRAIL_MESSAGE =
  "This greeting can't include offensive or inappropriate language — keep it professional for callers.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, account_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id || !(await hasAccountOwnerAccess(supabase, {
    userId: user.id, accountId: profile.account_id, profileRole: profile.role,
  }))) {
    return NextResponse.json({ error: "An owner account is required." }, { status: 403 });
  }

  const organizationId = profile.organization_id as string;
  const setupRequirement = await managedClientSetupRequirement({
    user,
    organizationId,
    hasCurrentLegalAcceptances: userHasCurrentLegalAcceptances,
  });
  if (setupRequirement) {
    return NextResponse.json({
      error: setupRequirement === "password"
        ? "Choose your account password before using voice preview."
        : "Review and accept your organisation agreements before using voice preview.",
      requiredSetup: setupRequirement,
    }, { status: 403 });
  }

  const fingerprint = voiceApiFingerprint(
    `voice-preview:${user.id}`,
  );
  const rateLimit = await reserveVoiceApiRequest("voice_preview", fingerprint);

  if (!rateLimit.allowed) {
    if (organizationId) {
      await auditVoiceGreetingSecurityEvent({
        source: "voice_preview",
        outcome: "rate_limited",
        actorUserId: user.id,
        organizationId,
        eventType: "voice_greeting_rate_limited",
        scriptLength: 0,
      });
    }
    return NextResponse.json(
      { error: voiceApiRateLimitMessage(rateLimit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = sanitizeGreetingLine(String(body.text ?? ""));
  if (!text) {
    return NextResponse.json({ error: "Nothing to preview." }, { status: 400 });
  }
  if (greetingScriptTooLong(text)) {
    return NextResponse.json({ error: "Preview text is too long." }, { status: 400 });
  }

  const introRaw = String(body.greetingIntro ?? "").trim();
  const closingRaw = String(body.greetingClosing ?? "").trim();
  if (introRaw || closingRaw) {
    const sanitized = sanitizeVoiceGreetingPayload({
      greetingIntro: introRaw,
      greetingClosing: closingRaw,
      defaultClosing: DEFAULT_GREETING_CLOSING,
    });
    if (!sanitized.ok) {
      return NextResponse.json({ error: sanitized.message }, { status: 400 });
    }

    let businessName = "";
    if (organizationId) {
      const admin = createAdminClient();
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();
      businessName = String(org?.name ?? "").trim();
    }

    const guardrail = validateVoiceGreetingGuardrails({
      greetingIntro: sanitized.greetingIntro,
      greetingClosing: sanitized.greetingClosing,
      businessName,
    });
    if (!guardrail.ok) {
      if (organizationId) {
        await auditVoiceGreetingSecurityEvent({
          source: "voice_preview",
          outcome: "failure",
          actorUserId: user.id,
          organizationId,
          eventType: "voice_greeting_guardrail_blocked",
          introIssue: guardrail.introIssue,
          closingIssue: guardrail.closingIssue,
          introLength: sanitized.greetingIntro.length,
          closingLength: sanitized.greetingClosing.length,
        });
      }
      return NextResponse.json(
        {
          error: guardrail.message,
          introIssue: guardrail.introIssue,
          closingIssue: guardrail.closingIssue,
        },
        { status: 400 },
      );
    }
  } else if (greetingLineIsInappropriate(text)) {
    if (organizationId) {
      await auditVoiceGreetingSecurityEvent({
        source: "voice_preview",
        outcome: "failure",
        actorUserId: user.id,
        organizationId,
        eventType: "voice_greeting_guardrail_blocked",
        scriptLength: text.length,
      });
    }
    return NextResponse.json({ error: GUARDRAIL_MESSAGE }, { status: 400 });
  }


  let agentVoiceId: string | null = null;
  if (organizationId) {
    const admin = createAdminClient();
    const { data: orgVoice } = await admin
      .from("organizations")
      .select("agent_voice_id")
      .eq("id", organizationId)
      .maybeSingle();
    agentVoiceId = (orgVoice?.agent_voice_id as string | null) ?? null;
  }

  const voiceId = resolveOrgCartesiaVoiceId(agentVoiceId);
  const ttsText = prepareVoicePreviewTtsText(text);

  try {
    const audio = await synthesizeLiveKitInferenceSpeech({
      text: ttsText,
      model: resolveLiveKitTtsModel(),
      voiceId,
      language: resolveLiveKitTtsLanguage(),
    });
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice preview failed.";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
