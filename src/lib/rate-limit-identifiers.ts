import { createHash } from "node:crypto";
import { isIP } from "node:net";

const DEFAULT_SALT = "cliste-auth-rate-limit-dev";

export function hashRateLimitIdentifier(raw: string): string {
  const salt = process.env.AUTH_RATE_LIMIT_SALT?.trim() || DEFAULT_SALT;
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex");
}

/**
 * Vercel replaces these headers at ingress. Never trust caller-supplied
 * Cloudflare/real-IP headers, or forwarded headers on an unconfigured host.
 * Without a trusted ingress all requests share a bucket instead of bypassing it.
 * https://vercel.com/docs/headers/request-headers
 */
export function trustedClientIp(
  headersList: Headers,
  isVercel = process.env.VERCEL === "1",
): string {
  if (!isVercel) return "unknown-network";
  const raw = (
    headersList.get("x-vercel-forwarded-for") ??
    headersList.get("x-forwarded-for") ??
    ""
  ).trim();
  const kind = isIP(raw);
  if (kind === 4) return raw;
  if (kind === 6) return new URL(`http://[${raw}]/`).hostname.toLowerCase();
  return "unknown-network";
}

/** Stable network bucket; hint names the operation, never the browser. */
export function rateLimitFingerprint(headersList: Headers, hint?: string | null): string {
  const scope = hint?.trim().toLowerCase() || "auth";
  return hashRateLimitIdentifier(`ip:${scope}:${trustedClientIp(headersList)}`);
}

/** Account throttling must survive a change of network, proxy, or browser. */
export function emailRateLimitFingerprint(email: string, scope = "auth-email"): string {
  return hashRateLimitIdentifier(`${scope}:${email.trim().toLowerCase()}`);
}

/** actorKey must come from a verified session (user ID or organisation ID). */
export function actorRateLimitFingerprint(actorKey: string): string {
  if (!actorKey.trim()) throw new Error("A verified rate-limit actor is required.");
  return hashRateLimitIdentifier(`actor:${actorKey.trim().toLowerCase()}`);
}
