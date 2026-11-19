import "server-only";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export type VoiceWebhookAuthResult = "ok" | "no_secret" | "bad";

export async function authorizeVoiceWebhook(
  request: Request,
): Promise<VoiceWebhookAuthResult> {
  const secret = process.env.CLISTE_VOICE_WEBHOOK_SECRET?.trim();
  if (!secret) return "no_secret";
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cliste-voice-secret");
  const token = bearer ?? header ?? "";
  return (await timingSafeEqualUtf8(token, secret)) ? "ok" : "bad";
}

export function voiceWebhookUnauthorizedResponse() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export function voiceWebhookNoSecretResponse() {
  return Response.json(
    {
      ok: false,
      error: "Voice service is temporarily unavailable.",
    },
    { status: 503 },
  );
}
