import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-session";
import { parseTransportBatch } from "@/lib/call-transport";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: Request) {
  try { await requireAdminPermission("calls"); } catch {
    console.warn("[demo-call-transport] rejected: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    console.warn("[demo-call-transport] rejected: invalid_origin");
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 50000) {
    console.warn("[demo-call-transport] rejected: payload_too_large");
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let batch;
  try {
    const body = await request.text();
    if (body.length > 50000) {
      console.warn("[demo-call-transport] rejected: payload_too_large");
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    batch = parseTransportBatch(JSON.parse(body));
  } catch {
    console.warn("[demo-call-transport] rejected: invalid_telemetry");
    return NextResponse.json({ error: "Invalid telemetry" }, { status: 400 });
  }
  const { error } = await createAdminClient().from("admin_call_transport_samples").upsert(
    batch.samples.map(sample => ({ room_name: batch.roomName, sample_id: sample.id, sample })),
    { onConflict: "room_name,sample_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[demo-call-transport] save_failed");
    return NextResponse.json({ error: "Telemetry could not be saved" }, { status: 503 });
  }
  return NextResponse.json({ saved: batch.samples.length });
}
