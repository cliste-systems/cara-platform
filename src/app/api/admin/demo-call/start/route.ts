import { NextResponse } from "next/server";

import { startAdminDemoCall } from "@/lib/admin-demo-call";
import { requireAdminPermission } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  calledNumber?: string;
};

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdminPermission("calls");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const calledNumber = String(body.calledNumber ?? "").trim();
  if (!calledNumber) {
    return NextResponse.json({ error: "calledNumber is required." }, { status: 400 });
  }

  const staffIdentity =
    user.email?.trim() || user.id?.trim() || "staff";

  try {
    const session = await startAdminDemoCall({ calledNumber, staffIdentity });
    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start demo call.";
    const status = message.includes("not configured") || message.includes("not set")
      ? 503
      : message.includes("Invalid demo line")
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
