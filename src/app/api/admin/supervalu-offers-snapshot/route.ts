import { NextResponse } from "next/server";

import { loadSupervaluOffersSnapshot } from "@/lib/supervalu-offers-snapshot";
import { requireAdminPermission } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminPermission("customers");
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
        error: err instanceof Error ? err.message : "Failed to load offers snapshot",
      },
      { status: 500 },
    );
  }
}
