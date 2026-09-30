import { NextResponse } from "next/server";

import { requireAdminMfaSetupSessionUser } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_MFA_FRIENDLY_NAME = "Cliste Systems Admin";

export async function POST() {
  let user: User;
  try {
    user = await requireAdminMfaSetupSessionUser();
  } catch {
    return NextResponse.json({ error: "An active staff sign-in is required.", code: "session_required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({
    userId: user.id,
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not inspect existing MFA factors." },
      { status: 500 },
    );
  }

  const factors = data?.factors ?? [];
  const stale = factors.filter(
    (factor) =>
      factor.status === "unverified" &&
      factor.factor_type === "totp" &&
      factor.friendly_name === ADMIN_MFA_FRIENDLY_NAME,
  );

  for (const factor of stale) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: factor.id,
    });

    if (deleteError) {
      console.warn("[admin-mfa] stale_factor_cleanup_failed", {
        factorId: factor.id,
        message: deleteError.message,
      });
      continue;
    }
  }

  return NextResponse.json({ ok: true, removed: stale.length });
}
