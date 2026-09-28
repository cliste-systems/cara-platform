"use server";

import { revalidatePath } from "next/cache";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import {
  createCallRecordingSignedUrl,
  deleteCallRecordingObjects,
} from "@/lib/call-recordings-server";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import type { GdprPortabilityPayload } from "@/lib/gdpr-portability";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { headers } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

export type GdprExportResult =
  | { ok: true; data: GdprExportPayload; phoneE164: string }
  | { ok: false; message: string };

export type GdprErasureResult =
  | { ok: true; affected: GdprErasureCounts; phoneE164: string }
  | { ok: false; message: string };

export type GdprExportPayload = {
  generated_at: string;
  organization_id: string;
  customer_phone_e164: string;
  call_recordings_note?: string;
  appointments: Record<string, unknown>[];
  call_logs: Record<string, unknown>[];
  action_tickets: Record<string, unknown>[];
  blocked_callers: Record<string, unknown>[];
};

export type GdprErasureCounts = {
  appointments_anonymised: number;
  call_logs_redacted: number;
  action_tickets_redacted: number;
  blocked_callers_deleted: number;
};

function normalizePhoneOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const e164 = normalizeCustomerPhoneE164(trimmed);
  if (!/^\+\d{8,16}$/.test(e164)) return null;
  return e164;
}

export type GdprPortabilityResult =
  | { ok: true; data: GdprPortabilityPayload }
  | { ok: false; message: string };

export type { GdprPortabilityPayload } from "@/lib/gdpr-portability";

/**
 * Article 20 data portability — structured export of all caller/contact records
 * for the requesting organization (machine-readable JSON bundle).
 */
export async function exportOrganizationPortabilityData(): Promise<GdprPortabilityResult> {
  const session = await requireDashboardSession();
  const sb = session.supabase;

  const [appts, calls, tickets] = await Promise.all([
    fetchAppointmentsForExport(sb, session.organizationId),
    sb
      .from("call_logs")
      .select(
        "id, caller_number, caller_name, duration_seconds, outcome, transcript, transcript_review, ai_summary, created_at",
      )
      .eq("organization_id", session.organizationId)
      .limit(5000),
    sb
      .from("action_tickets")
      .select(
        "id, status, summary, caller_number, caller_name, engineering_priority, created_at",
      )
      .eq("organization_id", session.organizationId)
      .limit(5000),
  ]);

  if (calls.error || tickets.error) {
    console.error("[gdpr] portability export error", {
      c: calls.error?.message,
      t: tickets.error?.message,
    });
    return { ok: false, message: "Could not assemble portability export." };
  }

  try {
    const ctx = buildSecurityEventContext(await headers());
    await logSecurityEvent(ctx, {
      eventType: "gdpr_data_export",
      outcome: "success",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      metadata: {
        organization_id: session.organizationId,
        export_type: "art20_portability",
        appointment_count: appts.length,
        call_log_count: calls.data?.length ?? 0,
        action_ticket_count: tickets.data?.length ?? 0,
      },
    });
  } catch (err) {
    console.warn("[gdpr] failed to record portability export event", err);
  }

  return {
    ok: true,
    data: {
      format: "cliste-gdpr-portability-v1",
      generated_at: new Date().toISOString(),
      organization_id: session.organizationId,
      call_recordings_note:
        "Call audio recordings are not included in this export. Where a recording exists, it is available in the dashboard for up to 30 days and then deleted automatically.",
      appointments: appts,
      call_logs: calls.data ?? [],
      action_tickets: tickets.data ?? [],
    },
  };
}

/**
 * Article 15 right of access — assemble every row Cliste holds for a
 * customer phone number, scoped to the requesting salon. Returned as a
 * structured payload the operator can hand to the customer (we render it
 * as JSON in the UI; the operator can copy/paste or download).
 */
export async function exportCustomerData(
  formData: FormData,
): Promise<GdprExportResult> {
  const session = await requireDashboardSession();
  const phoneRaw = String(formData.get("phone") ?? "");
  const phoneE164 = normalizePhoneOrNull(phoneRaw);
  if (!phoneE164) {
    return {
      ok: false,
      message: "Enter a valid Irish (+353) or international mobile number.",
    };
  }

  // Use the dashboard session's client (RLS-scoped to this org) so we
  // can never leak data from another tenant by accident.
  const sb = session.supabase;

  const [appts, calls, tickets, blocked] = await Promise.all([
    fetchAppointmentsForExport(sb, session.organizationId, phoneE164),
    sb
      .from("call_logs")
      .select(
        "id, caller_number, caller_name, duration_seconds, outcome, transcript, transcript_review, ai_summary, created_at, audio_storage_path",
      )
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .limit(500),
    sb
      .from("action_tickets")
      .select(
        "id, status, summary, caller_number, caller_name, engineering_priority, created_at",
      )
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .limit(500),
    sb
      .from("blocked_callers")
      .select("id, caller_e164, reason, created_at")
      .eq("organization_id", session.organizationId)
      .eq("caller_e164", phoneE164)
      .limit(50),
  ]);

  if (calls.error || tickets.error || blocked.error) {
    console.error("[gdpr] export query error", {
      c: calls.error?.message,
      t: tickets.error?.message,
      b: blocked.error?.message,
    });
    return { ok: false, message: "Could not assemble export." };
  }

  // Audit — exporting customer PII is a sensitive, privacy-relevant
  // action even though it's the salon doing it for their own customer.
  try {
    const ctx = buildSecurityEventContext(await headers());
    await logSecurityEvent(ctx, {
      eventType: "gdpr_data_export",
      outcome: "success",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      metadata: {
        organization_id: session.organizationId,
        customer_phone_masked: maskPhoneE164(phoneE164),
        appointment_count: appts.length,
        call_log_count: calls.data?.length ?? 0,
        action_ticket_count: tickets.data?.length ?? 0,
        blocked_caller_count: blocked.data?.length ?? 0,
      },
    });
  } catch (err) {
    console.warn("[gdpr] failed to record export event", err);
  }

  const callLogRows = calls.data ?? [];
  const enrichedCallLogs = await Promise.all(
    callLogRows.map(async (row) => {
      const storagePath = String(row.audio_storage_path ?? "").trim();
      if (!storagePath) {
        return {
          ...row,
          has_call_recording: false,
        };
      }
      const playbackUrl = await createCallRecordingSignedUrl({
        organizationId: session.organizationId,
        callLogId: String(row.id),
        storagePath,
      });
      return {
        ...row,
        has_call_recording: true,
        call_recording_playback_url: playbackUrl,
        call_recording_url_expires_in_seconds: playbackUrl ? 300 : null,
        call_recordings_note:
          "Signed playback URLs expire after five minutes. Recordings are deleted automatically after 30 days.",
      };
    }),
  );

  return {
    ok: true,
    phoneE164,
    data: {
      generated_at: new Date().toISOString(),
      organization_id: session.organizationId,
      customer_phone_e164: phoneE164,
      call_recordings_note:
        "Call audio is included as time-limited playback links where a recording still exists (up to 30 days).",
      appointments: appts,
      call_logs: enrichedCallLogs,
      action_tickets: tickets.data ?? [],
      blocked_callers: blocked.data ?? [],
    },
  };
}

/**
 * Article 17 right to erasure. We anonymise rather than hard-delete
 * because the salon is required to keep appointment records for tax
 * purposes (Revenue: 6 years). The customer's name, phone and email are
 * replaced with redaction markers; the appointment time and price stay
 * for the books.
 *
 * Call transcripts and call recordings already hold no personal data after our 30-day cron
 * sweep, but we proactively null `caller_number`, delete matching recordings, and null
 * `ai_summary` for any log row tied to the same phone so an erasure request takes effect
 * immediately.
 */
export async function eraseCustomerData(
  formData: FormData,
): Promise<GdprErasureResult> {
  const session = await requireDashboardAdmin();
  const phoneRaw = String(formData.get("phone") ?? "");
  const phoneE164 = normalizePhoneOrNull(phoneRaw);
  if (!phoneE164) {
    return {
      ok: false,
      message: "Enter a valid Irish (+353) or international mobile number.",
    };
  }
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirm !== "ERASE") {
    return {
      ok: false,
      message: "Type ERASE to confirm — this cannot be undone.",
    };
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return {
      ok: false,
      message: "Enter a reason for this erasure.",
    };
  }
  const performedBy = String(formData.get("performedBy") ?? "").trim();
  if (!performedBy) {
    return {
      ok: false,
      message: "Enter who is performing this erasure.",
    };
  }

  const erasedAt = new Date().toISOString();
  const erasedByLabel = performedBy;

  // Erasure mutates rows we don't always have UPDATE policy for under
  // RLS (e.g. call_logs is mostly read-only for tenant users), so we
  // use the admin client BUT scope every UPDATE to this org's rows.
  const admin = createAdminClient();

  const { data: recordingRows } = await admin
    .from("call_logs")
    .select("audio_storage_path")
    .eq("organization_id", session.organizationId)
    .eq("caller_number", phoneE164)
    .not("audio_storage_path", "is", null);

  const recordingPaths = (recordingRows ?? [])
    .map((row) => String(row.audio_storage_path ?? "").trim())
    .filter(Boolean);
  if (recordingPaths.length > 0) {
    await deleteCallRecordingObjects(recordingPaths);
  }

  const apptsRes = await anonymiseAppointmentsForErasure(
    admin,
    session.organizationId,
    phoneE164,
  );

  const [callsRes, ticketsRes, blockedRes] = await Promise.all([
    admin
      .from("call_logs")
      .update({
        caller_number: erasedPhoneSentinel(),
        caller_name: null,
        transcript: null,
        transcript_review: null,
        ai_summary: null,
        audio_storage_path: null,
        caller_data_erased_at: erasedAt,
        caller_data_erased_by: session.user.id,
        caller_data_erased_by_label: erasedByLabel,
        caller_data_erased_reason: reason,
      })
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .select("id"),
    admin
      .from("action_tickets")
      .update({
        summary: "[Erased on customer request — GDPR Art 17]",
        caller_number: erasedPhoneSentinel(),
        caller_name: null,
      })
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .select("id"),
    admin
      .from("blocked_callers")
      .delete()
      .eq("organization_id", session.organizationId)
      .eq("caller_e164", phoneE164)
      .select("id"),
  ]);

  if (callsRes.error || ticketsRes.error || blockedRes.error) {
    console.error("[gdpr] erasure error", {
      a: apptsRes.skipped ? apptsRes.skipReason : undefined,
      c: callsRes.error?.message,
      t: ticketsRes.error?.message,
      b: blockedRes.error?.message,
    });
    return { ok: false, message: "Erasure failed — please retry." };
  }

  const counts: GdprErasureCounts = {
    appointments_anonymised: apptsRes.count,
    call_logs_redacted: callsRes.data?.length ?? 0,
    action_tickets_redacted: ticketsRes.data?.length ?? 0,
    blocked_callers_deleted: blockedRes.data?.length ?? 0,
  };

  try {
    const ctx = buildSecurityEventContext(await headers());
    await logSecurityEvent(ctx, {
      eventType: "gdpr_erasure",
      outcome: "success",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      metadata: {
        organization_id: session.organizationId,
        customer_phone_masked: maskPhoneE164(phoneE164),
        erasure_reason: reason,
        erased_by_label: erasedByLabel,
        ...counts,
      },
    });
  } catch (err) {
    console.warn("[gdpr] failed to record erasure event", err);
  }

  revalidatePath("/dashboard/calls");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/legal/data-requests");

  return { ok: true, phoneE164, affected: counts };
}

// Sentinel used after erasure. Distinct per row would defeat the
// "this customer has been forgotten" lookup; using a single magic value
// means a re-export for the same phone number returns nothing.
function erasedPhoneSentinel(): string {
  return "+000000000000";
}

function maskPhoneE164(e164: string): string {
  if (e164.length <= 4) return "***";
  return `${e164.slice(0, 4)}***${e164.slice(-2)}`;
}

const APPOINTMENTS_EXPORT_COLUMNS =
  "id, customer_name, customer_phone, customer_email, service_id, start_time, end_time, status, source, payment_status, amount_cents, currency, booking_reference, created_at";

/** Voice-only / retail orgs may not have appointments deployed — export still succeeds. */
async function fetchAppointmentsForExport(
  sb: Awaited<ReturnType<typeof requireDashboardSession>>["supabase"],
  organizationId: string,
  customerPhone?: string,
): Promise<Record<string, unknown>[]> {
  let query = sb
    .from("appointments")
    .select(APPOINTMENTS_EXPORT_COLUMNS)
    .eq("organization_id", organizationId)
    .limit(customerPhone ? 500 : 5000);
  if (customerPhone) {
    query = query.eq("customer_phone", customerPhone);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[gdpr] appointments export skipped", error.message);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

type AppointmentErasureResult =
  | { count: number; skipped?: false }
  | { count: 0; skipped: true; skipReason: string };

/** Salon orgs anonymise booking rows; retail orgs often have no appointments table. */
async function anonymiseAppointmentsForErasure(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  phoneE164: string,
): Promise<AppointmentErasureResult> {
  const { data, error } = await admin
    .from("appointments")
    .update({
      customer_name: "Erased (GDPR)",
      customer_phone: erasedPhoneSentinel(),
      customer_email: null,
    })
    .eq("organization_id", organizationId)
    .eq("customer_phone", phoneE164)
    .select("id");
  if (error) {
    console.warn("[gdpr] appointments erasure skipped", error.message);
    return { count: 0, skipped: true, skipReason: error.message };
  }
  return { count: data?.length ?? 0 };
}
