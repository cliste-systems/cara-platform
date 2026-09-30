export type TechnicalCheck = {
  id: string;
  label: string;
  value: string;
  expected: string;
  status: "pass" | "fail" | "unknown";
  detail: string;
};
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Deterministic results from saved evidence; absence never counts as a pass. */
export function buildCallTechnicalHealth(diagnostics: unknown, postCallStatus: string | null, transport: unknown[] = [], transportComplete = true): TechnicalCheck[] {
  const data = record(diagnostics);
  const latency = record(data.latency);
  const replyTiming = record(latency.replyTiming);
  const capture = record(data.transcriptCapture);
  const events = Array.isArray(data.events) ? data.events.map(record).filter(event => !String(event.tag ?? "").startsWith("inferred_") && record(event.data).source !== "server_inferred") : null;
  const toolErrors = events?.filter(event => event.level === "error" && /tool/i.test(String(event.tag))) ?? [];
  const incidents = Array.isArray(data.pipelineIncidents) ? data.pipelineIncidents : [];
  const replies = Array.isArray(latency.replyMs) ? latency.replyMs.filter(numeric) : [];
  const sortedReplies = [...replies].sort((a, b) => a - b);
  const middle = Math.floor(sortedReplies.length / 2);
  const median = numeric(latency.replyP50) ? latency.replyP50 : sortedReplies.length ? sortedReplies.length % 2 ? sortedReplies[middle] : (sortedReplies[middle - 1] + sortedReplies[middle]) / 2 : null;
  const missing = (id: string, label: string, expected: string, detail: string): TechnicalCheck => ({ id, label, expected, detail, value: "Not captured", status: "unknown" });
  const checks: TechnicalCheck[] = [
    missing("connection", "Connection quality", "Good or excellent", "No saved LiveKit connection-quality measurement for this call."),
    missing("packet_loss", "WebRTC packet loss", "No sustained loss > 1%", "No saved receiver samples. The 1% threshold is the proposed monitoring limit; this call has not been graded against it."),
    missing("jitter", "Network jitter", "No sustained jitter > 30 ms", "No saved jitter samples. The 30 ms threshold is the proposed monitoring limit."),
    missing("rtt", "Network round-trip time", "No sustained delay > 400 ms", "No saved round-trip samples. The 400 ms threshold is the proposed monitoring limit."),
    missing("concealment", "Audio concealment", "Below 1%", "Provisional HelloCara target. No saved received-audio sample counters; caller-device playback is not measured for phone calls."),
    missing("buffer", "Jitter-buffer delay", "Below 100 ms", "Provisional HelloCara target. No saved buffer-delay measurements for this call."),
    {
      id: "response", label: "Cara response time", value: median === null ? "Not captured" : `${(median / 1000).toFixed(2)} s`,
      expected: "Median ≤ 1.5 s", status: median === null || replyTiming.captureComplete === false ? "unknown" : median <= 1500 ? "pass" : "fail",
      detail: `${replyTiming.source === "caller_vad_to_worker_audio" ? "Caller speech ending to Cara’s response audio entering the worker output. Greeting and overlapping speech are excluded." : "Agent reply latency. This does not measure when the caller heard audio."}${replies.length ? ` ${replies.length} measured replies; slowest ${(Math.max(...replies) / 1000).toFixed(2)} s.` : " No response timings were recorded for this call."}${replyTiming.captureComplete === false ? " Timing coverage is partial." : ""}`,
    },
    {
      id: "tools", label: "Tool failures", value: toolErrors.length ? String(toolErrors.length) : events ? "0 recorded" : "Not captured", expected: "0",
      status: toolErrors.length ? "fail" : data.toolEventCoverageComplete === true ? "pass" : "unknown",
      detail: toolErrors.length ? toolErrors.map(event => String(event.message ?? "Tool error")).slice(0, 3).join(" · ") : data.toolEventCoverageComplete === true ? "Complete tool-event coverage confirms no recorded failures." : "No failures recorded. Complete tool-event coverage is not confirmed by the saved diagnostics.",
    },
    {
      id: "pipeline", label: "Voice pipeline incidents", value: incidents.length ? String(incidents.length) : data.incidentListComplete === true ? "0" : "Not captured", expected: "0",
      status: incidents.length ? "fail" : data.incidentListComplete === true ? "pass" : "unknown",
      detail: incidents.length ? incidents.slice(0, 3).map(incident => String(record(incident).error_message ?? "Voice pipeline incident")).join(" · ") : "Saved incidents matched to this call. Missing coverage is not treated as a clean result.",
    },
    {
      id: "capture", label: "Transcript capture", value: capture.status === "captured" ? "Captured" : capture.status === "partial" ? "Incomplete" : "Not captured", expected: "Complete event sequence",
      status: capture.status === "partial" ? "fail" : capture.status === "captured" && numeric(capture.expectedEventCount) && capture.expectedEventCount > 0 && capture.expectedEventCount === capture.persistedEventCount && capture.sequenceContinuous === true && capture.hasCaller === true && capture.hasAssistant === true && capture.readableConversationComplete !== false ? "pass" : "unknown",
      detail: "Checks saved event counts, sequence continuity, and speech from both participants.",
    },
    {
      id: "audio", label: "Static, clipping and distortion", value: record(data.audioQuality).measured === true ? String(record(data.audioQuality).status ?? "Unknown") : "Not captured", expected: "Measured audio quality",
      status: record(data.audioQuality).measured === true && ["fail", "poor", "distorted", "clipped", "static"].includes(String(record(data.audioQuality).status)) ? "fail" : record(data.audioQuality).measured === true && ["pass", "clear", "good"].includes(String(record(data.audioQuality).status)) ? "pass" : "unknown",
      detail: "Only explicit audio-quality measurements can establish waveform health. A transcript or good network connection cannot rule out static, clipping or distortion. Use the recording to check unmeasured audio.",
    },
    {
      id: "processing", label: "Post-call processing", value: postCallStatus === "complete" ? "Complete" : postCallStatus === "partial" ? "Partial" : postCallStatus === "failed" ? "Failed" : postCallStatus === "pending" ? "Pending" : "Not captured", expected: "Complete",
      status: postCallStatus === "complete" ? "pass" : postCallStatus === "partial" || postCallStatus === "failed" ? "fail" : "unknown",
      detail: "Recorded processing status for this call; independent of the conversation outcome.",
    },
  ];
  const samples = transport.map(record).filter(sample => numeric(sample.atMs) && numeric(sample.intervalMs)).sort((a, b) => Number(a.atMs) - Number(b.atMs));
  const recovered = samples.some(sample => sample.recoveredFrom === "next-development-log");
  const complete = transportComplete && !recovered;
  const rules = [
    { id: "packet_loss", key: "packetLossPercent", limit: 1, unit: "%", sustained: true },
    { id: "jitter", key: "jitterMs", limit: 30, unit: " ms", sustained: true },
    { id: "rtt", key: "roundTripMs", limit: 400, unit: " ms", sustained: true },
    { id: "concealment", key: "concealmentPercent", limit: 1, unit: "%", sustained: false },
    { id: "buffer", key: "averageJitterBufferMs", limit: 100, unit: " ms", sustained: false },
  ];
  for (const rule of rules) {
    const measured = samples.filter(sample => numeric(sample[rule.key]));
    if (!measured.length) continue;
    const peak = Math.max(...measured.map(sample => Number(sample[rule.key])));
    const windows = new Map<string, Record<string, unknown>[]>();
    let failed = false, completeWindows = 0;
    for (const sample of measured) {
      const stream = String(sample.stream);
      let window = windows.get(stream) ?? [];
      const previous = window.at(-1);
      if (Number(sample.intervalMs) > 2500 || (previous && Number(sample.atMs) - Number(previous.atMs) > 2500)) window = [];
      window = [...window, sample].slice(-5);
      windows.set(stream, window);
      if (window.length === 5) completeWindows++;
      if (rule.sustained ? window.length === 5 && window.filter(entry => Number(entry[rule.key]) > rule.limit).length >= 3 : Number(sample[rule.key]) >= rule.limit) failed = true;
    }
    Object.assign(checks.find(check => check.id === rule.id)!, {
      value: `${peak.toFixed(1)}${rule.unit}`,
      status: failed ? "fail" : complete && (!rule.sustained || completeWindows > 0) ? "pass" : "unknown",
      detail: `Peak measured value across ${measured.length} samples. Browser receiving Cara’s audio from LiveKit; this does not measure a telephone caller’s device. ${rule.sustained ? "Fails when 3 of 5 consecutive samples exceed the monitoring limit." : "Provisional HelloCara target; any measured breach is retained."}${recovered ? " Recovered from this call’s browser logs after an upload failure. Coverage is partial, so these measurements cannot certify the whole call." : transportComplete ? "" : " Only part of the saved sample set is available."}`,
    });
  }
  const quality = samples.map(sample => String(sample.connectionQuality)).filter(value => ["excellent", "good", "poor", "lost"].includes(value));
  if (quality.length) {
    const worst = quality.includes("lost") ? "lost" : quality.includes("poor") ? "poor" : quality.includes("good") ? "good" : "excellent";
    Object.assign(checks.find(check => check.id === "connection")!, { value: worst[0].toUpperCase() + worst.slice(1), status: worst === "lost" || worst === "poor" ? "fail" : complete ? "pass" : "unknown", detail: "Worst LiveKit-reported connection quality observed on the browser participant. A recovered connection does not erase an earlier poor or lost state." });
  }
  return checks;
}
