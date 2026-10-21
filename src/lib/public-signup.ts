/**
 * Public signup is enabled by default. Retail and custom clients continue to
 * use admin invitations. PUBLIC_SIGNUP_ENABLED=false is an emergency kill switch.
 */
export function isPublicSignupEnabled(): boolean {
  const v = process.env.PUBLIC_SIGNUP_ENABLED?.trim().toLowerCase();
  return !["0", "false", "no"].includes(v ?? "");
}
