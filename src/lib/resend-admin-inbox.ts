import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";

const RESEND_API_BASE = "https://api.resend.com";
const DEFAULT_HELLO_EMAIL = "hello@hellocara.ie";
const DEFAULT_HELLO_NAME = "HelloCara";
const DEFAULT_BILLING_EMAIL = "billing@hellocara.ie";
const DEFAULT_BILLING_NAME = "HelloCara Billing";
const DEFAULT_CLISTE_EMAIL = "hello@clistesystems.ie";
const DEFAULT_CLISTE_NAME = "Cliste Systems";
const LEGACY_HELLO_ADDRESSES = ["brendan@hellocara.ie"] as const;

export type AdminEmailFolder = "inbox" | "archived" | "sent";
export type AdminEmailIdentityKey = "hello" | "billing" | "cliste";
export type AdminEmailDeliveryStatus =
  | "sent"
  | "delayed"
  | "delivered"
  | "opened"
  | "clicked"
  | "complained"
  | "suppressed"
  | "bounced"
  | "failed"
  | "unknown";

export type AdminEmailDeliveryEvent = {
  id: string;
  type: string;
  occurredAt: string;
  detail: string | null;
};

export type AdminEmailIdentity = {
  key: AdminEmailIdentityKey;
  label: string;
  email: string;
  name: string;
};

export type AdminEmailListItem = {
  id: string;
  direction: "inbound" | "outbound";
  parentResendEmailId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  preview: string;
  occurredAt: string;
  readAt: string | null;
  archivedAt: string | null;
  deliveryStatus: AdminEmailDeliveryStatus | null;
  deliveryStatusAt: string | null;
};

export type AdminEmailMessage = AdminEmailListItem & {
  messageId: string | null;
  replyToAddresses: string[];
  ccAddresses: string[];
  textBody: string;
  htmlBody: string | null;
  senderBlocked: boolean;
  attachments: Array<Record<string, unknown>>;
  replies: AdminEmailListItem[];
  deliveryEvents: AdminEmailDeliveryEvent[];
};

type ResendReceivedListItem = {
  id: string;
  to?: string[] | string;
  from?: string;
  created_at?: string;
  subject?: string;
  bcc?: string[] | string;
  cc?: string[] | string;
  reply_to?: string[] | string;
  message_id?: string;
  attachments?: unknown[];
};

type ResendReceivedDetail = ResendReceivedListItem & {
  text?: string | null;
  html?: string | null;
  headers?: unknown;
};

type AdminEmailRow = {
  resend_email_id: string;
  direction: "inbound" | "outbound";
  parent_resend_email_id: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  reply_to_addresses: string[] | null;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  headers: unknown;
  attachments: unknown;
  received_at: string | null;
  sent_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  resend_sent_at: string | null;
  delivered_at: string | null;
  delivery_delayed_at: string | null;
  bounced_at: string | null;
  failed_at: string | null;
  suppressed_at: string | null;
  complained_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  last_delivery_event: string | null;
  last_delivery_event_at: string | null;
  delivery_detail: unknown;
  created_at: string;
};

function resendApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  return key;
}

function normalizeHelloCaraName(value: string | undefined, fallback: string): string {
  const configured = value?.trim();
  if (!configured) return fallback;
  if (/^hello\s*cara$/i.test(configured) || /^brendan$/i.test(configured)) {
    return "HelloCara";
  }
  return configured;
}

export function adminInboxIdentities(): AdminEmailIdentity[] {
  return [
    {
      key: "hello",
      label: "Hello",
      email:
        process.env.RESEND_HELLO_EMAIL?.trim().toLowerCase() ||
        DEFAULT_HELLO_EMAIL,
      name: normalizeHelloCaraName(
        process.env.RESEND_HELLO_NAME || process.env.RESEND_FROM_NAME,
        DEFAULT_HELLO_NAME,
      ),
    },
    {
      key: "billing",
      label: "Billing",
      email:
        process.env.RESEND_BILLING_EMAIL?.trim().toLowerCase() ||
        DEFAULT_BILLING_EMAIL,
      name:
        process.env.RESEND_BILLING_NAME?.trim() || DEFAULT_BILLING_NAME,
    },
    {
      key: "cliste",
      label: "Cliste Systems",
      email:
        process.env.RESEND_CLISTE_EMAIL?.trim().toLowerCase() ||
        DEFAULT_CLISTE_EMAIL,
      name:
        process.env.RESEND_CLISTE_NAME?.trim() || DEFAULT_CLISTE_NAME,
    },
  ];
}

export function isAdminEmailIdentityKey(
  value: string | null | undefined,
): value is AdminEmailIdentityKey {
  return value === "hello" || value === "billing" || value === "cliste";
}

function adminInboxIdentityByKey(
  key: AdminEmailIdentityKey = "hello",
): AdminEmailIdentity {
  return (
    adminInboxIdentities().find((identity) => identity.key === key) ||
    adminInboxIdentities()[0]!
  );
}

function adminInboxIdentityAddresses(key: AdminEmailIdentityKey): Set<string> {
  const identity = adminInboxIdentityByKey(key);
  const addresses = new Set([identity.email.toLowerCase()]);
  if (key === "hello") {
    for (const legacy of LEGACY_HELLO_ADDRESSES) {
      addresses.add(legacy.toLowerCase());
    }
  }
  return addresses;
}

function rowBelongsToIdentity(
  row: AdminEmailRow,
  key: AdminEmailIdentityKey,
): boolean {
  const addresses = adminInboxIdentityAddresses(key);
  if (row.direction === "outbound") {
    return addresses.has(row.from_address.trim().toLowerCase());
  }
  return (row.to_addresses ?? []).some((value) =>
    addresses.has(parseMailbox(value).email),
  );
}

function identityForInboundRecipients(
  recipients: string[],
): AdminEmailIdentity {
  const parsed = recipients.map((value) => parseMailbox(value).email);
  const billing = adminInboxIdentityByKey("billing");
  if (parsed.includes(billing.email.toLowerCase())) return billing;
  const cliste = adminInboxIdentityByKey("cliste");
  if (parsed.includes(cliste.email.toLowerCase())) return cliste;
  return adminInboxIdentityByKey("hello");
}

export function adminInboxFromEmail(): string {
  return adminInboxIdentityByKey("hello").email;
}

export function adminInboxFromName(): string {
  return adminInboxIdentityByKey("hello").name;
}

async function resendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      detail = body.message || body.error?.message || detail;
    } catch {
      // Keep status text.
    }
    throw new Error(`Resend error (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

function asAddressArray(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function parseMailbox(value: string | undefined): {
  name: string | null;
  email: string;
} {
  const raw = value?.trim() || "";
  const match = raw.match(/^\s*(?:"?([^"<]+?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]!.trim().toLowerCase(),
    };
  }
  return { name: null, email: raw.toLowerCase() };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function previewText(value: string | null | undefined, max = 130): string {
  // Plain-text marketing emails often use long decoration lines. Keep the
  // preview focused on the actual message instead of rows of asterisks.
  const normalized = (value ?? "")
    .replace(/[*_=~\-]{4,}/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
}

function plainTextEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return [
    '<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">',
    '<div style="max-width:680px;margin:0 auto;padding:24px;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">',
    escaped,
    "</div>",
    "</body></html>",
  ].join("");
}

function deliveryStatusFromRow(row: AdminEmailRow): {
  status: AdminEmailDeliveryStatus | null;
  at: string | null;
} {
  if (row.direction !== "outbound") return { status: null, at: null };
  if (row.failed_at) return { status: "failed", at: row.failed_at };
  if (row.bounced_at) return { status: "bounced", at: row.bounced_at };
  if (row.suppressed_at) return { status: "suppressed", at: row.suppressed_at };
  if (row.complained_at) return { status: "complained", at: row.complained_at };
  if (row.clicked_at) return { status: "clicked", at: row.clicked_at };
  if (row.opened_at) return { status: "opened", at: row.opened_at };
  if (row.delivered_at) return { status: "delivered", at: row.delivered_at };
  if (row.delivery_delayed_at) {
    return { status: "delayed", at: row.delivery_delayed_at };
  }

  const lastEvent = row.last_delivery_event?.replace(/^email\./, "");
  if (
    lastEvent &&
    [
      "sent",
      "delayed",
      "delivery_delayed",
      "delivered",
      "opened",
      "clicked",
      "complained",
      "suppressed",
      "bounced",
      "failed",
    ].includes(lastEvent)
  ) {
    return {
      status: (lastEvent === "delivery_delayed"
        ? "delayed"
        : lastEvent) as AdminEmailDeliveryStatus,
      at: row.last_delivery_event_at,
    };
  }

  if (row.resend_sent_at || row.sent_at) {
    return { status: "sent", at: row.resend_sent_at || row.sent_at };
  }
  return { status: "unknown", at: row.last_delivery_event_at };
}

function deliveryEventDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidates = [
    record.bounce,
    record.failed,
    record.suppressed,
    record.complaint,
    record.click,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const detail = candidate as Record<string, unknown>;
    for (const key of ["message", "reason", "type", "link"]) {
      const value = detail[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function attachmentFieldString(
  attachment: unknown,
  keys: string[],
): string | null {
  if (!attachment || typeof attachment !== "object") return null;
  const record = attachment as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function attachmentFieldNumber(
  attachment: unknown,
  keys: string[],
): number | null {
  if (!attachment || typeof attachment !== "object") return null;
  const record = attachment as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

async function ensureAttachmentQuarantineRows(
  admin: ReturnType<typeof createAdminClient>,
  resendEmailId: string,
  attachments: unknown[],
): Promise<void> {
  if (attachments.length === 0) return;

  const rows = attachments
    .map((attachment, index) => {
      const attachmentId =
        attachmentFieldString(attachment, ["id", "attachment_id", "attachmentId"]) ||
        `index-${index}`;
      const filename =
        attachmentFieldString(attachment, ["filename", "name"]) ||
        `attachment-${index + 1}`;
      const contentType = attachmentFieldString(attachment, [
        "content_type",
        "contentType",
        "mime_type",
        "mimeType",
      ]);
      const sizeBytes = attachmentFieldNumber(attachment, [
        "size",
        "size_bytes",
        "sizeBytes",
      ]);

      return {
        resend_email_id: resendEmailId,
        attachment_id: attachmentId,
        filename,
        content_type: contentType,
        size_bytes: sizeBytes,
        scan_status: "pending",
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row) => row.attachment_id && row.filename);

  if (rows.length === 0) return;

  const { error } = await admin
    .from("admin_email_attachment_scans")
    .upsert(rows, {
      onConflict: "resend_email_id,attachment_id",
      ignoreDuplicates: true,
    });

  if (error) throw new Error(error.message);
}

function rowToListItem(row: AdminEmailRow): AdminEmailListItem {
  const body = row.text_body || (row.html_body ? stripHtml(row.html_body) : "");
  const delivery = deliveryStatusFromRow(row);
  return {
    id: row.resend_email_id,
    direction: row.direction,
    parentResendEmailId: row.parent_resend_email_id,
    fromAddress: row.from_address,
    fromName: row.from_name,
    toAddresses: row.to_addresses ?? [],
    subject: row.subject,
    preview: previewText(body),
    occurredAt:
      row.received_at || row.sent_at || row.created_at || new Date().toISOString(),
    readAt: row.read_at,
    archivedAt: row.archived_at,
    deliveryStatus: delivery.status,
    deliveryStatusAt: delivery.at,
  };
}

async function listResendReceived(limit = 100): Promise<ResendReceivedListItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await resendFetch<{
    data?: ResendReceivedListItem[];
  }>(`/emails/receiving?limit=${safeLimit}`);
  return Array.isArray(response.data) ? response.data : [];
}

async function getResendReceived(id: string): Promise<ResendReceivedDetail> {
  return resendFetch<ResendReceivedDetail>(
    `/emails/receiving/${encodeURIComponent(id)}`,
  );
}

async function syncInboundMetadata(): Promise<void> {
  const received = await listResendReceived(100);
  if (received.length === 0) return;

  const admin = createAdminClient();
  const { data: blockedRows, error: blockedError } = await admin
    .from("admin_email_blocked_senders")
    .select("email");

  if (blockedError) throw new Error(blockedError.message);

  const blockedSenders = new Set(
    (blockedRows ?? []).map((row) => String(row.email).trim().toLowerCase()),
  );

  const ids = received.map((email) => email.id);
  const { data: existingRows, error: existingError } = await admin
    .from("admin_email_messages")
    .select("resend_email_id,text_body,html_body")
    .in("resend_email_id", ids);

  if (existingError) throw new Error(existingError.message);

  const existing = new Map(
    (existingRows ?? []).map((row) => [String(row.resend_email_id), row]),
  );
  const needsHydration = received.filter((email) => {
    const row = existing.get(email.id);
    return !row || (!row.text_body && !row.html_body);
  });
  if (needsHydration.length === 0) return;

  const hydrated: Array<{
    summary: ResendReceivedListItem;
    detail: ResendReceivedDetail | null;
  }> = [];

  // Keep concurrency modest so a large first sync cannot hammer Resend.
  for (let index = 0; index < needsHydration.length; index += 8) {
    const batch = needsHydration.slice(index, index + 8);
    const resolved = await Promise.all(
      batch.map(async (summary) => {
        try {
          return { summary, detail: await getResendReceived(summary.id) };
        } catch {
          return { summary, detail: null };
        }
      }),
    );
    hydrated.push(...resolved);
  }

  for (const { summary, detail } of hydrated) {
    const source = detail ?? summary;
    const from = parseMailbox(source.from);
    const textBody =
      detail?.text?.trim() ||
      (detail?.html ? stripHtml(detail.html) : null);
    const values = {
      message_id: source.message_id ?? null,
      from_address: from.email,
      from_name: from.name,
      to_addresses: asAddressArray(source.to),
      cc_addresses: asAddressArray(source.cc),
      bcc_addresses: asAddressArray(source.bcc),
      reply_to_addresses: asAddressArray(source.reply_to),
      subject: source.subject?.trim() || "(no subject)",
      text_body: textBody,
      html_body: detail?.html ?? null,
      headers:
        detail?.headers && typeof detail.headers === "object"
          ? detail.headers
          : {},
      attachments: Array.isArray(source.attachments) ? source.attachments : [],
      received_at: source.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing.has(summary.id)) {
      const { error } = await admin
        .from("admin_email_messages")
        .update(values)
        .eq("resend_email_id", summary.id);
      if (error) throw new Error(error.message);
      await ensureAttachmentQuarantineRows(
        admin,
        summary.id,
        Array.isArray(source.attachments) ? source.attachments : [],
      );
      continue;
    }

    const { error } = await admin.from("admin_email_messages").insert({
      resend_email_id: summary.id,
      direction: "inbound",
      ...values,
      archived_at: blockedSenders.has(from.email)
        ? new Date().toISOString()
        : null,
    });
    if (error) throw new Error(error.message);
    await ensureAttachmentQuarantineRows(
      admin,
      summary.id,
      Array.isArray(source.attachments) ? source.attachments : [],
    );
  }
}
export async function listAdminInbox(
  folder: AdminEmailFolder,
  identity: AdminEmailIdentityKey = "hello",
): Promise<AdminEmailListItem[]> {
  if (folder !== "sent") {
    await syncInboundMetadata();
  }

  const admin = createAdminClient();
  const messages: AdminEmailListItem[] = [];
  const seenIds = new Set<string>();
  const pageSize = 250;

  // Fetch every stored message, not just the newest 250 across all mailboxes.
  // Filtering each batch after retrieval also retains legacy recipients stored
  // as display-name addresses ("Name <email>"), not just bare email strings.
  for (let offset = 0; ; offset += pageSize) {
    let query = admin
      .from("admin_email_messages")
      .select(
        "resend_email_id,direction,parent_resend_email_id,from_address,from_name,to_addresses,subject,text_body,html_body,received_at,sent_at,read_at,archived_at,resend_sent_at,delivered_at,delivery_delayed_at,bounced_at,failed_at,suppressed_at,complained_at,opened_at,clicked_at,last_delivery_event,last_delivery_event_at,created_at",
      );

    if (folder === "sent") {
      query = query.eq("direction", "outbound").order("sent_at", { ascending: false });
    } else if (folder === "archived") {
      query = query
        .eq("direction", "inbound")
        .not("archived_at", "is", null)
        .order("received_at", { ascending: false });
    } else {
      query = query
        .eq("direction", "inbound")
        .is("archived_at", null)
        .order("received_at", { ascending: false });
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("resend_email_id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as AdminEmailRow[];
    for (const row of rows) {
      // A message arriving between page requests can shift an offset. Avoid
      // showing the same email twice while the next refresh picks up new mail.
      if (seenIds.has(row.resend_email_id)) continue;
      seenIds.add(row.resend_email_id);
      if (rowBelongsToIdentity(row, identity)) messages.push(rowToListItem(row));
    }
    if (rows.length < pageSize) break;
  }

  return messages;
}

export async function getAdminEmailMessage(
  resendEmailId: string,
): Promise<AdminEmailMessage> {
  const id = resendEmailId.trim();
  if (!id) throw new Error("Email ID is required.");

  const admin = createAdminClient();
  const messageSelect =
    "resend_email_id,direction,parent_resend_email_id,message_id,in_reply_to,from_address,from_name,to_addresses,cc_addresses,bcc_addresses,reply_to_addresses,subject,text_body,html_body,headers,attachments,received_at,sent_at,read_at,archived_at,resend_sent_at,delivered_at,delivery_delayed_at,bounced_at,failed_at,suppressed_at,complained_at,opened_at,clicked_at,last_delivery_event,last_delivery_event_at,delivery_detail,created_at";

  const { data: existing, error: existingError } = await admin
    .from("admin_email_messages")
    .select(messageSelect)
    .eq("resend_email_id", id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Email not found.");

  let row = existing as AdminEmailRow;

  // Opening a message should normally be a local database read only.
  // Resend is used as a one-time recovery path when an older row has no body.
  if (row.direction === "inbound" && !row.text_body && !row.html_body) {
    try {
      const detail = await getResendReceived(id);
      const from = parseMailbox(detail.from);
      const textBody =
        detail.text?.trim() || (detail.html ? stripHtml(detail.html) : "");

      const { data: updated, error: updateError } = await admin
        .from("admin_email_messages")
        .update({
          message_id: detail.message_id ?? row.message_id,
          from_address: from.email || row.from_address,
          from_name: from.name ?? row.from_name,
          to_addresses: asAddressArray(detail.to),
          cc_addresses: asAddressArray(detail.cc),
          bcc_addresses: asAddressArray(detail.bcc),
          reply_to_addresses: asAddressArray(detail.reply_to),
          subject: detail.subject?.trim() || row.subject,
          text_body: textBody || null,
          html_body: detail.html ?? null,
          headers:
            detail.headers && typeof detail.headers === "object"
              ? detail.headers
              : row.headers ?? {},
          attachments: Array.isArray(detail.attachments)
            ? detail.attachments
            : row.attachments ?? [],
          received_at: detail.created_at ?? row.received_at,
          updated_at: new Date().toISOString(),
        })
        .eq("resend_email_id", id)
        .select(messageSelect)
        .single();

      if (updateError) throw new Error(updateError.message);
      row = updated as AdminEmailRow;
    } catch {
      // Keep the local metadata usable even if Resend no longer has the body.
    }
  }

  const parentId =
    row.direction === "inbound" ? row.resend_email_id : row.parent_resend_email_id;
  const senderEmail =
    row.direction === "inbound" ? row.from_address.trim().toLowerCase() : "";

  const [replies, senderBlocked, deliveryEvents] = await Promise.all([
    (async (): Promise<AdminEmailListItem[]> => {
      if (!parentId) return [];
      const { data: replyRows, error: repliesError } = await admin
        .from("admin_email_messages")
        .select(messageSelect)
        .eq("direction", "outbound")
        .eq("parent_resend_email_id", parentId)
        .order("sent_at", { ascending: true });

      if (repliesError) throw new Error(repliesError.message);
      return ((replyRows ?? []) as AdminEmailRow[]).map(rowToListItem);
    })(),
    (async (): Promise<boolean> => {
      if (!senderEmail) return false;
      const { data: blockedSender, error: blockedSenderError } = await admin
        .from("admin_email_blocked_senders")
        .select("email")
        .eq("email", senderEmail)
        .maybeSingle();

      if (blockedSenderError) throw new Error(blockedSenderError.message);
      return Boolean(blockedSender);
    })(),
    (async (): Promise<AdminEmailDeliveryEvent[]> => {
      if (row.direction !== "outbound") return [];
      const { data: eventRows, error: eventError } = await admin
        .from("admin_email_events")
        .select("id,event_type,occurred_at,payload")
        .eq("resend_email_id", row.resend_email_id)
        .order("occurred_at", { ascending: true });

      if (eventError) throw new Error(eventError.message);
      return (eventRows ?? []).map((event) => ({
        id: String(event.id),
        type: String(event.event_type),
        occurredAt: String(event.occurred_at),
        detail: deliveryEventDetail(event.payload),
      }));
    })(),
  ]);

  const item = rowToListItem(row);
  return {
    ...item,
    messageId: row.message_id,
    replyToAddresses: row.reply_to_addresses ?? [],
    ccAddresses: row.cc_addresses ?? [],
    textBody:
      row.text_body || (row.html_body ? stripHtml(row.html_body) : "(No text body)"),
    htmlBody: row.html_body?.trim() || null,
    senderBlocked,
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as Array<Record<string, unknown>>)
      : [],
    replies,
    deliveryEvents,
  };
}

export async function refreshAdminEmailDeliveryStatus(
  resendEmailId: string,
): Promise<{ status: AdminEmailDeliveryStatus; statusAt: string | null }> {
  const id = resendEmailId.trim();
  if (!id) throw new Error("Email ID is required.");

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("admin_email_messages")
    .select(
      "resend_email_id,direction,last_delivery_event,last_delivery_event_at,resend_sent_at,delivered_at,delivery_delayed_at,bounced_at,failed_at,suppressed_at,complained_at,opened_at,clicked_at,sent_at",
    )
    .eq("resend_email_id", id)
    .maybeSingle();

  if (rowError) throw new Error(rowError.message);
  if (!row) throw new Error("Email not found.");
  if (row.direction !== "outbound") {
    throw new Error("Delivery status is only available for sent email.");
  }

  try {
    const remote = await resendFetch<{
      id?: string;
      message_id?: string | null;
      last_event?: string | null;
    }>(`/emails/${encodeURIComponent(id)}`);

    const remoteEvent = remote.last_event?.trim().toLowerCase();
    if (remoteEvent) {
      const normalizedType = remoteEvent.startsWith("email.")
        ? remoteEvent
        : `email.${remoteEvent}`;
      const changed = normalizedType !== row.last_delivery_event;
      const { error: updateError } = await admin
        .from("admin_email_messages")
        .update({
          last_delivery_event: normalizedType,
          ...(changed ? { last_delivery_event_at: null } : {}),
          updated_at: new Date().toISOString(),
          ...(remote.message_id ? { message_id: remote.message_id } : {}),
        })
        .eq("resend_email_id", id);

      if (updateError) throw new Error(updateError.message);
      (row as Record<string, unknown>).last_delivery_event = normalizedType;
      if (changed) {
        (row as Record<string, unknown>).last_delivery_event_at = null;
      }
    }
  } catch {
    // Webhook data/local state remains authoritative if Resend lookup is unavailable.
  }

  const delivery = deliveryStatusFromRow(row as AdminEmailRow);
  return {
    status: delivery.status ?? "unknown",
    statusAt: delivery.at,
  };
}

export async function setAdminEmailSenderBlocked(input: {
  resendEmailId: string;
  blocked: boolean;
}): Promise<{ email: string }> {
  const id = input.resendEmailId.trim();
  if (!id) throw new Error("Email ID is required.");

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("admin_email_messages")
    .select("direction,from_address")
    .eq("resend_email_id", id)
    .maybeSingle();

  if (rowError) throw new Error(rowError.message);
  if (!row) throw new Error("Email not found.");
  if (row.direction !== "inbound") {
    throw new Error("Only received email senders can be blocked.");
  }

  const email = String(row.from_address ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("This message does not have a valid sender address.");
  }

  const protectedAddresses = new Set<string>([
    ...adminInboxIdentities().map((identity) => identity.email.toLowerCase()),
    ...LEGACY_HELLO_ADDRESSES.map((value) => value.toLowerCase()),
  ]);
  if (protectedAddresses.has(email)) {
    throw new Error("Admin mailbox addresses cannot be blocked.");
  }

  if (input.blocked) {
    const { data: existingBlock, error: existingBlockError } = await admin
      .from("admin_email_blocked_senders")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existingBlockError) throw new Error(existingBlockError.message);

    if (!existingBlock) {
      const { error: insertError } = await admin
        .from("admin_email_blocked_senders")
        .insert({ email });
      if (insertError) throw new Error(insertError.message);
    }

    const now = new Date().toISOString();
    const { error: archiveError } = await admin
      .from("admin_email_messages")
      .update({
        archived_at: now,
        read_at: now,
        updated_at: now,
      })
      .eq("direction", "inbound")
      .eq("from_address", email);

    if (archiveError) throw new Error(archiveError.message);
  } else {
    const { error: deleteError } = await admin
      .from("admin_email_blocked_senders")
      .delete()
      .eq("email", email);

    if (deleteError) throw new Error(deleteError.message);
  }

  return { email };
}

export async function setAdminEmailState(input: {
  resendEmailId: string;
  read?: boolean;
  archived?: boolean;
}): Promise<void> {
  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.read === "boolean") {
    update.read_at = input.read ? new Date().toISOString() : null;
  }
  const admin = createAdminClient();

  if (input.archived === false) {
    const { data: message, error: messageError } = await admin
      .from("admin_email_messages")
      .select("direction,from_address")
      .eq("resend_email_id", input.resendEmailId.trim())
      .maybeSingle();

    if (messageError) throw new Error(messageError.message);

    if (message?.direction === "inbound") {
      const senderEmail = String(message.from_address ?? "")
        .trim()
        .toLowerCase();
      const { data: blockedSender, error: blockedSenderError } = await admin
        .from("admin_email_blocked_senders")
        .select("email")
        .eq("email", senderEmail)
        .maybeSingle();

      if (blockedSenderError) throw new Error(blockedSenderError.message);
      if (blockedSender) {
        throw new Error("Unblock this sender before restoring the email.");
      }
    }
  }

  if (typeof input.archived === "boolean") {
    update.archived_at = input.archived ? new Date().toISOString() : null;
  }

  const { error } = await admin
    .from("admin_email_messages")
    .update(update)
    .eq("resend_email_id", input.resendEmailId.trim());

  if (error) throw new Error(error.message);
}

export async function sendNewAdminEmail(input: {
  to: string;
  subject: string;
  text: string;
  identity?: AdminEmailIdentityKey;
}): Promise<{ id: string }> {
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  const text = input.text.trim();

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Enter a valid recipient email address.");
  }
  if (!subject) throw new Error("Subject is required.");
  if (subject.length > 500) throw new Error("Subject is too long.");
  if (!text) throw new Error("Email body cannot be empty.");
  if (text.length > 20_000) throw new Error("Email body is too long.");

  const sender = adminInboxIdentityByKey(input.identity);
  const fromEmail = sender.email;
  const fromName = sender.name;
  const html = plainTextEmailHtml(text);
  const response = await resendFetch<{ id: string }>("/emails", {
    method: "POST",
    headers: {
      "Idempotency-Key": `admin-compose-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.id) throw new Error("Resend did not return an email ID.");

  const admin = createAdminClient();
  const sentAt = new Date().toISOString();
  const { error } = await admin.from("admin_email_messages").insert({
    resend_email_id: response.id,
    direction: "outbound",
    parent_resend_email_id: null,
    from_address: fromEmail,
    from_name: fromName,
    to_addresses: [to],
    subject,
    text_body: text,
    html_body: html,
    sent_at: sentAt,
    read_at: sentAt,
    resend_sent_at: sentAt,
    last_delivery_event: "email.sent",
    last_delivery_event_at: sentAt,
  });

  if (error) throw new Error(error.message);
  return { id: response.id };
}

export async function replyToAdminEmail(input: {
  resendEmailId: string;
  text: string;
}): Promise<{ id: string }> {
  const text = input.text.trim();
  if (!text) throw new Error("Reply cannot be empty.");
  if (text.length > 20_000) throw new Error("Reply is too long.");

  const source = await getAdminEmailMessage(input.resendEmailId);
  if (source.direction !== "inbound") {
    throw new Error("Replies must start from a received email.");
  }

  const replyAddress =
    source.replyToAddresses.map((value) => parseMailbox(value).email).find(Boolean) ||
    source.fromAddress;
  if (!replyAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyAddress)) {
    throw new Error("This email does not contain a valid reply address.");
  }

  const subject = /^re:/i.test(source.subject)
    ? source.subject
    : `Re: ${source.subject}`;
  const sender = identityForInboundRecipients(source.toAddresses);
  const fromEmail = sender.email;
  const fromName = sender.name;
  const headers: Record<string, string> = {};

  if (source.messageId) {
    headers["In-Reply-To"] = source.messageId;
    headers.References = source.messageId;
  }

  const html = plainTextEmailHtml(text);
  const response = await resendFetch<{ id: string }>("/emails", {
    method: "POST",
    headers: {
      "Idempotency-Key": `admin-reply-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [replyAddress],
      subject,
      text,
      html,
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  });

  if (!response.id) throw new Error("Resend did not return an email ID.");

  const admin = createAdminClient();
  const sentAt = new Date().toISOString();
  const { error: insertError } = await admin.from("admin_email_messages").insert({
    resend_email_id: response.id,
    direction: "outbound",
    parent_resend_email_id: source.id,
    in_reply_to: source.messageId,
    from_address: fromEmail,
    from_name: fromName,
    to_addresses: [replyAddress],
    subject,
    text_body: text,
    html_body: html,
    sent_at: sentAt,
    read_at: sentAt,
    resend_sent_at: sentAt,
    last_delivery_event: "email.sent",
    last_delivery_event_at: sentAt,
  });

  if (insertError) throw new Error(insertError.message);

  await setAdminEmailState({
    resendEmailId: source.id,
    read: true,
  });

  return { id: response.id };
}
