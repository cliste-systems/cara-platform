import * as Sentry from "@sentry/nextjs";

/**
 * Start local background work and load Sentry when configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development") {
    const { startDevelopmentCallAnalysisWorker } = await import("@/lib/call-analysis-dev-worker");
    startDevelopmentCallAnalysisWorker();
  }

  if (process.env.SENTRY_DSN?.trim()) {
    if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
    if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
