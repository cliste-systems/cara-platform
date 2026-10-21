import type { User } from "@supabase/supabase-js";

export const PUBLIC_SIGNUP_FLOW = "simple_v1";

/** Server-owned auth metadata; never use editable user metadata for this gate. */
export function usesSimpleSignup(user: Pick<User, "app_metadata">): boolean {
  return user.app_metadata?.cliste_signup_flow === PUBLIC_SIGNUP_FLOW;
}

export function signupDetails(form: FormData) {
  const fullName = String(form.get("fullName") ?? "").trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : String(form.get("firstName") ?? "").trim();
  const lastName = fullName ? fullName.split(/\s+/).slice(1).join(" ") : String(form.get("lastName") ?? "").trim();
  return {
    firstName, lastName,
    ownerName: fullName || [firstName, lastName].filter(Boolean).join(" "),
    businessName: String(form.get("businessName") ?? form.get("salonName") ?? "").trim(),
  };
}
