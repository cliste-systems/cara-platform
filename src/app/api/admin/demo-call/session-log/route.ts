import { NextResponse } from "next/server";

import { loadAdminDemoCallSessionLog } from "@/lib/admin-demo-call";
import { requireAdminPermission } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminPermission("calls");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const roomName = new URL(request.url).searchParams.get("roomName")?.trim();
  if (!roomName) {
    return NextResponse.json({ error: "roomName is required." }, { status: 400 });
  }

  try {
    const sessionLog = await loadAdminDemoCallSessionLog(roomName);
    return NextResponse.json(sessionLog);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load session log.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
