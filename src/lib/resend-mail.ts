/**
 * Transactional email via Resend HTTP API.
 *
 * Signup confirmation, team invites, owner notifications, and system notices
 * are sent through this module. HelloCara defaults to hello@hellocara.ie for
 * general transactional mail; billing-specific flows can override the sender.
 *
 * Env (Vercel / `.env.local`):
 * - `RESEND_API_KEY` — API key with send permission
 * - `RESEND_FROM_EMAIL` — optional general sender override
 * - `RESEND_FROM_NAME` — optional display name override
 * - `RESEND_BILLING_EMAIL` — optional billing sender override
 * - `RESEND_BILLING_NAME` — optional billing display name override
 */

import { Resend } from "resend";

import { PRODUCT_NAME } from "@/lib/company-details";

const DEFAULT_FROM_EMAIL = "hello@hellocara.ie";
const DEFAULT_BILLING_EMAIL = "billing@hellocara.ie";
const DEFAULT_BILLING_NAME = "HelloCara Billing";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export type EmailAddress = {
  email: string;
  name?: string;
};

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Override platform From (e.g. per-business `{slug}@hellocara.ie`). */
  from?: EmailAddress;
  replyTo?: EmailAddress;
  /** Stable key for retrying the exact same provider payload. */
  idempotencyKey?: string;
  attachments?: { filename: string; content: Buffer; contentId?: string }[];
};

export type SendTransactionalEmailResult =
  | { ok: true }
  | { ok: false; message: string };

export function helloCaraBillingSender(): EmailAddress {
  return {
    email:
      process.env.RESEND_BILLING_EMAIL?.trim().toLowerCase() ||
      DEFAULT_BILLING_EMAIL,
    name: process.env.RESEND_BILLING_NAME?.trim() || DEFAULT_BILLING_NAME,
  };
}

function formatFromAddress(email: string, name: string): string {
  const safeName = name.replace(/"/g, '\\"').trim();
  return safeName ? `${safeName} <${email}>` : email;
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const client = getResendClient();
  const configuredFromEmail =
    process.env.RESEND_FROM_EMAIL?.trim().toLowerCase();
  const platformFromEmail =
    !configuredFromEmail || configuredFromEmail === "brendan@hellocara.ie"
      ? DEFAULT_FROM_EMAIL
      : configuredFromEmail;
  const configuredFromName = process.env.RESEND_FROM_NAME?.trim();
  const platformFromName =
    configuredFromName &&
    !/^hello\s*cara$/i.test(configuredFromName) &&
    !/^brendan$/i.test(configuredFromName)
      ? configuredFromName
      : PRODUCT_NAME;
  const fromEmail = input.from?.email.trim() || platformFromEmail;
  const fromName = input.from?.name?.trim() || platformFromName;

  if (!client) {
    return { ok: false, message: "RESEND_API_KEY is not configured." };
  }
  const to = input.to.trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, message: "Invalid recipient email." };
  }

  const subject = input.subject.trim();
  if (!subject) {
    return { ok: false, message: "Subject is required." };
  }

  const { error } = await client.emails.send({
    from: formatFromAddress(fromEmail, fromName),
    to: [to],
    subject,
    text: input.text,
    ...(input.attachments ? { attachments: input.attachments } : {}),
    ...(input.html ? { html: input.html } : {}),
    ...(input.replyTo?.email.trim()
      ? {
          replyTo: input.replyTo.name?.trim()
            ? formatFromAddress(
                input.replyTo.email.trim(),
                input.replyTo.name.trim(),
              )
            : input.replyTo.email.trim(),
        }
      : {}),
  }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined);

  if (!error) {
    return { ok: true };
  }

  const detail = error.message?.trim() || "Unknown Resend error.";
  const detailLower = detail.toLowerCase();
  if (
    detailLower.includes("daily quota") ||
    detailLower.includes("rate limit") ||
    detailLower.includes("quota")
  ) {
    return {
      ok: false,
      message:
        "Email sending limit reached on Resend. Check your Resend plan or wait for credits to reset, then try again.",
    };
  }

  return {
    ok: false,
    message: `Resend error: ${detail}`,
  };
}
