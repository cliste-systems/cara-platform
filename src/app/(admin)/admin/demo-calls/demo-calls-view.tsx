"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";

import {
  ensureMicrophoneAccess,
  listDemoCallMicrophones,
  publishDemoCallMicrophone,
  releasePreflightMicrophone,
  unpublishDemoCallMicrophone,
} from "@/lib/demo-call-microphone";
import { Loader2, Mic, Phone, PhoneOff } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminDestructiveButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import { formatIrishE164Display, type AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import {
  DemoCallEngineeringLogPanel,
  DemoCallRoomTelemetry,
  useDemoCallEngineeringLog,
} from "./demo-call-engineering-log";
import {
  DemoCallLinePicker,
  resolveSelectedDemoLine,
} from "./demo-call-line-picker";

type DemoCallSession = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  callerNumber: string;
  orgName?: string;
};

type CallLogSummary = {
  id: string;
  createdAt: string;
  outcome: string | null;
  durationSeconds: number | null;
};

type DemoCallsViewProps = {
  lines: AdminDemoCallLine[];
};

type CallPhase = "idle" | "connecting" | "in_call" | "ended" | "error";

function friendlyDemoCallError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Microphone access was blocked. Allow mic for localhost in your browser, then try again.";
    }
    if (err.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }
    if (err.name === "NotReadableError") {
      return "Chrome could not open the microphone. Close other tabs or apps using the mic (Zoom, Meet, another demo tab), then try again.";
    }
  }
  if (err instanceof Error) {
    if (err.message.includes("Client initiated disconnect")) {
      return "Call disconnected before it started. Check microphone permission and try again.";
    }
    if (/could not start audio source/i.test(err.message)) {
      return "Chrome could not open the microphone. Close other tabs or apps using the mic (Zoom, Meet, another demo tab), then try again.";
    }
    return err.message;
  }
  return "Failed to start demo call.";
}

function ActiveCallPanel({
  session,
  sessionStartedAt,
  sessionEndedAt,
  log,
  onEnd,
}: {
  session: DemoCallSession;
  sessionStartedAt: number;
  sessionEndedAt: number | null;
  log: ReturnType<typeof useDemoCallEngineeringLog>;
  onEnd: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  useEffect(() => {
    let stopped = false;
    const report = (ended = false) => {
      if (!ended && (stopped || room.state !== ConnectionState.Connected)) return;
      void fetch("/api/admin/demo-call/presence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: session.roomName, ended }), keepalive: ended,
      }).catch(() => { /* The next heartbeat retries transient failures. */ });
    };
    const connected = () => report();
    const disconnected = () => { stopped = true; report(true); };
    const leaving = () => report(true);
    room.on(RoomEvent.Connected, connected);
    room.on(RoomEvent.Reconnected, connected);
    room.on(RoomEvent.Disconnected, disconnected);
    window.addEventListener("pagehide", leaving);
    report();
    const heartbeat = window.setInterval(connected, 15000);
    return () => {
      stopped = true; window.clearInterval(heartbeat);
      room.off(RoomEvent.Connected, connected);room.off(RoomEvent.Reconnected, connected);room.off(RoomEvent.Disconnected, disconnected);
      window.removeEventListener("pagehide", leaving);
    };
  }, [room, session.roomName]);
  const [agentJoined, setAgentJoined] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [workerMissing, setWorkerMissing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micRepublishing, setMicRepublishing] = useState(false);
  const workerWarnLoggedRef = useRef(false);
  const microphoneReadyRef = useRef(false);
  const microphonePublishMsRef = useRef<number | null>(null);
  const agentJoinMsRef = useRef<number | null>(null);
  const agentDispatchRef = useRef(false);
  const micPublishGenerationRef = useRef(0);
  const logAppendRef = useRef(log.append);
  const logSetMetricsRef = useRef(log.setMetrics);

  useEffect(() => {
    logAppendRef.current = log.append;
    logSetMetricsRef.current = log.setMetrics;
  }, [log.append, log.setMetrics]);

  const markMicrophoneReady = useCallback(
    (detail: string) => {
      if (microphoneReadyRef.current) return;
      microphoneReadyRef.current = true;
      setMicrophoneReady(true);
      setMicError(null);
      const ms = Date.now() - sessionStartedAt;
      microphonePublishMsRef.current = ms;
      logSetMetricsRef.current((prev) => ({ ...prev, microphonePublishMs: ms }));
      logAppendRef.current("success", "microphone", detail, ms);
    },
    [sessionStartedAt],
  );

  useEffect(() => {
    const syncParticipants = () => {
      const joined = room.remoteParticipants.size > 0;
      setAgentJoined(joined);
      if (joined && agentJoinMsRef.current == null) {
        agentJoinMsRef.current = Date.now() - sessionStartedAt;
      }
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
    if (agentJoined || connectionState !== ConnectionState.Connected || !microphoneReady) {
      setWorkerMissing(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setWorkerMissing(true);
      if (!workerWarnLoggedRef.current) {
        workerWarnLoggedRef.current = true;
        logAppendRef.current(
          "warn",
          "worker",
          "No voice worker joined this room. For local demo calls, run npm run dev:local from cara-platform so the dashboard and local Cara worker start together.",
        );
      }
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [agentJoined, connectionState, microphoneReady]);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    const generation = micPublishGenerationRef.current + 1;
    micPublishGenerationRef.current = generation;

    const checkExistingMic = () => {
      const publication = room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      );
      if (publication?.track && room.localParticipant.isMicrophoneEnabled) {
        markMicrophoneReady(
          `Browser microphone published (${publication.trackSid ?? "local"})`,
        );
      }
    };

    const onLocalTrackPublished = (publication: {
      source: Track.Source;
      trackSid?: string;
    }) => {
      if (publication.source !== Track.Source.Microphone) return;
      markMicrophoneReady(
        `Browser microphone published (${publication.trackSid ?? "local"})`,
      );
    };

    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    checkExistingMic();

    let attempts = 0;

    const publishMicrophone = async () => {
      if (generation !== micPublishGenerationRef.current) return;
      if (microphoneReadyRef.current) return;
      attempts += 1;
      try {
        logAppendRef.current(
          "info",
          "microphone",
          attempts === 1
            ? "Publishing browser microphone…"
            : `Retrying browser microphone publish (attempt ${attempts})…`,
        );
        await publishDemoCallMicrophone(room);
        checkExistingMic();
        if (microphoneReadyRef.current) return;

        if (attempts < 5) {
          window.setTimeout(() => {
            void publishMicrophone();
          }, 800);
          return;
        }

        throw new Error(
          "LiveKit connected, but the browser microphone was not published.",
        );
      } catch (err) {
        if (generation !== micPublishGenerationRef.current) return;
        if (microphoneReadyRef.current) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to publish browser microphone.";
        setMicError(message);
        logAppendRef.current("error", "microphone", message);
      }
    };

    const retryTimer = window.setTimeout(() => {
      void publishMicrophone();
    }, 0);

    return () => {
      micPublishGenerationRef.current += 1;
      window.clearTimeout(retryTimer);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      void unpublishDemoCallMicrophone(room).catch(() => {
        /* best-effort cleanup */
      });
    };
  }, [connectionState, markMicrophoneReady, room]);

  useEffect(() => {
    if (!microphoneReady || agentDispatchRef.current) return;
    agentDispatchRef.current = true;
    logAppendRef.current(
      "info",
      "worker",
      "Microphone live — dispatching Cara to the room",
    );
    void fetch("/api/admin/demo-call/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: session.roomName,
        calledNumber: session.calledNumber,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Failed to dispatch voice worker.");
        }
        logAppendRef.current("success", "worker", "Cara dispatch requested");
      })
      .catch((err) => {
        agentDispatchRef.current = false;
        const message =
          err instanceof Error ? err.message : "Failed to dispatch voice worker.";
        logAppendRef.current("error", "worker", message);
      });
  }, [microphoneReady, session.calledNumber, session.roomName]);

  const republishMicrophone = useCallback(async () => {
    if (connectionState !== ConnectionState.Connected) return;
    setMicRepublishing(true);
    setMicError(null);
    microphoneReadyRef.current = false;
    setMicrophoneReady(false);
    logSetMetricsRef.current((prev) => ({ ...prev, microphonePublishMs: null }));
    micPublishGenerationRef.current += 1;
    try {
      await unpublishDemoCallMicrophone(room);
      await publishDemoCallMicrophone(room);
      const publication = room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      );
      if (publication?.track && room.localParticipant.isMicrophoneEnabled) {
        markMicrophoneReady(
          `Browser microphone republished (${publication.trackSid ?? "local"})`,
        );
      } else {
        throw new Error("Microphone republish did not create a LiveKit track.");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to republish browser microphone.";
      setMicError(message);
      logAppendRef.current("error", "microphone", message);
    } finally {
      setMicRepublishing(false);
    }
  }, [connectionState, markMicrophoneReady, room]);

  const micRepublishedForAgentRef = useRef(false);

  useEffect(() => {
    if (!agentJoined || !microphoneReady || micRepublishedForAgentRef.current) return;
    micRepublishedForAgentRef.current = true;
    logAppendRef.current(
      "info",
      "microphone",
      "Cara joined — refreshing mic track so she can hear you",
    );
    void republishMicrophone();
  }, [agentJoined, microphoneReady, republishMicrophone]);

  const statusLabel = useMemo(() => {
    if (connectionState === ConnectionState.Connecting) return "Connecting…";
    if (connectionState === ConnectionState.Reconnecting) return "Reconnecting…";
    if (connectionState === ConnectionState.Disconnected) return "Disconnected";
    if (!agentJoined) return "Waiting for Cara…";
    if (!microphoneReady) return "Publishing microphone…";
    return "In call";
  }, [agentJoined, connectionState, microphoneReady]);

  return (
    <div className="space-y-4">
      <RoomAudioRenderer />
      <StartAudio label="Enable audio" />

      <div className="flex flex-wrap items-center gap-3">
        <AdminBadge tone={agentJoined ? "success" : "neutral"}>{statusLabel}</AdminBadge>
        <span className="text-sm text-gray-600">
          {session.orgName ?? "Store"} · {formatIrishE164Display(session.calledNumber)}
        </span>
      </div>

      {workerMissing ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Cara&apos;s voice worker has not joined.</p>
          <p className="mt-1 text-amber-800">
            Local demo calls need the full local stack. Stop this server and run{" "}
            <code className="font-mono text-xs">npm run dev:local</code> from{" "}
            <code className="font-mono text-xs">cara-platform</code>.
          </p>
        </div>
      ) : null}

      {micError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Microphone not published</p>
          <p className="mt-1">{micError}</p>
          <button
            type="button"
            disabled={micRepublishing}
            onClick={() => void republishMicrophone()}
            className={`${adminSecondaryButtonClass} mt-3`}
          >
            {micRepublishing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Mic className="size-3.5" aria-hidden />
            )}
            Republish microphone
          </button>
        </div>
      ) : null}

      {!microphoneReady && !micError && agentJoined ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Waiting for your microphone…</p>
          <p className="mt-1 text-amber-800">
            Cara can speak, but she cannot hear you until the browser mic publishes to
            LiveKit.
          </p>
          <button
            type="button"
            disabled={micRepublishing}
            onClick={() => void republishMicrophone()}
            className={`${adminSecondaryButtonClass} mt-3`}
          >
            {micRepublishing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Mic className="size-3.5" aria-hidden />
            )}
            Publish microphone now
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={async () => {
          log.append("info", "browser", "End call requested");
          await room.disconnect();
          onEnd();
        }}
        className={adminDestructiveButtonClass}
      >
        <PhoneOff className="size-3.5" aria-hidden />
        End call
      </button>

      <DemoCallRoomTelemetry
        sessionStartedAt={sessionStartedAt}
        sessionEndedAt={sessionEndedAt}
        log={log}
      />
    </div>
  );
}

export function DemoCallsView({ lines }: DemoCallsViewProps) {
  const [microphones, setMicrophones] = useState<Awaited<ReturnType<typeof listDemoCallMicrophones>>>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [activeMicrophoneLabel, setActiveMicrophoneLabel] = useState<string | null>(null);
  const [selectedE164, setSelectedE164] = useState<string | null>(
    lines[0]?.e164 ?? null,
  );
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DemoCallSession | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionEndedAt, setSessionEndedAt] = useState<number | null>(null);
  const [callLog, setCallLog] = useState<CallLogSummary | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshMicrophones = () => {
      void listDemoCallMicrophones().then((devices) => {
        if (!cancelled) setMicrophones(devices);
      }).catch(() => { /* Start reports microphone permission errors. */ });
    };
    refreshMicrophones();
    navigator.mediaDevices?.addEventListener("devicechange", refreshMicrophones);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener("devicechange", refreshMicrophones);
      releasePreflightMicrophone();
    };
  }, []);

  const engineeringLog = useDemoCallEngineeringLog({
    roomName: session?.roomName ?? null,
    sessionStartedAt,
    enabled:
      phase === "connecting" ||
      phase === "in_call" ||
      phase === "ended",
  });

  const [connectingElapsedMs, setConnectingElapsedMs] = useState(0);

  const frozenSessionElapsedMs =
    sessionStartedAt != null && sessionEndedAt != null
      ? Math.max(0, sessionEndedAt - sessionStartedAt)
      : 0;

  useEffect(() => {
    if (phase !== "connecting" || !sessionStartedAt) {
      setConnectingElapsedMs(0);
      return;
    }
    const tick = () => setConnectingElapsedMs(Date.now() - sessionStartedAt);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [phase, sessionStartedAt]);

  const selectedLine = resolveSelectedDemoLine(lines, selectedE164);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollCallLog = useCallback(
    (roomName: string) => {
      clearPoll();
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const res = await fetch(
            `/api/admin/demo-call/call-log?roomName=${encodeURIComponent(roomName)}`,
          );
          if (!res.ok) return;
          const data = (await res.json()) as { callLog: CallLogSummary | null };
          if (data.callLog) {
            setCallLog(data.callLog);
            clearPoll();
          }
        } catch {
          /* retry */
        }
        if (attempts >= 30) clearPoll();
      }, 2000);
    },
    [clearPoll],
  );

  useEffect(() => () => clearPoll(), [clearPoll]);

  const startCall = async () => {
    if (!selectedLine) return;
    const startedAt = Date.now();
    setError(null);
    setActiveMicrophoneLabel(null);
    setCallLog(null);
    setSessionEndedAt(null);
    engineeringLog.reset();
    setSessionStartedAt(startedAt);
    setPhase("connecting");
    engineeringLog.append(
      "info",
      "session",
      `Starting demo call to ${selectedLine.orgName}`,
      0,
    );

    try {
      engineeringLog.append("info", "browser", "Requesting microphone access");
      const label = await ensureMicrophoneAccess(selectedMicrophoneId || undefined);
      setActiveMicrophoneLabel(label);
      setMicrophones(await listDemoCallMicrophones());
      engineeringLog.append("success", "browser", `Microphone ready: ${label}`);
    } catch (err) {
      releasePreflightMicrophone();
      void listDemoCallMicrophones().then(setMicrophones).catch(() => {});
      setSession(null);
      setSessionStartedAt(null);
      setPhase("error");
      setError(friendlyDemoCallError(err));
      engineeringLog.append("error", "browser", friendlyDemoCallError(err));
      return;
    }

    try {
      engineeringLog.append("info", "dashboard", "Creating LiveKit room");
      const res = await fetch("/api/admin/demo-call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calledNumber: selectedLine.e164 }),
      });
      const data = (await res.json()) as DemoCallSession & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start demo call.");
      }
      engineeringLog.append(
        "success",
        "dashboard",
        `Room ${data.roomName.slice(0, 18)}… ready`,
      );
      setSession(data);
      setPhase("in_call");
    } catch (err) {
      releasePreflightMicrophone();
      setSession(null);
      setSessionStartedAt(null);
      setPhase("error");
      const message = friendlyDemoCallError(err);
      setError(message);
      engineeringLog.append("error", "dashboard", message);
    }
  };

  const endCall = useCallback(() => {
    releasePreflightMicrophone();
    const roomName = session?.roomName;
    const endedAt = Date.now();
    setSessionEndedAt(endedAt);
    engineeringLog.append(
      "info",
      "session",
      "Call ended · waiting for post-call webhook",
      sessionStartedAt != null ? endedAt - sessionStartedAt : undefined,
    );
    setPhase("ended");
    if (roomName) {
      void fetch("/api/admin/demo-call/presence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, ended: true }), keepalive: true,
      }).catch(() => {});
      pollCallLog(roomName);
    }
  }, [engineeringLog, pollCallLog, session?.roomName, sessionStartedAt]);

  const reset = () => {
    releasePreflightMicrophone();
    clearPoll();
    setSession(null);
    setSessionStartedAt(null);
    setSessionEndedAt(null);
    setCallLog(null);
    setError(null);
    setActiveMicrophoneLabel(null);
    engineeringLog.reset();
    setPhase("idle");
  };

  const pickerDisabled =
    phase === "connecting" || phase === "in_call" || phase === "ended";

  const showLinePicker = phase === "idle" || phase === "error";

  return (
    <div className="flex flex-col gap-6">
      {phase === "connecting" ? (
        <>
          <AdminSectionCard
            title="Starting session"
            description={selectedLine?.orgName ?? "Demo call"}
          >
            <div className="flex items-center gap-2 p-5 text-sm text-gray-600">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Creating LiveKit room — your mic publishes first, then Cara joins…
            </div>
          </AdminSectionCard>
          <DemoCallEngineeringLogPanel
            entries={engineeringLog.entries}
            metrics={engineeringLog.metrics}
            connectionState={ConnectionState.Connecting}
            elapsedMs={connectingElapsedMs}
          />
        </>
      ) : null}

      {phase === "in_call" && session && sessionStartedAt ? (
        <AdminSectionCard
          title="Live session"
          description={`${session.orgName ?? selectedLine?.orgName ?? "Store"} · ${formatIrishE164Display(session.calledNumber)}`}
        >
          <div className="p-5">
            {activeMicrophoneLabel ? (
              <p className="mb-3 text-sm text-gray-600">Microphone: {activeMicrophoneLabel}</p>
            ) : null}
            <LiveKitRoom
              key={session.roomName}
              serverUrl={session.livekitUrl}
              token={session.token}
              connect
              audio={false}
              video={false}
              onDisconnected={endCall}
              onMediaDeviceFailure={() => {
                const message =
                  "Microphone access failed during the call. Check browser permissions and try again.";
                setError(message);
                engineeringLog.append("error", "media", message);
              }}
              onError={(err) => {
                if (err.message.includes("Client initiated disconnect")) return;
                const message = friendlyDemoCallError(err);
                setError(message);
                engineeringLog.append("error", "livekit", message);
              }}
            >
              <ActiveCallPanel
                session={session}
                sessionStartedAt={sessionStartedAt}
                sessionEndedAt={sessionEndedAt}
                log={engineeringLog}
                onEnd={endCall}
              />
            </LiveKitRoom>
          </div>
        </AdminSectionCard>
      ) : null}

      {phase === "ended" && session ? (
        <>
          <AdminSectionCard title="Call ended">
            <div className="space-y-3 p-5">
              <p className="text-sm text-gray-600">
                Post-call processing runs on the voice worker. Metrics below update until
                the call log lands.
              </p>
              {callLog ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p>
                    Call logged{" "}
                    <span className="font-mono text-xs">{callLog.id.slice(0, 8)}…</span>
                    {callLog.outcome ? ` · ${callLog.outcome}` : ""}
                    {callLog.durationSeconds != null
                      ? ` · ${callLog.durationSeconds}s`
                      : ""}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Waiting for call log…
                </div>
              )}
              <button
                type="button"
                onClick={reset}
                className={adminSecondaryButtonClass}
              >
                <Mic className="size-3.5" aria-hidden />
                Start another call
              </button>
            </div>
          </AdminSectionCard>
          <DemoCallEngineeringLogPanel
            entries={engineeringLog.entries}
            metrics={engineeringLog.metrics}
            connectionState={ConnectionState.Disconnected}
            elapsedMs={frozenSessionElapsedMs}
            sessionEndedAt={sessionEndedAt}
            callDurationSeconds={callLog?.durationSeconds ?? null}
          />
        </>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {showLinePicker ? (
        <div className="space-y-2">
          <label htmlFor="demo-call-microphone" className="block text-sm font-medium text-gray-900">
            Microphone
          </label>
          <select
            id="demo-call-microphone"
            value={selectedMicrophoneId}
            onChange={(event) => setSelectedMicrophoneId(event.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Automatic — prefer built-in microphone</option>
            {selectedMicrophoneId && !microphones.some((device) => device.deviceId === selectedMicrophoneId) ? (
              <option value={selectedMicrophoneId} disabled>Previously selected microphone unavailable</option>
            ) : null}
            {microphones.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Automatic prefers your MacBook or built-in mic and avoids iPhone microphones.
            Device names appear after microphone permission is granted.
          </p>
        </div>
      ) : null}

      {showLinePicker ? (
        <DemoCallLinePicker
          lines={lines}
          selectedE164={selectedE164}
          onSelectedE164Change={setSelectedE164}
          disabled={pickerDisabled}
          toolbarAction={
            <button
              type="button"
              disabled={!selectedLine || pickerDisabled}
              onClick={startCall}
              className={adminPrimaryButtonClass}
            >
              <Phone className="size-3.5" aria-hidden />
              Start demo call
            </button>
          }
        />
      ) : null}
    </div>
  );
}
