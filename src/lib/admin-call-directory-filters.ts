export const ADMIN_CALL_REVIEW_FILTERS = ["all", "pass", "fail", "review", "outdated", "pending", "error", "queued", "unreviewed", "backlog"] as const;
export function parseAdminCallDirectoryFilters(input: Record<string, string | undefined>) {
  const requestedPage = Number(input.page || 0);
  return {
    query: (input.q || "").trim().slice(0, 200),
    status: ADMIN_CALL_REVIEW_FILTERS.includes(input.status as typeof ADMIN_CALL_REVIEW_FILTERS[number]) ? input.status! : "all",
    outcome: input.outcome === "failed" ? "failed" : "all",
    processing: input.processing === "issues",
    date: input.date === "today" ? "today" : "all",
    customer: /^[0-9a-f-]{36}$/i.test(input.customer || "") ? input.customer! : "",
    kind: ["customer", "demo", "engineer", "verification"].includes(input.kind || "") ? input.kind! : "all",
    page: Number.isFinite(requestedPage) ? Math.max(0, Math.min(1000000, Math.floor(requestedPage))) : 0,
  };
}
