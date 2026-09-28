import { NextResponse } from "next/server";

import { deleteCallRecordingObjects } from "@/lib/call-recordings-server";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily GDPR retention sweep. Implements the schedule in `/legal/privacy`:
 * voice transcripts nulled after 30 days, call recordings deleted after 30 days,
 * AI summaries after 13 months,
 * security audit logs after 2 years, and (legacy) any remaining rows in
 * retired public-booking security tables.
 */
async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  const candidate = bearer ?? header ?? "";
  if (!candidate) return false;
  return timingSafeEqualUtf8(candidate, secret);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

type SweepResult = {
  step: string;
  affected: number;
  error?: string;
};

async function run(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }

  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  const steps: SweepResult[] = [];

  async function step(
    name: string,
    fn: () => Promise<{ count: number; error?: string }>,
  ) {
    try {
      const r = await fn();
      steps.push({
        step: name,
        affected: r.count,
        ...(r.error ? { error: r.error } : {}),
      });
    } catch (e) {
      steps.push({
        step: name,
        affected: 0,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  await step("voice_email_deliveries", async () => {
    const { error, count } = await admin.from("voice_email_deliveries").delete({ count: "exact" }).lt("created_at", iso(30 * 24 * 60 * 60 * 1000));
    return { count: count ?? 0, error: error?.message };
  });

  await step("admin_live_call_sessions", async () => {
    const { error, count } = await admin.from("admin_live_call_sessions").delete({ count: "exact" }).lt("last_seen_at", iso(24 * 60 * 60 * 1000));
    return { count: count ?? 0, error: error?.message };
  });

  await step("admin_call_transport_samples", async () => {
    const { error, count } = await admin.from("admin_call_transport_samples").delete({ count: "exact" }).lt("created_at", iso(30 * 24 * 60 * 60 * 1000));
    return { count: count ?? 0, error: error?.message };
  });

  await step("call_logs.transcript", async () => {
    const cutoff = iso(30 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("call_logs")
      .update({ transcript: null, transcript_review: null })
      .lt("created_at", cutoff)
      .not("transcript", "is", null)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  // Reviews contain transcript excerpts and diagnostic payloads, so they share
  // the 30-day transcript window even when the original transcript was empty.
  await step("call_analysis", async () => {
    const cutoff = iso(30 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("call_analysis")
      .delete()
      .lt("call_created_at", cutoff)
      .select("call_log_id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("call_recordings.storage", async () => {
    const cutoff = iso(30 * 24 * 60 * 60 * 1000);
    const { data: rows, error: selectError } = await admin
      .from("call_logs")
      .select("id, audio_storage_path")
      .lt("created_at", cutoff)
      .not("audio_storage_path", "is", null);

    if (selectError) {
      return { count: 0, error: selectError.message };
    }

    const paths = (rows ?? [])
      .map((row) => String(row.audio_storage_path ?? "").trim())
      .filter(Boolean);

    if (paths.length > 0) {
      await deleteCallRecordingObjects(paths);
    }

    const ids = (rows ?? []).map((row) => String(row.id));
    if (ids.length === 0) {
      return { count: 0 };
    }

    const { data, error } = await admin
      .from("call_logs")
      .update({ audio_storage_path: null })
      .in("id", ids)
      .select("id");

    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("call_logs.ai_summary", async () => {
    const cutoff = iso(395 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("call_logs")
      .update({ ai_summary: null, caller_number: null })
      .lt("created_at", cutoff)
      .or("ai_summary.not.is.null,caller_number.not.is.null")
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  /** Legacy tables from the retired public-booking flow — purge stale rows only. */
  await step("legacy_public_booking_otp", async () => {
    const cutoff = iso(30 * 60 * 1000);
    const { data, error } = await admin
      .from("public_booking_otp_challenges")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("legacy_public_booking_rate_events", async () => {
    const cutoff = iso(14 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("public_booking_rate_events")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("security_auth_events", async () => {
    const cutoff = iso(730 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("security_auth_events")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("action_tickets.pii", async () => {
    const cutoff = iso(395 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("action_tickets")
      .update({ caller_name: null, caller_number: null, summary: null })
      .lt("created_at", cutoff)
      .or("caller_name.not.is.null,caller_number.not.is.null,summary.not.is.null")
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("cara_training_items.caller_context", async () => {
    const cutoff = iso(395 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("cara_training_items")
      .update({ caller_context: null })
      .lt("created_at", cutoff)
      .not("caller_context", "is", null)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("contacts.anonymize", async () => {
    const cutoff = iso(730 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("contacts")
      .update({
        display_name: "Archived contact",
        phone_number: null,
        email: null,
        notes: null,
      })
      .lt("updated_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  await step("sms_usage_records", async () => {
    const cutoff = iso(395 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("sms_usage_records")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  return NextResponse.json({
    ok: true,
    runAt: new Date(now).toISOString(),
    steps,
  });
}
