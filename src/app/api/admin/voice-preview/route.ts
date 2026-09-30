import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/admin-session";
import {
  isCartesiaVoiceId,
  resolveLiveKitTtsLanguage,
  resolveLiveKitTtsModel,
  resolveOrgCartesiaVoiceId,
} from "@/lib/cara-livekit-voice";
import { synthesizeLiveKitInferenceSpeech } from "@/lib/livekit-inference-voice";
import { prepareVoicePreviewTtsText } from "@/lib/voice-preview-tts-text";
import { voiceLegalDisclosure } from "@/lib/voice-greeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text?: string;
  voiceId?: string;
  assistantDisplayName?: string;
};

export async function POST(request: Request) {
  try {
    await requireAdminPermission("customers");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const assistantName = String(body.assistantDisplayName ?? "Cara").trim() || "Cara";
  const text =
    String(body.text ?? "").trim() ||
    `Hello, ${voiceLegalDisclosure(assistantName)} How can I help you today?`;
  const requestedVoice = String(body.voiceId ?? "").trim();
  const voiceId = isCartesiaVoiceId(requestedVoice)
    ? requestedVoice
    : resolveOrgCartesiaVoiceId(requestedVoice || null);
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
