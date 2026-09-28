export const TEXT_REHEARSAL_TOPIC = "cara_text_rehearsal";

export const TEXT_REHEARSAL_ROOM_PREFIX = "text-rehearsal-";

export const TEXT_REHEARSAL_METADATA_SOURCE = "text_rehearsal";

export type TextRehearsalInboundPacket =
  | { type: "caller_turn"; text: string; turnId: string }
  | { type: "ping"; turnId?: string }
  | { type: "end_session" };

export type TextRehearsalOutboundPacket =
  | { type: "session_ready"; greeting?: string | null }
  | { type: "assistant_line"; turnId: string; text: string; spoken?: string | null }
  | { type: "tool_call"; turnId: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; turnId: string; name: string; ok: boolean; message: string }
  | { type: "lookup_filler"; turnId: string; text: string }
  | {
      type: "turn_complete";
      turnId: string;
      assistant: string;
      tools: { name: string; args: Record<string, unknown> }[];
    }
  | { type: "pong"; turnId?: string }
  | { type: "error"; message: string; turnId?: string };

export function encodeTextRehearsalPacket(
  packet: TextRehearsalInboundPacket | TextRehearsalOutboundPacket,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(packet));
}

export function parseTextRehearsalPacket(
  payload: Uint8Array<ArrayBufferLike> | ArrayBuffer,
): TextRehearsalInboundPacket | TextRehearsalOutboundPacket | null {
  try {
    const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >;
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed as TextRehearsalInboundPacket | TextRehearsalOutboundPacket;
  } catch {
    return null;
  }
}
