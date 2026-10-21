/** Only same-site admin pages can be resumed after the second factor. */
export function adminReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/admin") || /[\\\\\r\n]/.test(value)) return "/admin";
  try {
    const url = new URL(value, "https://admin.invalid");
    if (url.origin !== "https://admin.invalid" || (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) || ["/admin/mfa", "/admin/login"].includes(url.pathname.replace(/\/$/, ""))) return "/admin";
    return `${url.pathname}${url.search}`;
  } catch { return "/admin"; }
}
