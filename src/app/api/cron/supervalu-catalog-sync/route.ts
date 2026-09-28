import { NextResponse } from "next/server";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
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
  return Boolean(candidate) && timingSafeEqualUtf8(candidate, secret);
}

export async function runSupervaluCatalogSyncCron(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("request_supervalu_catalog_refresh", { p_kind: "full" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: data?.ok !== false, queued: true, result: data }, { status: data?.ok === false ? 502 : 202 });
}

export const GET = runSupervaluCatalogSyncCron;
export const POST = runSupervaluCatalogSyncCron;
