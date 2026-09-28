/**
 * Match the browser's origin to the request's public Host header. Next can build
 * request.url with the listen address (for example 0.0.0.0 in development), so
 * its hostname is not necessarily the address the browser used.
 *
 * Forwarded host headers are deliberately ignored: they require a separately
 * configured, trusted proxy boundary before they can be used for this check.
 */
export function isSameOriginRequest(request: Pick<Request, "url" | "headers">): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || /[\s,/@\\?#]/.test(host)) return false;

  try {
    const requestUrl = new URL(request.url);
    if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") return false;
    const originUrl = new URL(origin);
    // Only a serialized origin is accepted, never a URL with a path or credentials.
    if (origin !== originUrl.origin) return false;
    return origin === new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch {
    return false;
  }
}
