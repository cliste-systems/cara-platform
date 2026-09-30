import { ADMIN_PERMISSIONS, type AdminPermission } from "./admin-permissions";

export const STAFF_ACCESS_OPTIONS: { value: AdminPermission; label: string; description: string }[] = [
  { value: "customers", label: "Customers", description: "Manage client setup, store settings, Cara training and phone numbers." },
  { value: "calls", label: "Calls & rehearsals", description: "View call recordings and analysis, run demo calls and text rehearsals." },
  { value: "support", label: "Support", description: "Read, respond to and close customer support tickets." },
  { value: "inbox", label: "Inbox", description: "Read and send messages from the shared inbox." },
  { value: "billing", label: "Billing", description: "View and manage platform income, spending, invoices and plans." },
];

export type StaffMemberRow = {
  user_id: string;
  email: string;
  display_name: string;
  role: "owner" | "member";
  permissions: AdminPermission[];
  status: "invited" | "active" | "disabled";
  invited_at: string;
  accepted_at: string | null;
  invitation_sent_at: string | null;
  invitation_error: string | null;
};

export function parseStaffAccess(form: FormData): { ok: true; displayName: string; permissions: AdminPermission[] } | { ok: false; error: string } {
  const displayName = String(form.get("displayName") ?? "").trim();
  if (!displayName || displayName.length > 100) return { ok: false, error: "Enter a name of 1–100 characters." };
  const raw = form.getAll("permissions");
  if (raw.some((value) => typeof value !== "string" || !(ADMIN_PERMISSIONS as readonly string[]).includes(value))) return { ok: false, error: "Choose only the available access areas." };
  const permissions = [...new Set(raw as AdminPermission[])];
  if (!permissions.length) return { ok: false, error: "Choose at least one area this team member can access." };
  return { ok: true, displayName, permissions };
}

export function parseStaffEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function canEditStaffMember(member: Pick<StaffMemberRow, "role" | "user_id">, actorId: string): boolean {
  return member.role === "member" && member.user_id !== actorId;
}
