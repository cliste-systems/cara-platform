import "server-only";
import { requireAdminPermission } from "@/lib/admin-session";

export type AdminInboxAccessCheck =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 500; code: "session_required" | "forbidden" | "mfa_required" | "config_error"; message: string };

export async function checkAdminInboxApiAccess(): Promise<AdminInboxAccessCheck> {
  try {
    await requireAdminPermission("inbox");
    return { ok: true };
  } catch {
    return { ok: false, status: 403, code: "forbidden", message: "An active staff session with inbox access and two-factor authentication is required." };
  }
}
