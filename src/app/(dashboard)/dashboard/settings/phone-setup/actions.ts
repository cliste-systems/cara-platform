"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { createSupportTicket } from "@/app/(dashboard)/dashboard/support/actions";

export async function requestPhoneSetupReview(): Promise<
  { ok: true; ticketId: string } | { ok: false; message: string }
> {
  const { organizationId } = await requireDashboardAdmin();

  const result = await createSupportTicket({
    subject: "Phone setup review requested",
    body: `Please review our store phone setup and transfer configuration for organization ${organizationId}.`,
  });

  if (!result.ok) return result;

  revalidatePath("/dashboard/settings/phone-setup");
  revalidatePath("/dashboard/support");
  return result;
}
