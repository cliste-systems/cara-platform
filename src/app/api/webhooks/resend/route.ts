import { NextResponse } from "next/server";
import { Resend, type WebhookEventPayload } from "resend";

import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRACKED_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.failed",
  "email.suppressed",
  "email.complained",
  "email.opened",
  "email.clicked",
]);

function eventColumn(type: string): string | null {
  switch (type) {
    case "email.sent":
      return "resend_sent_at";
    case "email.delivered":
      return "delivered_at";
    case "email.delivery_delayed":
      return "delivery_delayed_at";
    case "email.bounced":
      return "bounced_at";
    case "email.failed":
      return "failed_at";
    case "email.suppressed":
      return "suppressed_at";
    case "email.complained":
      return "complained_at";
    case "email.opened":
      return "opened_at";
    case "email.clicked":
      return "clicked_at";
    default:
      return null;
  }
}

async function webhookSecret(): Promise<string> {
  const configured = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (configured) return configured;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_email_webhook_config")
    .select("signing_secret")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const secret = data?.signing_secret?.trim();
  if (!secret) throw new Error("Resend webhook secret is not configured.");
  return secret;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const svixId = request.headers.get("svix-id")?.trim();
  const svixTimestamp = request.headers.get("svix-timestamp")?.trim();
  const svixSignature = request.headers.get("svix-signature")?.trim();

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse("Missing webhook signature.", { status: 400 });
  }

  let event: WebhookEventPayload;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY?.trim());
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: await webhookSecret(),
    });
  } catch {
    return new NextResponse("Invalid webhook signature.", { status: 400 });
  }

  const type = event.type?.trim() || "";
  if (!TRACKED_EVENTS.has(type)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const resendEmailId = event.data && "email_id" in event.data && typeof event.data.email_id === "string"
    ? event.data.email_id.trim()
    : null;
  if (!resendEmailId) {
    return new NextResponse("Missing email ID.", { status: 400 });
  }

  const occurredAt =
    event.created_at && !Number.isNaN(Date.parse(event.created_at))
      ? new Date(event.created_at).toISOString()
      : new Date().toISOString();

  let parsedPayload: unknown = {};
  try {
    parsedPayload = JSON.parse(payload) as unknown;
  } catch {
    parsedPayload = event;
  }

  const admin = createAdminClient();
  const { error: eventError } = await admin.from("admin_email_events").insert({
    id: svixId,
    resend_email_id: resendEmailId,
    event_type: type,
    occurred_at: occurredAt,
    payload: parsedPayload,
  });

  if (eventError && eventError.code !== "23505") {
    throw new Error(eventError.message);
  }

  const column = eventColumn(type);
  const update: Record<string, unknown> = {
    last_delivery_event: type,
    last_delivery_event_at: occurredAt,
    delivery_detail: event.data ?? {},
    updated_at: new Date().toISOString(),
  };
  if (column) update[column] = occurredAt;

  const { error: updateError } = await admin
    .from("admin_email_messages")
    .update(update)
    .eq("direction", "outbound")
    .eq("resend_email_id", resendEmailId);

  if (updateError) throw new Error(updateError.message);

  return NextResponse.json({ ok: true });
}
