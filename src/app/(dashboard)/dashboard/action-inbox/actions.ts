"use server";

import { revalidateActionTicketSurfaces } from "@/lib/action-ticket-routing";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { isEngineerTestCallRow } from "@/lib/engineer-test-call";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markTicketResolved(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId");
  if (typeof ticketId !== "string" || !UUID_RE.test(ticketId)) return;

  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: row } = await supabase
    .from("action_tickets")
    .select("id, department_slug, engineer_test_call, caller_number")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row || isEngineerTestCallRow(row)) return;

  const { error } = await supabase
    .from("action_tickets")
    .update({ status: "resolved" })
    .eq("id", ticketId)
    .eq("organization_id", organizationId);

  if (error) return;

  revalidateActionTicketSurfaces(
    (row as { department_slug?: string | null }).department_slug,
  );
}

export async function markTicketReopen(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId");
  if (typeof ticketId !== "string" || !UUID_RE.test(ticketId)) return;

  const { supabase, organizationId } = await requireDashboardAdmin();

  const { data: row } = await supabase
    .from("action_tickets")
    .select("id, department_slug, engineer_test_call, caller_number")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row || isEngineerTestCallRow(row)) return;

  const { error } = await supabase
    .from("action_tickets")
    .update({ status: "open" })
    .eq("id", ticketId)
    .eq("organization_id", organizationId);

  if (error) return;

  revalidateActionTicketSurfaces(
    (row as { department_slug?: string | null }).department_slug,
  );
}
