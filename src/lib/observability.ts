import { recordApplicationEvent } from "@/lib/application-monitoring";
import * as Sentry from "@sentry/nextjs";

/**
 * Best-effort error capture — forwards to Sentry when configured.
 */
export async function captureObservedError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  await recordApplicationEvent({kind: "error", operation: typeof context?.route === "string" ? context.route.split("?")[0] : "background-operation", code: "operation_failed", organizationId: typeof context?.orgId === "string" ? context.orgId : undefined});
  console.error("[observability] Operation failed.");
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.captureException(error, { extra: context });
}
