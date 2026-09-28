"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionState, RemoteAudioTrack, RoomEvent, Track } from "livekit-client";
import { useConnectionState, useRoomContext } from "@livekit/components-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { cn } from "@/lib/utils";
import type { TransportSample } from "@/lib/call-transport";

export type DemoCallLogLevel = "info" | "warn" | "error" | "success";

export type DemoCallLogEntry = {
  id: string;
  atMs: number;
  level: DemoCallLogLevel;
  tag: string;
  message: string;
};

type SessionLogResponse = {
  incidents: {
    id: string;
    occurredAt: string;
    stage: string;
    errorMessage: string;
    modelLabel: string | null;
    retryable: boolean | null;
  }[];
  callLog: {
    id: string;
    outcome: string | null;
    durationSeconds: number | null;
  } | null;
  callTestReport: {
    id: string;
    healthStatus: string;
    healthReason: string | null;
    greetingMs: number | null;
    replyP50: number | null;
    errorCount: number;
  } | null;
  transcriptQuality: {
    issues: string[];
    summary: string;
    needsReview: boolean;
  } | null;
};

function formatElapsed(ms: number): string {
  return `+${(ms / 1000).toFixed(1)}s`;
}

function formatSessionDurationMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatSecondsShort(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function logLevelClass(level: DemoCallLogLevel): string {
  switch (level) {
    case "success":
      return "text-emerald-700";
    case "warn":
      return "text-amber-700";
    case "error":
      return "text-red-700";
    default:
      return "text-gray-700";
  }
}

function nextLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useDemoCallEngineeringLog(input: {
  roomName: string | null;
  sessionStartedAt: number | null;
  enabled: boolean;
  pollSessionLog?: boolean;
}) {
  const [entries, setEntries] = useState<DemoCallLogEntry[]>([]);
  const [metrics, setMetrics] = useState({
    agentJoinMs: null as number | null,
    audioTrackMs: null as number | null,
    microphonePublishMs: null as number | null,
    incidentCount: 0,
    qualityFlagCount: 0,
  });
  const seenIncidentIds = useRef(new Set<string>());
  const seenQualityIssueKeys = useRef(new Set<string>());
  const seenCallLogId = useRef<string | null>(null);
  const seenCallTestReportId = useRef<string | null>(null);
  const seenLogKeys = useRef(new Set<string>());

  const append = useCallback(
    (
      level: DemoCallLogLevel,
      tag: string,
      message: string,
      atMs?: number,
    ) => {
      if (!input.sessionStartedAt) return;
      const elapsed = atMs ?? Date.now() - input.sessionStartedAt;
      const dedupeKey = `${tag}:${message}`;
      if (seenLogKeys.current.has(dedupeKey)) return;
      seenLogKeys.current.add(dedupeKey);
      setEntries((prev) => [
        ...prev,
        {
          id: nextLogId(),
          atMs: elapsed,
          level,
          tag,
          message,
        },
      ]);
    },
    [input.sessionStartedAt],
  );

  const ingestServerLog = useCallback(
    (payload: SessionLogResponse) => {
      setMetrics((prev) => ({
        ...prev,
        incidentCount: payload.incidents.length,
      }));

      for (const incident of payload.incidents) {
        if (seenIncidentIds.current.has(incident.id)) continue;
        seenIncidentIds.current.add(incident.id);
        append(
          "error",
          `pipeline_${incident.stage}`,
          incident.errorMessage,
        );
      }

      if (payload.callLog && seenCallLogId.current !== payload.callLog.id) {
        seenCallLogId.current = payload.callLog.id;
        append(
          "success",
          "call_log",
          `Call log created · ${payload.callLog.id.slice(0, 8)}… · ${payload.callLog.outcome ?? "pending"}`,
        );
      }

      if (
        payload.callTestReport &&
        seenCallTestReportId.current !== payload.callTestReport.id
      ) {
        seenCallTestReportId.current = payload.callTestReport.id;
        const report = payload.callTestReport;
        append(
          report.healthStatus === "pass" ? "success" : "warn",
          "call_test_report",
          `Health ${report.healthStatus}${report.healthReason ? ` · ${report.healthReason}` : ""} · greeting ${formatSecondsShort(report.greetingMs)} · reply p50 ${formatSecondsShort(report.replyP50)} · ${report.errorCount} error(s)`,
        );
      }

      if (payload.transcriptQuality) {
        setMetrics((prev) => ({
          ...prev,
          qualityFlagCount: payload.transcriptQuality!.issues.length,
        }));
        for (const issue of payload.transcriptQuality.issues) {
          const key = `transcript_qa:${issue}`;
          if (seenQualityIssueKeys.current.has(key)) continue;
          seenQualityIssueKeys.current.add(key);
          append("warn", "transcript_qa", issue);
        }
      }
    },
    [append],
  );

  useEffect(() => {
    if (input.pollSessionLog === false) return;
    if (!input.enabled || !input.roomName) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/demo-call/session-log?roomName=${encodeURIComponent(input.roomName!)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as SessionLogResponse;
        if (!cancelled) ingestServerLog(data);
      } catch {
        /* retry on next tick */
      }
    };

    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ingestServerLog, input.enabled, input.pollSessionLog, input.roomName]);

  return {
    entries,
    metrics,
    append,
    setMetrics,
    reset: () => {
      setEntries([]);
      setMetrics({
        agentJoinMs: null,
        audioTrackMs: null,
        microphonePublishMs: null,
        incidentCount: 0,
        qualityFlagCount: 0,
      });
      seenIncidentIds.current.clear();
      seenQualityIssueKeys.current.clear();
      seenCallLogId.current = null;
      seenCallTestReportId.current = null;
      seenLogKeys.current.clear();
    },
  };
}

export function DemoCallEngineeringLogPanel({
  entries,
  metrics,
  connectionState,
  elapsedMs,
  sessionEndedAt,
  callDurationSeconds,
  live = false,
}: {
  entries: DemoCallLogEntry[];
  metrics: {
    agentJoinMs: number | null;
    audioTrackMs: number | null;
    microphonePublishMs: number | null;
    incidentCount: number;
    qualityFlagCount: number;
  };
  connectionState: ConnectionState;
  elapsedMs: number;
  sessionEndedAt?: number | null;
  callDurationSeconds?: number | null;
  live?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  const elapsedLabel = useMemo(() => {
    if (callDurationSeconds != null && callDurationSeconds >= 0) {
      return formatDurationSeconds(callDurationSeconds);
    }
    return formatSessionDurationMs(elapsedMs);
  }, [callDurationSeconds, elapsedMs]);

  const elapsedHint = useMemo(() => {
    if (callDurationSeconds != null) {
      if (sessionEndedAt != null && elapsedMs > 0) {
        const wallSeconds = Math.round(elapsedMs / 1000);
        if (Math.abs(wallSeconds - callDurationSeconds) >= 2) {
          return `Recorded call duration · ${formatDurationSeconds(wallSeconds)} in browser session`;
        }
      }
      return "Recorded call duration";
    }
    if (live) return "Live — stops when you end the call";
    return "Session time · frozen when you ended the call";
  }, [callDurationSeconds, elapsedMs, live, sessionEndedAt]);

  const metricItems = useMemo(
    () => [
      { label: "Elapsed", value: elapsedLabel, hint: elapsedHint },
      {
        label: "Agent join",
        value: formatSecondsShort(metrics.agentJoinMs),
        hint: null,
      },
      {
        label: "Microphone",
        value: formatSecondsShort(metrics.microphonePublishMs),
        hint: metrics.microphonePublishMs == null ? "Browser mic not published yet" : "Browser mic published",
      },
      {
        label: "Agent audio",
        value: formatSecondsShort(metrics.audioTrackMs),
        hint: "Cara's outgoing audio track",
      },
      { label: "Incidents", value: String(metrics.incidentCount), hint: null },
      {
        label: "Quality flags",
        value: String(metrics.qualityFlagCount),
        hint:
          metrics.qualityFlagCount > 0
            ? "Speech / transcript issues after call log lands"
            : null,
      },
      {
        label: "Connection",
        value: connectionState.replace(/^./, (c) => c.toUpperCase()),
        hint: null,
      },
    ],
    [connectionState, elapsedHint, elapsedLabel, metrics],
  );

  return (
    <AdminSectionCard
      title="Engineering log"
      description="Session timing, pipeline incidents, and post-call health."
      contentClassName="flex flex-col p-0"
    >
      <div className="shrink-0 divide-y divide-gray-100">
        {metricItems.map((item) => (
          <div key={item.label} className="px-5 py-4">
            <p className="text-sm text-gray-600">{item.label}</p>
            <p className="mt-1 font-mono text-lg leading-none text-gray-900">
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1.5 text-xs text-gray-500">{item.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-gray-50/80">
        <div className="border-b border-gray-100 px-5 py-2.5">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Events
          </p>
        </div>
        <div ref={scrollRef} className="px-5 py-3">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500">Waiting for session events…</p>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="border-l-2 border-gray-200 pl-3 text-sm leading-snug"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-xs text-gray-500">
                      {formatElapsed(entry.atMs)}
                    </span>
                    <span className="text-xs text-gray-400">[{entry.tag}]</span>
                  </div>
                  <p className={cn("mt-0.5 text-gray-800", logLevelClass(entry.level))}>
                    {entry.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminSectionCard>
  );
}

export function TextRehearsalIssueLog({
  entries,
  showWhenEmpty = false,
  className,
}: {
  entries: DemoCallLogEntry[];
  showWhenEmpty?: boolean;
  className?: string;
}) {
  const issues = useMemo(
    () => entries.filter((entry) => entry.level === "warn" || entry.level === "error"),
    [entries],
  );

  if (issues.length === 0 && !showWhenEmpty) return null;

  return (
    <AdminSectionCard
      title="Issues"
      description="Errors and warnings only. Tool calls appear in the transcript above."
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      className={cn("flex min-h-0 flex-col", className)}
    >
      {issues.length === 0 ? (
        <p className="px-5 py-3 text-sm text-gray-500">No issues yet.</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto px-5 py-3">
          {issues.map((entry) => (
            <li key={entry.id} className="py-2.5 text-sm leading-snug">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-xs text-gray-500">
                  {formatElapsed(entry.atMs)}
                </span>
                <span className="text-xs text-gray-400">[{entry.tag}]</span>
              </div>
              <p className={cn("mt-0.5", logLevelClass(entry.level))}>{entry.message}</p>
            </li>
          ))}
        </ul>
      )}
    </AdminSectionCard>
  );
}

export function DemoCallRoomTelemetry({
  sessionStartedAt,
  sessionEndedAt,
  log,
}: {
  sessionStartedAt: number;
  sessionEndedAt?: number | null;
  log: ReturnType<typeof useDemoCallEngineeringLog>;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [elapsedMs, setElapsedMs] = useState(0);
  const agentJoinedRef = useRef(false);
  const audioTrackRef = useRef(false);
  const logAppendRef = useRef(log.append);
  const logSetMetricsRef = useRef(log.setMetrics);

  useEffect(() => {
    logAppendRef.current = log.append;
    logSetMetricsRef.current = log.setMetrics;
  }, [log.append, log.setMetrics]);

  useEffect(() => {
    if (sessionEndedAt != null) {
      setElapsedMs(Math.max(0, sessionEndedAt - sessionStartedAt));
      return;
    }
    const tick = () => setElapsedMs(Date.now() - sessionStartedAt);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [sessionEndedAt, sessionStartedAt]);

  useEffect(() => {
    const markAgentJoined = (ms: number) => {
      if (agentJoinedRef.current) return;
      agentJoinedRef.current = true;
      logSetMetricsRef.current((prev) => ({ ...prev, agentJoinMs: ms }));
      logAppendRef.current("success", "agent", `Voice worker joined (${formatSecondsShort(ms)})`);
    };

    const onConnected = () => {
      logAppendRef.current("success", "livekit", "Room connected");
      if (room.remoteParticipants.size > 0) {
        markAgentJoined(Date.now() - sessionStartedAt);
      }
    };
    const onReconnecting = () => {
      logAppendRef.current("warn", "livekit", "Reconnecting…");
    };
    const onDisconnected = () => {
      logAppendRef.current("info", "livekit", "Room disconnected");
    };
    const onParticipantConnected = () => {
      if (room.remoteParticipants.size <= 0) return;
      markAgentJoined(Date.now() - sessionStartedAt);
    };
    const onTrackSubscribed = (
      track: Track,
      _pub: unknown,
      participant: { isLocal: boolean },
    ) => {
      if (participant.isLocal || track.kind !== Track.Kind.Audio) return;
      if (audioTrackRef.current) return;
      audioTrackRef.current = true;
      const ms = Date.now() - sessionStartedAt;
      logSetMetricsRef.current((prev) => ({ ...prev, audioTrackMs: ms }));
      markAgentJoined(ms);
      logAppendRef.current("success", "audio", `Agent audio track ready (${formatSecondsShort(ms)})`);
    };
    const onMediaDevicesError = (error: Error) => {
      logAppendRef.current("error", "media", error.message);
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

    if (room.state === ConnectionState.Connected) {
      onConnected();
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, sessionStartedAt]);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || sessionEndedAt != null) return;

    // Keep only numeric audio counters locally: never log the full RTC report,
    // which can contain participant/track identifiers and network addresses.
    type AudioCounters = Pick<RTCInboundRtpStreamStats,
      "timestamp" | "packetsReceived" | "packetsLost" | "concealedSamples" |
      "silentConcealedSamples" | "concealmentEvents" | "totalSamplesReceived" |
      "jitterBufferDelay" | "jitterBufferEmittedCount"
    >;
    const previous = new WeakMap<RemoteAudioTrack, Map<string, AudioCounters>>();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastWarningAt = -Infinity;
    let unavailableLogged = false;
    let saveWarningLogged = false;
    let pendingSamples: TransportSample[] = [];
    let saving = false;
    const streams = new WeakMap<RemoteAudioTrack, Map<string, string>>();
    const flush = async (final = false) => {
      if ((!final && saving) || !pendingSamples.length) return;
      saving = true;
      const batch = pendingSamples.splice(0, 40);
      try {
        const response = await fetch("/api/admin/demo-call/transport", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: final,
          body: JSON.stringify({ roomName: room.name, samples: batch }),
        });
        if (!response.ok) {
          console.warn("[demo-call-transport] upload_rejected", { status: response.status });
          throw new Error("Telemetry upload failed");
        }
      } catch {
        pendingSamples = [...batch, ...pendingSamples].slice(-120);
        if (!saveWarningLogged) {
          saveWarningLogged = true;
          logAppendRef.current("warn", "telemetry", "Browser measurements could not be saved; retrying while the call is active.");
        }
      } finally { saving = false; }
    };

    const delta = (current: number | undefined, prior: number | undefined) =>
      current != null && prior != null && Number.isFinite(current) &&
      Number.isFinite(prior) && current >= prior ? current - prior : null;
    const round = (value: number) => Math.round(value * 100) / 100;
    const active = () => !cancelled && room.state === ConnectionState.Connected;

    const sample = async () => {
      if (!active()) return;
      try {
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.audioTrackPublications.values()) {
            const track = publication.track;
            if (!(track instanceof RemoteAudioTrack) || !publication.isSubscribed) continue;
            const receiver = track.receiver;
            const stillCurrent = () => active() && !!receiver && track.receiver === receiver &&
              publication.track === track && publication.isSubscribed &&
              track.mediaStreamTrack.readyState === "live" &&
              room.remoteParticipants.get(participant.identity) === participant;
            if (!stillCurrent()) continue;

            let report: RTCStatsReport | undefined;
            try {
              report = await track.getRTCStatsReport();
            } catch {
              // A receiver can disappear while getStats is pending.
              if (stillCurrent() && !unavailableLogged) {
                unavailableLogged = true;
                logAppendRef.current("info", "audio_stats", "Browser audio statistics are unavailable");
              }
              continue;
            }
            if (!stillCurrent() || !report) continue;

            let roundTripMs: number | null = null;
            report.forEach((entry: RTCStats & { selectedCandidatePairId?: string }) => {
              if (entry.type !== "transport" || !entry.selectedCandidatePairId) return;
              const pair = report.get(entry.selectedCandidatePairId) as RTCIceCandidatePairStats | undefined;
              if (pair?.currentRoundTripTime != null && Number.isFinite(pair.currentRoundTripTime)) roundTripMs = round(pair.currentRoundTripTime * 1000);
            });
            const trackStreams = streams.get(track) ?? new Map<string, string>();
            streams.set(track, trackStreams);
            const trackCounters = previous.get(track) ?? new Map<string, AudioCounters>();
            previous.set(track, trackCounters);
            report.forEach((stat: RTCInboundRtpStreamStats) => {
              if (stat.type !== "inbound-rtp" || stat.kind !== "audio") return;
              const current: AudioCounters = {
                timestamp: stat.timestamp,
                packetsReceived: stat.packetsReceived,
                packetsLost: stat.packetsLost,
                concealedSamples: stat.concealedSamples,
                silentConcealedSamples: stat.silentConcealedSamples,
                concealmentEvents: stat.concealmentEvents,
                totalSamplesReceived: stat.totalSamplesReceived,
                jitterBufferDelay: stat.jitterBufferDelay,
                jitterBufferEmittedCount: stat.jitterBufferEmittedCount,
              };
              const prior = trackCounters.get(stat.id);
              trackCounters.set(stat.id, current);
              if (!prior || (current.packetsReceived != null && prior.packetsReceived != null && current.packetsReceived < prior.packetsReceived)) {
                trackStreams.set(stat.id, crypto.randomUUID());
                return;
              }

              const intervalMs = delta(current.timestamp, prior.timestamp);
              if (intervalMs == null || intervalMs === 0) return;
              const counters = {
                packetsReceived: delta(current.packetsReceived, prior.packetsReceived),
                packetsLost: delta(current.packetsLost, prior.packetsLost),
                concealedSamples: delta(current.concealedSamples, prior.concealedSamples),
                silentConcealedSamples: delta(current.silentConcealedSamples, prior.silentConcealedSamples),
                concealmentEvents: delta(current.concealmentEvents, prior.concealmentEvents),
                totalSamplesReceived: delta(current.totalSamplesReceived, prior.totalSamplesReceived),
                jitterBufferDelay: delta(current.jitterBufferDelay, prior.jitterBufferDelay),
                jitterBufferEmittedCount: delta(current.jitterBufferEmittedCount, prior.jitterBufferEmittedCount),
              };
              const atMs = Date.now() - sessionStartedAt;
              const packetTotal = counters.packetsLost != null && counters.packetsReceived != null ? counters.packetsLost + counters.packetsReceived : 0;
              const measurement: TransportSample = {
                id: crypto.randomUUID(), stream: trackStreams.get(stat.id) ?? crypto.randomUUID(), atMs, intervalMs,
                connectionQuality: room.localParticipant.connectionQuality,
                packetLossPercent: packetTotal > 0 && counters.packetsLost != null ? round(100 * counters.packetsLost / packetTotal) : null,
                jitterMs: stat.jitter != null && Number.isFinite(stat.jitter) ? round(stat.jitter * 1000) : null,
                roundTripMs,
                concealmentPercent: counters.concealedSamples != null && counters.totalSamplesReceived != null && counters.totalSamplesReceived > 0 ? round(100 * counters.concealedSamples / counters.totalSamplesReceived) : null,
                averageJitterBufferMs: counters.jitterBufferDelay != null && counters.jitterBufferEmittedCount != null && counters.jitterBufferEmittedCount > 0 ? round(1000 * counters.jitterBufferDelay / counters.jitterBufferEmittedCount) : null,
              };
              pendingSamples.push(measurement);
              console.info("[demo-call-audio]", JSON.stringify({
                roomName: room.name,
                measurement,
                atMs,
                intervalMs: round(intervalMs),
                jitterMs: stat.jitter != null && Number.isFinite(stat.jitter) ? round(stat.jitter * 1000) : null,
                ...counters,
                averageJitterBufferMs: counters.jitterBufferDelay != null &&
                  counters.jitterBufferEmittedCount != null && counters.jitterBufferEmittedCount > 0
                  ? round(1000 * counters.jitterBufferDelay / counters.jitterBufferEmittedCount) : null,
              }));

              if (((counters.packetsLost ?? 0) > 0 || (counters.concealmentEvents ?? 0) > 0) &&
                atMs - lastWarningAt >= 15_000) {
                lastWarningAt = atMs;
                logAppendRef.current("warn", "audio_stats",
                  `Audio delivery at ${formatElapsed(atMs)}: ${counters.packetsLost ?? "unknown"} lost packets, ${counters.concealmentEvents ?? "unknown"} concealment events in ${(intervalMs / 1000).toFixed(1)}s. Numeric details are in the browser console.`,
                  atMs,
                );
              }
            });
          }
        }
      } finally {
        // Schedule after completion so slow getStats calls never overlap.
        if (pendingSamples.length >= 5) await flush();
        if (active()) timer = setTimeout(() => void sample(), 1_000);
      }
    };

    logAppendRef.current("info", "audio_stats", "Audio delivery diagnostics enabled; saving numeric browser statistics every second");
    void sample();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void flush(true);
    };
  }, [connectionState, room, sessionEndedAt, sessionStartedAt]);

  return (
    <DemoCallEngineeringLogPanel
      entries={log.entries}
      metrics={log.metrics}
      connectionState={connectionState}
      elapsedMs={elapsedMs}
      sessionEndedAt={sessionEndedAt}
      live={sessionEndedAt == null}
    />
  );
}
