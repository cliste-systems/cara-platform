import "../../scripts/mock-server-only.ts";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { listAdminInbox } from "./resend-admin-inbox";

const originalEnvironment = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://inbox-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "inbox-test-service-key";
  process.env.RESEND_API_KEY = "inbox-test-resend-key";
  process.env.RESEND_HELLO_EMAIL = "hello@example.test";
  process.env.RESEND_CLISTE_EMAIL = "cliste@example.test";
});

afterEach(() => {
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "RESEND_HELLO_EMAIL",
    "RESEND_CLISTE_EMAIL",
  ]) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

function inboundRow(index: number, recipient = "hello@example.test") {
  return {
    resend_email_id: `message-${index}`,
    direction: "inbound",
    parent_resend_email_id: null,
    from_address: "sender@example.test",
    from_name: "Sender",
    to_addresses: [recipient],
    subject: `Message ${index}`,
    text_body: "An email worth reading.",
    html_body: null,
    received_at: "2026-09-28T10:00:00Z",
    sent_at: null,
    created_at: "2026-09-28T10:00:00Z",
    read_at: null,
    archived_at: null,
  };
}

function requestUrl(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : String(input));
}

test("lists mailbox messages beyond 250 emails in other mailboxes", async (t) => {
  const rows = Array.from({ length: 253 }, (_, index) =>
    inboundRow(
      index,
      index < 250
        ? "hello@example.test"
        : "Cliste Systems <cliste@example.test>",
    ),
  );
  const offsets: number[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.hostname === "api.resend.com") return Response.json({ data: [] });
    assert.equal(url.pathname, "/rest/v1/admin_email_messages");
    assert.equal(url.searchParams.get("direction"), "eq.inbound");
    assert.equal(url.searchParams.get("archived_at"), "is.null");
    assert.match(url.searchParams.get("order") ?? "", /resend_email_id.desc/);
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    offsets.push(offset);
    return Response.json(rows.slice(offset, offset + limit));
  });

  const messages = await listAdminInbox("inbox", "cliste");
  assert.deepEqual(
    messages.map((message) => message.id),
    ["message-250", "message-251", "message-252"],
  );
  assert.deepEqual(offsets, [0, 250]);
});

test("cleans decorative separators from previews without changing their content", async (t) => {
  const row = {
    ...inboundRow(1),
    text_body:
      "*******************\nPlease verify your business email\n*******************\n\u200bFollow these instructions.",
  };
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    if (requestUrl(input).hostname === "api.resend.com")
      return Response.json({ data: [] });
    return Response.json([row]);
  });

  const [message] = await listAdminInbox("inbox", "hello");
  assert.equal(
    message?.preview,
    "Please verify your business email Follow these instructions.",
  );
});

test("does not repeat a message when new mail shifts a later page", async (t) => {
  const rows = Array.from({ length: 250 }, (_, index) => inboundRow(index));
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.hostname === "api.resend.com") return Response.json({ data: [] });
    return Response.json(
      Number(url.searchParams.get("offset")) === 0
        ? rows
        : [rows[249], inboundRow(250)],
    );
  });

  const messages = await listAdminInbox("inbox", "hello");
  assert.equal(messages.length, 251);
  assert.equal(new Set(messages.map((message) => message.id)).size, 251);
});

test("reports a failed later page instead of silently showing an incomplete inbox", async (t) => {
  const rows = Array.from({ length: 250 }, (_, index) => inboundRow(index));
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.hostname === "api.resend.com") return Response.json({ data: [] });
    if (Number(url.searchParams.get("offset")) === 0)
      return Response.json(rows);
    return Response.json(
      { message: "Could not read older emails", code: "INBOX_TEST" },
      { status: 400 },
    );
  });

  await assert.rejects(
    listAdminInbox("inbox", "hello"),
    /Could not read older emails/,
  );
});
