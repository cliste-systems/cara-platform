"use server";

import { revalidatePath } from "next/cache";

import {
  isOrgProtectedPhone,
  normalizeBlockedCallerE164,
  type BlockedCallerRow,
} from "@/lib/blocked-callers";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_REASON = 240;

type ActionResult = { ok: true } | { ok: false; message: string };

function revalidateBlockedCallerPaths() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/call-history");
  revalidatePath("/dashboard/calls");
  revalidatePath("/dashboard/action-inbox");
}

async function loadOrgPhoneGuardContext(
  supabase: Awaited<ReturnType<typeof requireDashboardAdmin>>["supabase"],
  organizationId: string,
) {
  const [{ data: org }, { data: dids }] = await Promise.all([
    supabase
      .from("organizations")
      .select("phone_number, fallback_number")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("phone_numbers")
      .select("e164")
      .eq("organization_id", organizationId),
  ]);

  return {
    orgPhone: (org?.phone_number as string | null) ?? null,
    transferPhone: (org?.fallback_number as string | null) ?? null,
    assignedDids: (dids ?? [])
      .map((row) => String((row as { e164?: string }).e164 ?? "").trim())
      .filter(Boolean),
  };
}

function protectedPhoneMessage(): string {
  return "You cannot block your own Cliste number or transfer number — that would stop legitimate calls.";
}

export async function addBlockedCaller(input: {
  phone: string;
  reason?: string | null;
}): Promise<ActionResult & { callerE164?: string }> {
  const { supabase, organizationId, user } = await requireDashboardAdmin();

  const callerE164 = normalizeBlockedCallerE164(String(input.phone ?? ""));
  if (!callerE164) {
    return {
      ok: false,
      message: "Enter a valid phone number in international format (e.g. +353…).",
    };
  }

  const guard = await loadOrgPhoneGuardContext(supabase, organizationId);
  if (
    isOrgProtectedPhone({
      callerE164,
      orgPhone: guard.orgPhone,
      transferPhone: guard.transferPhone,
      assignedDids: guard.assignedDids,
    })
  ) {
    return { ok: false, message: protectedPhoneMessage() };
  }

  const reason = String(input.reason ?? "").trim().slice(0, MAX_REASON) || null;

  const { error } = await supabase.from("blocked_callers").insert({
    organization_id: organizationId,
    caller_e164: callerE164,
    reason,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "This number is already blocked." };
    }
    return { ok: false, message: "Could not block this number. Try again." };
  }

  revalidateBlockedCallerPaths();
  return { ok: true, callerE164 };
}

export async function removeBlockedCaller(input: {
  id: string;
}): Promise<ActionResult> {
  const id = String(input.id ?? "").trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid block entry." };
  }

  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: row } = await supabase
    .from("blocked_callers")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row) {
    return { ok: false, message: "Block entry not found." };
  }

  const { error } = await supabase
    .from("blocked_callers")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, message: "Could not unblock this number. Try again." };
  }

  revalidateBlockedCallerPaths();
  return { ok: true };
}

export async function removeBlockedCallerByPhone(input: {
  phone: string;
}): Promise<ActionResult> {
  const callerE164 = normalizeBlockedCallerE164(String(input.phone ?? ""));
  if (!callerE164) {
    return { ok: false, message: "Invalid phone number." };
  }

  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: row } = await supabase
    .from("blocked_callers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("caller_e164", callerE164)
    .maybeSingle();

  if (!row?.id) {
    return { ok: false, message: "This number is not on your blocklist." };
  }

  return removeBlockedCaller({ id: row.id });
}

export async function saveBlockAnonymousCallers(input: {
  enabled: boolean;
}): Promise<ActionResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  const { error } = await supabase
    .from("organizations")
    .update({ block_anonymous_callers: Boolean(input.enabled) })
    .eq("id", organizationId);

  if (error) {
    return {
      ok: false,
      message: "Could not update anonymous-call setting. Try again.",
    };
  }

  revalidateBlockedCallerPaths();
  return { ok: true };
}

export async function blockCallerAndDismissTicket(input: {
  ticketId: string;
  phone: string;
  reason?: string | null;
}): Promise<ActionResult> {
  const ticketId = String(input.ticketId ?? "").trim();
  if (!UUID_RE.test(ticketId)) {
    return { ok: false, message: "Invalid ticket." };
  }

  const blockResult = await addBlockedCaller({
    phone: input.phone,
    reason: input.reason ?? "Blocked from Action Inbox",
  });
  if (!blockResult.ok) {
    return blockResult;
  }

  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: row } = await supabase
    .from("action_tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row) {
    return { ok: false, message: "Ticket not found." };
  }

  const { error } = await supabase
    .from("action_tickets")
    .update({ status: "resolved" })
    .eq("id", ticketId)
    .eq("organization_id", organizationId);

  if (error) {
    return {
      ok: false,
      message: "Number blocked, but the ticket could not be dismissed.",
    };
  }

  revalidatePath("/dashboard/action-inbox");
  revalidatePath("/dashboard");
  revalidateBlockedCallerPaths();
  return { ok: true };
}

export type BlockedNumbersInitial = {
  rows: BlockedCallerRow[];
  blockAnonymousCallers: boolean;
};
