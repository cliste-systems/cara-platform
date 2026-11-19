"use server";
import { revalidatePath } from "next/cache";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { isCallRoutingMode } from "@/lib/call-routing";
import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
export async function savePhoneConnection(input: {
  mode: string;
  transfer: string;
  version: string;
}) {
  const s = await requireDashboardAdmin();
  if (!isCallRoutingMode(input.mode))
    return { ok: false as const, message: "Choose a connection option." };
  const transfer =
    input.mode === "cliste_number"
      ? normalizeCustomerPhoneE164(input.transfer.replace(/[\s()-]/g, ""))
      : "";
  if (transfer && !/^\+[1-9]\d{7,14}$/.test(transfer))
    return {
      ok: false as const,
      message: "Enter a valid transfer number, including its country code.",
    };
  const { data: org, error } = await s.supabase
    .from("organizations")
    .select("phone_number,updated_at")
    .eq("id", s.organizationId)
    .single();
  if (error || !org)
    return {
      ok: false as const,
      message: "We couldn’t load your phone settings.",
    };
  if (org.updated_at !== input.version)
    return {
      ok: false as const,
      message: "Your business settings changed. Refresh before saving.",
    };
  if (transfer && transfer === org.phone_number)
    return {
      ok: false as const,
      message:
        "Use a different transfer number so calls don’t loop back to Cara.",
    };
  const patch = {
    call_routing_mode: input.mode,
    fallback_number: transfer || null,
  };
  const compiled = await regenerateCaraCustomPrompt(
    s.supabase,
    s.organizationId,
    { dryRun: true, orgPatch: patch },
  );
  if (!compiled.ok || !compiled.prompt)
    return {
      ok: false as const,
      message: "Cara’s call handling could not be updated. Please try again.",
    };
  const { data: saved, error: saveError } = await s.supabase
    .from("organizations")
    .update({
      ...patch,
      custom_prompt: compiled.prompt,
      prompt_compile_warnings: compiled.warnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", s.organizationId)
    .eq("updated_at", input.version)
    .select("updated_at")
    .maybeSingle();
  if (saveError || !saved)
    return {
      ok: false as const,
      message:
        "Your phone settings were not saved. Please refresh and try again.",
    };
  for (const p of [
    "/dashboard",
    "/dashboard/settings",
    "/dashboard/settings/phone-setup",
  ])
    revalidatePath(p);
  return { ok: true as const, transfer, version: saved.updated_at };
}
