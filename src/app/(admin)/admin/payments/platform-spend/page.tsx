import { requireAdminPermission } from "@/lib/admin-session";
import { CreditCard } from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import {
  applyComputedNextBillingDates,
  buildPlatformSpendSummary,
  formatPlatformSpendEur,
  type PlatformVendorCostRow,
} from "@/lib/platform-spend";
import { createAdminClient } from "@/utils/supabase/admin";

import { PlatformSpendToolbar } from "./platform-spend-toolbar";
import { PlatformSpendVendorTable } from "./platform-spend-vendor-table";

export const dynamic = "force-dynamic";

function latestApiSyncLabel(rows: PlatformVendorCostRow[]): string | null {
  const synced = rows
    .filter((row) => row.last_synced_at)
    .map((row) => row.last_synced_at as string)
    .sort()
    .at(-1);
  if (!synced) return null;
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(synced));
}

export default async function PlatformSpendPage() {
  await requireAdminPermission("billing");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_vendor_costs")
    .select("*")
    .order("next_billing_date", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true });

  const loadError = error?.message ?? null;
  const rows = applyComputedNextBillingDates((data ?? []) as PlatformVendorCostRow[]).sort(
    (a, b) => {
      if (a.next_billing_date && b.next_billing_date) {
        const byDate = a.next_billing_date.localeCompare(b.next_billing_date);
        if (byDate !== 0) return byDate;
      } else if (a.next_billing_date) {
        return -1;
      } else if (b.next_billing_date) {
        return 1;
      }
      return a.display_name.localeCompare(b.display_name);
    },
  );

  const summary = buildPlatformSpendSummary(rows);
  const lastSyncedLabel = latestApiSyncLabel(rows);

  return (
    <AdminPageShell
      icon={CreditCard}
      title="Platform spend"
      description="Track what Cliste pays for internal tools and infrastructure — subscriptions, usage, and upcoming charges."
      actions={<PlatformSpendToolbar lastSyncedLabel={lastSyncedLabel} />}
      maxWidth="6xl"
    >
      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          Could not load platform spend: {loadError}
        </p>
      ) : null}

      <AdminStatsGrid>
        <AdminStatCard
          label="Monthly run rate"
          value={formatPlatformSpendEur(summary.monthlyRunRateCents)}
        />
        <AdminStatCard
          label="Due this month"
          value={formatPlatformSpendEur(summary.dueThisMonthCents)}
        />
        <AdminStatCard
          label="API synced (MTD)"
          value={formatPlatformSpendEur(summary.apiSyncedMtdCents)}
        />
        <AdminStatCard
          label="Est. monthly total"
          value={formatPlatformSpendEur(summary.totalEstimatedMonthlyCents)}
        />
      </AdminStatsGrid>

      <AdminSectionCard
        title="Vendors"
        description="Edit manual amounts and billing days. Click Refresh API data for OpenRouter."
        padded
      >
        <PlatformSpendVendorTable rows={rows} />
      </AdminSectionCard>
    </AdminPageShell>
  );
}
