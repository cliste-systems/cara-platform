import { NextResponse } from "next/server";

import { processPendingCallAnalyses } from "@/lib/call-analysis-server";
import { captureObservedError } from "@/lib/observability";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Retry queued reviews and expired leases after an interrupted worker. */
async function run(request: Request) {
  const secret = process.env.CALL_ANALYSIS_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
  const candidate = bearer ?? request.headers.get("x-cron-secret") ?? "";
  if (!secret || !candidate || !(await timingSafeEqualUtf8(candidate, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingCallAnalyses({ limit: 2 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await captureObservedError(error, { route: "cron/call-analysis" });
    return NextResponse.json(
      { ok: false, error: "Call analysis retry failed." },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
