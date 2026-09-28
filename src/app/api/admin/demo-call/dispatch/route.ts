import { NextResponse } from "next/server";

import { dispatchAdminDemoCallAgent } from "@/lib/admin-demo-call";
import { requireAdminSessionUser } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  roomName?: string;
  calledNumber?: string;
};

export async function POST(request: Request) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const roomName = String(body.roomName ?? "").trim();
  const calledNumber = String(body.calledNumber ?? "").trim();
  if (!roomName || !calledNumber) {
    return NextResponse.json(
      { error: "roomName and calledNumber are required." },
      { status: 400 },
    );
  }

  try {
    await dispatchAdminDemoCallAgent({ roomName, calledNumber });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to dispatch voice worker.";
    const status = message.includes("not configured") || message.includes("not set")
      ? 503
      : message.includes("Invalid demo line")
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
