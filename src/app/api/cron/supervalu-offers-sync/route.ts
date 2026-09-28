import { NextResponse } from "next/server";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { syncSupervaluNationalOffers } from "@/lib/supervalu-offers-sync";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  const candidate = bearer ?? header ?? "";
  if (!candidate) return false;
  return timingSafeEqualUtf8(candidate, secret);
}

/**
 * Weekly cron: sync national SuperValu offers into retail_weekly_offers,
 * then recompile Cara prompts for SuperValu retail orgs.
 *
 * Runs several times each Thursday (Dublin) so new-week offers are live
 * before stores open — not deferred to Friday.
 */
export async function GET(request: Request) {
  return run(request, "thursday");
}

export async function POST(request: Request) {
  return run(request, "thursday");
}

async function run(
  request: Request,
  mode: "thursday" | "stale-week-retry",
) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("[cron] supervalu-offers-sync config", err);
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 503 },
    );
  }

  try {
    const result = await syncSupervaluNationalOffers(admin, {
      skipIfAlreadySyncedToday: mode === "thursday",
      retryOnlyIfStaleWeek: mode === "stale-week-retry",
    });
    if (!result.ok) {
      console.error("[cron] supervalu-offers-sync", result.message);
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result, { status: result.queued ? 202 : 200 });
  } catch (err) {
    console.error("[cron] supervalu-offers-sync", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}

export { run as runSupervaluOffersSyncCron };
