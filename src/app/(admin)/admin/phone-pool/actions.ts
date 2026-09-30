"use server";

import { requireAdminPermission } from "@/lib/admin-session";
import {
  promoteExpiredCooldowns,
  refillPoolIfLow,
} from "@/lib/phone-pool";

export async function triggerPhonePoolRefill(): Promise<{
  promoted: number;
  purchased: number;
  skippedReason?: string;
}> {
  await requireAdminPermission("customers");
  const promoted = await promoteExpiredCooldowns();
  const result = await refillPoolIfLow();
  return {
    promoted: (result.promoted ?? 0) + promoted,
    purchased: result.purchased ?? 0,
    ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
  };
}
