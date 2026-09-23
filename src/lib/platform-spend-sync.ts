import { usdToEurCents } from "@/lib/platform-spend";

export type PlatformSpendSyncResult = {
  vendorKey: string;
  ok: boolean;
  amountCents: number | null;
  syncedAt: string;
  error: string | null;
  detail?: string;
};

type OpenRouterCreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
  error?: { message?: string };
};

type OpenRouterAnalyticsResponse = {
  data?: Array<{ metric?: string; value?: number }>;
  error?: { message?: string };
};

function monthStartIso(reference = new Date()): string {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
  return start.toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchOpenRouterMonthUsageUsd(): Promise<number> {
  const key =
    process.env.OPENROUTER_MANAGEMENT_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error("Set OPENROUTER_MANAGEMENT_KEY (or OPENROUTER_API_KEY) to sync OpenRouter spend.");
  }

  const end = new Date().toISOString();
  const start = monthStartIso();

  const analyticsRes = await fetch("https://openrouter.ai/api/v1/analytics/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metrics: ["total_usage"],
      granularity: "day",
      time_range: { start, end },
    }),
    cache: "no-store",
  });

  if (analyticsRes.ok) {
    const payload = (await analyticsRes.json()) as OpenRouterAnalyticsResponse;
    const rows = payload.data ?? [];
    const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
    if (total > 0) return total;
  }

  const creditsRes = await fetch("https://openrouter.ai/api/v1/credits", {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const credits = (await creditsRes.json()) as OpenRouterCreditsResponse;
  if (!creditsRes.ok) {
    throw new Error(
      credits.error?.message ??
        `OpenRouter credits API failed (${creditsRes.status}).`,
    );
  }
  return credits.data?.total_usage ?? 0;
}

export async function syncOpenRouterPlatformSpend(): Promise<PlatformSpendSyncResult> {
  const syncedAt = nowIso();
  try {
    const usageUsd = await fetchOpenRouterMonthUsageUsd();
    return {
      vendorKey: "openrouter",
      ok: true,
      amountCents: usdToEurCents(usageUsd),
      syncedAt,
      error: null,
      detail: `$${usageUsd.toFixed(2)} USD MTD`,
    };
  } catch (err) {
    return {
      vendorKey: "openrouter",
      ok: false,
      amountCents: null,
      syncedAt,
      error: err instanceof Error ? err.message : "OpenRouter sync failed.",
    };
  }
}

export async function syncAllPlatformSpendProviders(): Promise<PlatformSpendSyncResult[]> {
  return Promise.all([syncOpenRouterPlatformSpend()]);
}
