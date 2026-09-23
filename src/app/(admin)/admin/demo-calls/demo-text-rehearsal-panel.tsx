"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { Copy, Loader2, Send } from "lucide-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import { formatTextRehearsalExport } from "@/lib/text-rehearsal-export";
import {
  encodeTextRehearsalPacket,
  parseTextRehearsalPacket,
  TEXT_REHEARSAL_TOPIC,
  type TextRehearsalInboundPacket,
  type TextRehearsalOutboundPacket,
} from "@/lib/text-rehearsal-protocol";
import { cn } from "@/lib/utils";

import {
  TextRehearsalIssueLog,
  type DemoCallLogEntry,
  useDemoCallEngineeringLog,
} from "./demo-call-engineering-log";

type TextRehearsalSession = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  orgName?: string;
};

type TranscriptLine = {
  id: string;
  text: string;
  kind: "caller" | "assistant" | "tool" | "filler" | "system";
};

type TurnRecord = {
  caller: string;
  assistant?: string;
  tools?: { name: string; args: Record<string, unknown> }[];
  error?: string;
};

function nextLineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function TextRehearsalRoomPanel({
  session,
  onEnd,
  log,
}: {
  session: TextRehearsalSession;
  onEnd: () => void;
  log: ReturnType<typeof useDemoCallEngineeringLog>;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [workerLive, setWorkerLive] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const workerWarnLogged = useRef(false);
  const agentJoinedRef = useRef(false);
  const activeTurnRef = useRef<{
    caller: string;
    assistant?: string;
    tools: { name: string; args: Record<string, unknown> }[];
  } | null>(null);
  const connected = connectionState === ConnectionState.Connected;
  const pendingTurns = useRef(
    new Map<
      string,
      {
        resolve: () => void;
        reject: (error: Error) => void;
      }
    >(),
  );

  const appendLine = useCallback((text: string, kind: TranscriptLine["kind"]) => {
    setLines((prev) => [...prev, { id: nextLineId(), text, kind }]);
  }, []);

  const markWorkerLive = useCallback(() => {
    setWorkerLive(true);
  }, []);

  const exportText = useMemo(
    () =>
      formatTextRehearsalExport({
        mode: "single",
        storeLabel: session.orgName ?? session.calledNumber,
        calledNumber: session.calledNumber,
        turns: turns.map((turn) => ({
          caller: turn.caller,
          assistant: turn.assistant,
          tools: turn.tools,
          error: turn.error,
          roomName: session.roomName,
        })),
        issues: log.entries,
      }),
    [log.entries, session.calledNumber, session.orgName, session.roomName, turns],
  );

  useEffect(() => {
    const handlePacket = (packet: TextRehearsalOutboundPacket) => {
      if (packet.type === "session_ready") {
        markWorkerLive();
        return;
      }
      if (packet.type === "pong") {
        markWorkerLive();
        return;
      }
      if (packet.type === "assistant_line") {
        if (activeTurnRef.current) {
          activeTurnRef.current.assistant = packet.text;
        }
        appendLine(packet.text, "assistant");
        return;
      }
      if (packet.type === "tool_result") {
        appendLine(
          `[Tool result] ${packet.name} ${packet.ok ? "ok" : "failed"}: ${packet.message}`,
          packet.ok ? "system" : "tool",
        );
        if (!packet.ok) {
          log.append("warn", "tool", `${packet.name}: ${packet.message}`);
        }
        return;
      }
      if (packet.type === "lookup_filler") {
        appendLine(`[lookup filler] ${packet.text}`, "filler");
        return;
      }
      if (packet.type === "tool_call") {
        if (activeTurnRef.current) {
          activeTurnRef.current.tools.push({ name: packet.name, args: packet.args });
        }
        appendLine(
          `[Tool] ${packet.name} ${JSON.stringify(packet.args)}`,
          "tool",
        );
        return;
      }
      if (packet.type === "turn_complete") {
        const activeTurn = activeTurnRef.current;
        if (activeTurn) {
          setTurns((prev) => [
            ...prev,
            {
              caller: activeTurn.caller,
              assistant: packet.assistant || activeTurn.assistant,
              tools: packet.tools.length ? packet.tools : activeTurn.tools,
            },
          ]);
          activeTurnRef.current = null;
        }
        pendingTurns.current.get(packet.turnId)?.resolve();
        pendingTurns.current.delete(packet.turnId);
        return;
      }
      if (packet.type === "error") {
        const activeTurn = activeTurnRef.current;
        if (activeTurn) {
          setTurns((prev) => [
            ...prev,
            {
              caller: activeTurn.caller,
              assistant: activeTurn.assistant,
              tools: activeTurn.tools,
              error: packet.message,
            },
          ]);
          activeTurnRef.current = null;
        }
        pendingTurns.current.get(packet.turnId ?? "")?.reject(new Error(packet.message));
        if (packet.turnId) pendingTurns.current.delete(packet.turnId);
        log.append("error", "worker", packet.message);
      }
    };

    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== TEXT_REHEARSAL_TOPIC) return;
      const packet = parseTextRehearsalPacket(payload);
      if (!packet || packet.type === "ping" || packet.type === "caller_turn" || packet.type === "end_session") {
        return;
      }
      handlePacket(packet);
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [appendLine, log, markWorkerLive, room]);

  useEffect(() => {
    agentJoinedRef.current = agentJoined;
  }, [agentJoined]);

  useEffect(() => {
    const syncParticipants = () => {
      setAgentJoined(room.remoteParticipants.size > 0);
    };
    syncParticipants();
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    return () => {
      room.off(RoomEvent.ParticipantConnected, syncParticipants);
      room.off(RoomEvent.ParticipantDisconnected, syncParticipants);
    };
  }, [room]);

  useEffect(() => {
    if (!connected || workerLive) return;

    const pingWorker = () => {
      const packet: TextRehearsalInboundPacket = { type: "ping", turnId: "bootstrap" };
      void room.localParticipant
        ?.publishData(encodeTextRehearsalPacket(packet), {
          reliable: true,
          topic: TEXT_REHEARSAL_TOPIC,
        })
        .catch(() => {
          /* worker may not be up yet */
        });
    };

    pingWorker();
    const timer = window.setInterval(pingWorker, 3000);
    const warnTimer = window.setTimeout(() => {
      if (workerLive || workerWarnLogged.current) return;
      workerWarnLogged.current = true;
      const message = agentJoinedRef.current
        ? "Worker joined but text rehearsal is not active — run npm run dev:text-rehearsal in cliste-code-base-1 (or npm run dev in cliste-code-base-2), or redeploy with CARA_TEXT_REHEARSAL=1."
        : "No voice worker in this room — local dev often loses dispatches to the LiveKit Cloud agent when both use LIVEKIT_AGENT_NAME=cliste-retail-node. Set LIVEKIT_AGENT_NAME=cliste-voice-local in cb1 .env.local and cb2 .env, restart both, then start a new session.";
      log.append("warn", "worker", message);
    }, 10_000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(warnTimer);
    };
  }, [connected, log, room, workerLive]);

  const sendTurn = async () => {
    const text = draft.trim();
    if (!text || !connected || !workerLive || busy) return;

    setBusy(true);
    setDraft("");
    appendLine(text, "caller");
    activeTurnRef.current = { caller: text, tools: [] };

    const turnId = crypto.randomUUID();
    const packet: TextRehearsalInboundPacket = {
      type: "caller_turn",
      text,
      turnId,
    };

    try {
      await new Promise<void>((resolve, reject) => {
        pendingTurns.current.set(turnId, { resolve, reject });
        void room.localParticipant
          .publishData(encodeTextRehearsalPacket(packet), {
            reliable: true,
            topic: TEXT_REHEARSAL_TOPIC,
          })
          .catch(reject);
        window.setTimeout(() => {
          if (!pendingTurns.current.has(turnId)) return;
          pendingTurns.current.delete(turnId);
          const message = "Timed out waiting for Cara reply.";
          if (activeTurnRef.current) {
            setTurns((prev) => [
              ...prev,
              {
                caller: activeTurnRef.current!.caller,
                assistant: activeTurnRef.current!.assistant,
                tools: activeTurnRef.current!.tools,
                error: message,
              },
            ]);
            activeTurnRef.current = null;
          }
          reject(new Error(message));
        }, 90_000);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed.";
      appendLine(message, "system");
      log.append("error", "client", message);
    } finally {
      setBusy(false);
    }
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      log.append("error", "client", "Clipboard copy failed.");
    }
  };

  const endSession = async () => {
    try {
      const packet: TextRehearsalInboundPacket = { type: "end_session" };
      await room.localParticipant.publishData(encodeTextRehearsalPacket(packet), {
        reliable: true,
        topic: TEXT_REHEARSAL_TOPIC,
      });
    } catch {
      /* best effort */
    }
    onEnd();
  };

  const connectionLabel = !connected
    ? "Connecting…"
    : workerLive
      ? "Cara ready"
      : agentJoined
        ? "Worker connected"
        : "Dispatching worker…";

  const technicalDetails = [
    `room ${session.roomName}`,
    formatIrishE164Display(session.calledNumber),
    connected ? "livekit connected" : "livekit connecting",
    workerLive
      ? "text rehearsal active"
      : agentJoined
        ? "awaiting session_ready"
        : "awaiting worker",
  ].join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{connectionLabel}</p>
          <p className="mt-0.5 font-mono text-xs text-gray-500">{technicalDetails}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyExport()}
            className={adminSecondaryButtonClass}
          >
            <Copy className="size-3.5" aria-hidden />
            {copied ? "Copied" : "Copy all for Cursor"}
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            className={adminSecondaryButtonClass}
          >
            End session
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-gray-500">Transcript will appear here.</p>
            ) : (
              lines.map((line) => (
                <p
                  key={line.id}
                  className={cn(
                    "whitespace-pre-wrap",
                    line.kind === "caller" && "text-blue-900",
                    line.kind === "assistant" && "text-gray-900",
                    line.kind === "tool" && "text-violet-800",
                    line.kind === "filler" && "text-amber-800",
                    line.kind === "system" && "text-gray-500",
                  )}
                >
                  {line.kind === "caller" ? `Caller: ${line.text}` : line.text}
                </p>
              ))
            )}
          </div>
          <form
            className="flex shrink-0 gap-2 border-t border-gray-200 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendTurn();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!connected || !workerLive || busy}
              autoFocus
              placeholder="what steaks are on offer this week?"
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!connected || !workerLive || busy || !draft.trim()}
              className={`${adminPrimaryButtonClass} py-2`}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="size-3.5" aria-hidden />
              )}
              Send
            </button>
          </form>
        </div>

        <TextRehearsalIssueLog entries={log.entries} showWhenEmpty className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

export function DemoTextRehearsalPanel({
  session,
  sessionStartedAt,
  onEnd,
  log,
}: {
  session: TextRehearsalSession;
  sessionStartedAt: number;
  onEnd: () => void;
  log: ReturnType<typeof useDemoCallEngineeringLog>;
}) {
  return (
    <AdminSectionCard
      title="Live session"
      description={`${session.orgName ?? "Store"} · ${formatIrishE164Display(session.calledNumber)} · pure Assistant replies`}
      className="flex min-h-0 flex-1 flex-col"
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <LiveKitRoom
        key={session.roomName}
        serverUrl={session.livekitUrl}
        token={session.token}
        connect
        audio={false}
        video={false}
        onDisconnected={onEnd}
        onError={(err) => {
          if (err.message.includes("Client initiated disconnect")) return;
          log.append("error", "livekit", err.message);
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <TextRehearsalRoomPanel session={session} onEnd={onEnd} log={log} />
        </div>
      </LiveKitRoom>
    </AdminSectionCard>
  );
}

export type { TextRehearsalSession, DemoCallLogEntry };
