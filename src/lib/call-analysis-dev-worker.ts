import { processPendingCallAnalyses } from "@/lib/call-analysis-server";

// Next dev does not run Vercel cron. Keep its durable queue moving even when
// the admin page is closed. Database leases also protect multiple dev servers.
const state = globalThis as typeof globalThis & {
  __caraCallAnalysisWorker?: { timer: ReturnType<typeof setTimeout> | null };
};

export function startDevelopmentCallAnalysisWorker() {
  if (process.env.NODE_ENV !== "development" || state.__caraCallAnalysisWorker ||
    !process.env.OPENAI_API_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return;
  const worker = { timer: null as ReturnType<typeof setTimeout> | null };
  state.__caraCallAnalysisWorker = worker;
  const poll = async () => {
    let delay = 30_000;
    try {
      const result = await processPendingCallAnalyses({ limit: 2 });
      if (result.processed) {
        console.info("[call-analysis] Automatic reviews", result);
        // Drain a backlog gradually. Never overlap batches or bypass retry dates.
        if (result.completed > 0) delay = 1000;
      }
    } catch {
      console.error("[call-analysis] Automatic queue check failed; retrying shortly.");
    } finally {
      worker.timer = setTimeout(() => void poll(), delay);
      worker.timer.unref();
    }
  };
  worker.timer = setTimeout(() => void poll(), 1000);
  worker.timer.unref();
}
