"use server";

import { revalidatePath } from "next/cache";

import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";

export type OrganizationSettingsPayload = {
  isActive: boolean;
  notificationEmail: string;
  notificationPhone: string;
  callRoutingMode: CallRoutingMode;
  transferNumber: string;
};

const MAX_EMAIL = 254;
const MAX_PHONE = 32;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveOrganizationSettings(
  payload: OrganizationSettingsPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  const {data:org,error:loadError}=await supabase.from("organizations").select("niche,updated_at").eq("id",organizationId).single();
  if(loadError||!org)return {ok:false,message:"We couldn’t load your settings. Please try again."};
  const notificationEmail = String(payload?.notificationEmail ?? "").trim();
  const notificationPhone = String(payload?.notificationPhone ?? "").trim();
  const callRoutingMode = parseCallRoutingMode(payload?.callRoutingMode);
  // Human transfer only makes sense when callers reach the Cliste line directly.
  const transferNumber = callRoutingAllowsHumanTransfer(callRoutingMode)
    ? String(payload?.transferNumber ?? "").trim()
    : "";

  if (notificationEmail && (notificationEmail.length > MAX_EMAIL || !EMAIL_RE.test(notificationEmail))) {
    return { ok: false, message: "Notification email looks invalid." };
  }
  if (notificationPhone.length > MAX_PHONE) {
    return { ok: false, message: "Notification phone looks too long." };
  }
  if (transferNumber.length > MAX_PHONE) {
    return { ok: false, message: "Transfer number looks too long." };
  }

  const patch: Record<string,unknown>={
    notification_email:notificationEmail||null,
    notification_phone:notificationPhone||null,
    updated_at:new Date().toISOString(),
  };
  if(org.niche === "retail"){
    patch.call_routing_mode=callRoutingMode;
    patch.fallback_number=transferNumber||null;
    const compiled=await regenerateCaraCustomPrompt(supabase,organizationId,{dryRun:true,orgPatch:patch});
    if(!compiled.ok||!compiled.prompt)return {ok:false,message:"We couldn’t update Cara’s call settings. Please try again."};
    patch.custom_prompt=compiled.prompt;patch.prompt_compile_warnings=compiled.warnings;
  }
  const {data:saved,error}=await supabase.from("organizations").update(patch).eq("id",organizationId).eq("updated_at",org.updated_at).select("id").maybeSingle();
  if(error||!saved)return {ok:false,message:"Your settings couldn’t be saved. Refresh if they changed in another tab, then try again."};

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/call-history");
  return { ok: true };
}

export async function toggleCaraActive(
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  const { error } = await supabase
    .from("organizations")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/call-history");
  return { ok: true };
}
