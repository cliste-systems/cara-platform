/** Set when admin uses "Open dashboard"; sidebar shows "dev" instead of the salon user's name. */
export const SUPPORT_DASHBOARD_COOKIE = "cliste_support_dashboard";
const SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS = 60 * 60 * 8;
const SUPPORT_DASHBOARD_COOKIE_PREFIX = "support-dashboard";

function getSupportDashboardSigningSecret(): string | null {
  return (
    process.env.CLISTE_SUPPORT_DASHBOARD_SECRET?.trim() ||
    process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim() ||
    null
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signSupportPayload(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export type SupportDashboardScope = { userId: string; accountId: string; organizationId: string };
const SCOPE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createSupportDashboardCookieValue(scope?: SupportDashboardScope): Promise<string | null> {
  const secret = getSupportDashboardSigningSecret();
  if (!secret) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS;
  if (scope && ![scope.userId, scope.accountId, scope.organizationId].every((id) => SCOPE_UUID_RE.test(id))) return null;
  const fields = scope ? `${expiresAt}.${scope.userId}.${scope.accountId}.${scope.organizationId}` : `${expiresAt}`;
  const payload = `${SUPPORT_DASHBOARD_COOKIE_PREFIX}:${fields}`;
  const sig = await signSupportPayload(payload, secret);
  return `${fields}.${sig}`;
}

export function supportDashboardCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS,
  };
}

/** Scope is authenticated and must additionally match the current user and account. */
export async function readSupportDashboardCookieValue(value: string | null | undefined): Promise<SupportDashboardScope | null> {
  const secret = getSupportDashboardSigningSecret();
  if (!secret || !value) return null;
  const [expiresRaw, userId, accountId, organizationId, signature, extra] = value.split(".");
  if (extra !== undefined || !signature || !/^[0-9a-f]{64}$/.test(signature)) return null;
  if (![userId, accountId, organizationId].every((id) => SCOPE_UUID_RE.test(id ?? ""))) return null;
  const expiresAt = Number(expiresRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS) return null;
  const expected = await signSupportPayload(`${SUPPORT_DASHBOARD_COOKIE_PREFIX}:${expiresRaw}.${userId}.${accountId}.${organizationId}`, secret);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return difference === 0 ? { userId, accountId, organizationId } : null;
}
