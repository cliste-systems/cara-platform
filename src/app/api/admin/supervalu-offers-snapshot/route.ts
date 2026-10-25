import { NextResponse } from "next/server";

import { loadSupervaluOffersSnapshot } from "@/lib/supervalu-offers-snapshot";
import { requireAdminPermission } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminPermission("customers");
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const snapshot = await loadSupervaluOffersSnapshot(admin);
    if (!snapshot) {
      return NextResponse.json(
        { ok: false, error: "No offers snapshot found — run Refresh offers first." },
        { status: 404 },
      );
    }
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="supervalu-weekly-offers.json"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Offers snapshot is temporarily unavailable. Please try again shortly.",
      },
      { status: 500 },
    );
  }
}
