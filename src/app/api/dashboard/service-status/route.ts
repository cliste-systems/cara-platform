import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { loadServiceStatus } from "@/lib/admin-service-status-server";

export async function GET() {
  await requireDashboardSession();
  const services = await loadServiceStatus();
  return NextResponse.json({ services }, { headers: { "Cache-Control": "private, no-store" } });
}
