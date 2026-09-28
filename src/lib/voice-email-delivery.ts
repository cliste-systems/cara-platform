import { createHash } from "node:crypto";

type Claim = { status: string; id?: string; lease_token?: string };
type DeliveryInput = { organizationId: string; callSessionId: string; to: string; subject: string; text: string };
type Dependencies = {
  claim: (input: { organizationId: string; callSessionId: string; recipientHash: string; contentHash: string }) => Promise<unknown>;
  send: (input: { to: string; subject: string; text: string; idempotencyKey: string }) => Promise<{ ok: boolean }>;
  finish: (id: string, leaseToken: string, status: "sent" | "failed") => Promise<void>;
};
export type VoiceEmailDeliveryResult = { ok: true; duplicate?: true } | { ok: false; code: string; status: number };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Budgets and provider deduplication survive retries and worker restarts. */
export async function deliverVoiceEmail(input: DeliveryInput, deps: Dependencies): Promise<VoiceEmailDeliveryResult> {
  let claim: Claim;
  try {
    const raw = await deps.claim({
      organizationId: input.organizationId,
      callSessionId: input.callSessionId,
      recipientHash: digest(input.to.trim().toLowerCase()),
      contentHash: digest(JSON.stringify([input.subject, input.text])),
    });
    if (!raw || typeof raw !== "object" || !("status" in raw)) throw new Error("Invalid claim");
    claim = raw as Claim;
  } catch {
    return { ok: false, code: "delivery_unavailable", status: 503 };
  }
  if (claim.status === "duplicate") return { ok: true, duplicate: true };
  if (claim.status === "limited") return { ok: false, code: "email_limit_reached", status: 429 };
  if (claim.status === "in_progress") return { ok: false, code: "delivery_in_progress", status: 409 };
  if (claim.status === "invalid_session" || claim.status === "expired" || claim.status === "invalid") {
    return { ok: false, code: "invalid_call_session", status: 403 };
  }
  if (claim.status !== "claimed" || !claim.id || !uuid.test(claim.id) || !claim.lease_token || !uuid.test(claim.lease_token)) {
    return { ok: false, code: "delivery_unavailable", status: 503 };
  }
  const { id, lease_token: leaseToken } = claim;
  let sent = false;
  try {
    const result = await deps.send({ to: input.to, subject: input.subject, text: input.text, idempotencyKey: `voice-email/${id}` });
    sent = result.ok === true;
  } catch {
    // A timeout can follow a successful provider send. Retry with the same key.
  }
  try {
    await deps.finish(id, leaseToken, sent ? "sent" : "failed");
  } catch {
    return { ok: false, code: "delivery_unavailable", status: 503 };
  }
  return sent ? { ok: true } : { ok: false, code: "send_failed", status: 502 };
}
