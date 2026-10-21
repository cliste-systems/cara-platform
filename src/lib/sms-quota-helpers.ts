/** Staff/owner alerts on the platform sender — not part of the caller SMS allowance. */
export const SMS_PURPOSES_EXCLUDED_FROM_CALLER_QUOTA = [
  "action_inbox_notify",
  "owner_call_alert",
  "cara_training_notify",
] as const;

export function isCallerFacingSmsPurpose(purpose: string | null | undefined): boolean {
  const value = (purpose ?? "").trim() || "outbound";
  return !(SMS_PURPOSES_EXCLUDED_FROM_CALLER_QUOTA as readonly string[]).includes(
    value,
  );
}

export function sumCallerFacingSmsSegments(
  rows: Array<{ segments?: number | null; purpose?: string | null }> | null | undefined,
): number {
  let usedSegments = 0;
  for (const row of rows ?? []) {
    if (!isCallerFacingSmsPurpose(row.purpose)) continue;
    const segments = row.segments;
    usedSegments +=
      typeof segments === "number" ? Math.max(0, segments) : 0;
  }
  return usedSegments;
}
