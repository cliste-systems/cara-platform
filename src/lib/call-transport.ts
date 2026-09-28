export const TRANSPORT_METRICS = ["atMs", "intervalMs", "packetLossPercent", "jitterMs", "roundTripMs", "concealmentPercent", "averageJitterBufferMs"] as const;
export type TransportSample = { id: string; stream: string; connectionQuality: string } & Record<(typeof TRANSPORT_METRICS)[number], number | null>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseTransportBatch(value: unknown): { roomName: string; samples: TransportSample[] } {
  if (!value || typeof value !== "object") throw new Error("Invalid telemetry.");
  const data = value as Record<string, unknown>;
  if (typeof data.roomName !== "string" || !data.roomName.startsWith("admin-demo-") || !uuid.test(data.roomName.slice(11))) throw new Error("Invalid room.");
  if (!Array.isArray(data.samples) || !data.samples.length || data.samples.length > 40) throw new Error("Invalid sample count.");
  const samples = data.samples.map((raw): TransportSample => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid sample.");
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || !uuid.test(row.id) || typeof row.stream !== "string" || !uuid.test(row.stream)) throw new Error("Invalid sample ID.");
    const clean = { id: row.id, stream: row.stream, connectionQuality: ["excellent", "good", "poor", "lost"].includes(String(row.connectionQuality)) ? String(row.connectionQuality) : "unknown" } as TransportSample;
    for (const key of TRANSPORT_METRICS) {
      const n = row[key];
      if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 86400000)) throw new Error("Invalid measurement.");
      if ((key === "packetLossPercent" || key === "concealmentPercent") && typeof n === "number" && n > 100) throw new Error("Invalid percentage.");
      clean[key] = n as number | null;
    }
    if (clean.atMs === null || clean.intervalMs === null || clean.intervalMs <= 0) throw new Error("Missing sample timing.");
    return clean;
  });
  return { roomName: data.roomName, samples };
}
