import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/admin-session";
import {
  generateTextRehearsalVariants,
  type TextRehearsalVariantCount,
} from "@/lib/text-rehearsal-variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  seed?: string;
  count?: number;
};

const ALLOWED_COUNTS = new Set<TextRehearsalVariantCount>([5, 10, 20]);

export async function POST(request: Request) {
  try {
    await requireAdminPermission("calls");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const seed = String(body.seed ?? "").trim();
  const count = Number(body.count ?? 5) as TextRehearsalVariantCount;
  if (!seed) {
    return NextResponse.json({ error: "seed is required." }, { status: 400 });
  }
  if (!ALLOWED_COUNTS.has(count)) {
    return NextResponse.json({ error: "count must be 5, 10, or 20." }, { status: 400 });
  }

  try {
    const variants = await generateTextRehearsalVariants({ seed, count });
    return NextResponse.json({ variants });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate variants.";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
