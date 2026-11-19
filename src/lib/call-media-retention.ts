/** Matches `/api/cron/data-retention` — transcript + recording deleted after 30 days. */
export const CALL_MEDIA_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function callMediaRetentionExpiresAt(createdAt: string): Date | null {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + CALL_MEDIA_RETENTION_MS);
}

export function callMediaRetentionRemainingMs(
  createdAt: string,
  now: Date = new Date(),
): number | null {
  const expiresAt = callMediaRetentionExpiresAt(createdAt);
  if (!expiresAt) return null;
  return expiresAt.getTime() - now.getTime();
}

function formatExpiryDate(expiresAt: Date): string {
  return expiresAt.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isCallMediaRetentionExpired(
  createdAt: string,
  now: Date = new Date(),
): boolean {
  const remainingMs = callMediaRetentionRemainingMs(createdAt, now);
  return remainingMs !== null && remainingMs <= 0;
}

export function formatCallMediaRetentionExpiredMessage(createdAt: string): string {
  const expiresAt = callMediaRetentionExpiresAt(createdAt);
  const dateLabel = expiresAt ? formatExpiryDate(expiresAt) : "30 days after the call";
  return `Recording and transcript access expired on ${dateLabel} (30-day retention).`;
}

function formatRemainingLabel(remainingMs: number): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(remainingMs / dayMs);
  const hours = Math.floor((remainingMs % dayMs) / hourMs);

  if (days >= 2) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (hours >= 2) return `${hours} hours left`;
  if (hours === 1) return "1 hour left";

  const minutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  return `${minutes} minute${minutes === 1 ? "" : "s"} left`;
}

/** Compact single-line label for the detail footer. */
export function formatCallMediaRetentionFooter(
  createdAt: string,
  now: Date = new Date(),
): string | null {
  const remainingMs = callMediaRetentionRemainingMs(createdAt, now);
  if (remainingMs === null || remainingMs <= 0) return null;

  const expiresAt = callMediaRetentionExpiresAt(createdAt);
  if (!expiresAt) return null;

  return `Deletes ${formatExpiryDate(expiresAt)} · ${formatRemainingLabel(remainingMs)}`;
}

/**
 * Human-readable countdown for call recording + transcript retention.
 * Returns null once media has passed the 30-day cutoff.
 */
export function formatCallMediaRetentionCountdown(
  createdAt: string,
  now: Date = new Date(),
): string | null {
  const remainingMs = callMediaRetentionRemainingMs(createdAt, now);
  if (remainingMs === null || remainingMs <= 0) return null;

  const expiresAt = callMediaRetentionExpiresAt(createdAt);
  if (!expiresAt) return null;

  const dateLabel = formatExpiryDate(expiresAt);
  return `Recording & transcript auto-delete on ${dateLabel} · ${formatRemainingLabel(remainingMs)}`;
}

/** Refresh interval for live countdown UI. */
export function callMediaRetentionRefreshMs(
  createdAt: string,
  now: Date = new Date(),
): number | null {
  const remainingMs = callMediaRetentionRemainingMs(createdAt, now);
  if (remainingMs === null || remainingMs <= 0) return null;
  return remainingMs < 2 * 24 * 60 * 60 * 1000 ? 60_000 : 3_600_000;
}
