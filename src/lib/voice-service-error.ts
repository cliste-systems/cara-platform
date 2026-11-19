/** Public errors must not contain provider responses, credentials or deployment details. */
export function voiceServiceError(error: unknown): { error: string; status: 502 | 503 } {
  const message = error instanceof Error ? error.message : "";
  const unavailable = /not configured|not set|missing .*key/i.test(message);
  return {
    error: "Voice preview is temporarily unavailable. Please try again shortly.",
    status: unavailable ? 503 : 502,
  };
}
