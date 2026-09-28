import type { User } from "@supabase/supabase-js";

export const INVITE_PASSWORD_MIN_LENGTH = 12;

/** Only the server-managed claim can restrict or complete account setup. */
export function userNeedsPassword(user: Pick<User, "app_metadata">): boolean {
  return user.app_metadata?.needs_password === true;
}

export function validateInvitePassword(password: unknown, confirmation: unknown): string | null {
  if (typeof password !== "string" || password.length < INVITE_PASSWORD_MIN_LENGTH) {
    return `Use at least ${INVITE_PASSWORD_MIN_LENGTH} characters for your password.`;
  }
  if (password.length > 128) return "Use no more than 128 characters for your password.";
  if (password !== confirmation) return "Your passwords do not match. Please try again.";
  return null;
}
